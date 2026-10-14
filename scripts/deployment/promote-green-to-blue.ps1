param(
    [string]$EnvFile = '.env.production',
    [ValidateSet('production', 'staging')]
    [string]$DeploymentTier = 'production',
    [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()]
    [string]$ProjectName,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-fA-F]{40}$')]
    [string]$ToolingRelease
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$envPath = (Resolve-Path (Join-Path $workspace $EnvFile)).Path
$overlayFile = Join-Path $workspace "docker-compose.$DeploymentTier.yml"
$compose = @(
    '--project-name', $ProjectName,
    '-f', (Join-Path $workspace 'docker-compose.yml'),
    '-f', $overlayFile
)
$workers = @(
    'activity-worker', 'content-worker', 'system-monitor-worker'
)
$evidence = Join-Path $workspace (
    '.release-artifacts/promote-green-to-blue-{0}' -f (Get-Date -Format 'yyyyMMdd-HHmmss')
)
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
. (Join-Path $PSScriptRoot 'deployment-lock.ps1')
. (Join-Path $PSScriptRoot 'deployment-source-guard.ps1')

function Read-EnvFileValue([string]$Name) {
    $matches = @(
        Get-Content -LiteralPath $envPath |
            Where-Object { $_ -match ('^[ ]*{0}[ ]*=' -f [regex]::Escape($Name)) }
    )
    if ($matches.Count -ne 1) {
        throw "$Name must occur exactly once in the deployment env file."
    }
    return (($matches[0] -split '=', 2)[1]).Trim().Trim('"').Trim("'")
}

function Write-Phase([string]$Phase) {
    $content = @(
        'schema_version=1'
        'operation=promote-green-to-blue'
        "phase=$Phase"
        "project=$ProjectName"
        "tier=$DeploymentTier"
        "tooling_release=$($ToolingRelease.ToLowerInvariant())"
    ) -join "`n"
    $temporary = Join-Path $evidence 'promotion-phase.tmp'
    [System.IO.File]::WriteAllText(
        $temporary, $content + "`n", [System.Text.UTF8Encoding]::new($false)
    )
    [System.IO.File]::Move(
        $temporary, (Join-Path $evidence 'promotion-phase.txt'), $true
    )
}

function Set-PromotionPointersAtomically {
    param(
        [Parameter(Mandatory = $true)][string]$BackendImage,
        [Parameter(Mandatory = $true)][string]$BackendRelease,
        [Parameter(Mandatory = $true)][string]$FrontendImage
    )
    $updates = [ordered]@{
        BACKEND_BLUE_IMAGE = $BackendImage
        BACKEND_BLUE_RELEASE = $BackendRelease
        FRONTEND_BLUE_IMAGE = $FrontendImage
        BACKEND_WORKER_BLUE_IMAGE = $BackendImage
        BACKEND_WORKER_BLUE_RELEASE = $BackendRelease
        BACKEND_WORKER_IMAGE = $BackendImage
        BACKEND_WORKER_RELEASE = $BackendRelease
        ACTIVE_COLOR = 'blue'
    }
    $content = [System.IO.File]::ReadAllText($envPath)
    foreach ($entry in $updates.GetEnumerator()) {
        if ([string]$entry.Value -match '[\r\n]') {
            throw "Refusing to persist an invalid $($entry.Key) value."
        }
        $pattern = "(?m)^[ ]*$([regex]::Escape([string]$entry.Key))[ ]*=.*$"
        if ([regex]::Matches($content, $pattern).Count -ne 1) {
            throw "$($entry.Key) must occur exactly once for promotion commit."
        }
        $content = [regex]::Replace(
            $content, $pattern, "$($entry.Key)=$($entry.Value)"
        )
    }
    $temporary = "$envPath.promotion-$([Guid]::NewGuid().ToString('N')).tmp"
    try {
        [System.IO.File]::Copy($envPath, $temporary, $false)
        [System.IO.File]::WriteAllText(
            $temporary, $content, [System.Text.UTF8Encoding]::new($false)
        )
        [System.IO.File]::Replace($temporary, $envPath, $null)
    }
    finally {
        if ([System.IO.File]::Exists($temporary)) {
            [System.IO.File]::Delete($temporary)
        }
    }
    foreach ($entry in $updates.GetEnumerator()) {
        if ((Read-EnvFileValue ([string]$entry.Key)) -ne [string]$entry.Value) {
            throw "Promotion pointer verification failed for $($entry.Key)."
        }
    }
}

if ((Read-EnvFileValue 'DEPLOYMENT_TIER') -ne $DeploymentTier -or
    (Read-EnvFileValue 'DEPLOYMENT_INSTANCE_ID') -ne $ProjectName) {
    throw 'Deployment tier or instance identity does not match the explicit target.'
}

$lockHandle = $null
$locationPushed = $false
$preserveDeploymentLock = $false
$routeMutationAttempted = $false
$promotionCommitted = $false
$originalAppEnv = [Environment]::GetEnvironmentVariable('APP_ENV_FILE')
$overriddenVariables = @(
    'BACKEND_BLUE_IMAGE', 'BACKEND_BLUE_RELEASE', 'FRONTEND_BLUE_IMAGE',
    'BACKEND_WORKER_BLUE_IMAGE', 'BACKEND_WORKER_BLUE_RELEASE'
)
$originalOverrides = @{}
foreach ($name in $overriddenVariables) {
    $originalOverrides[$name] = [Environment]::GetEnvironmentVariable($name)
}

try {
    $lockHandle = Enter-DeploymentLock -Workspace $workspace `
        -DeploymentTier $DeploymentTier -ProjectName $ProjectName `
        -EvidenceDirectory $evidence
    Assert-DeploymentSourceIdentity -Workspace $workspace `
        -ToolingRelease $ToolingRelease -EvidenceDirectory $evidence
    $env:APP_ENV_FILE = $envPath
    Push-Location $workspace
    $locationPushed = $true
    Write-Phase 'locked-preflight'

    $activeColor = docker compose @compose --env-file $envPath exec -T nginx `
        cat /etc/nginx/runtime/active-color
    if ($LASTEXITCODE -ne 0 -or "$activeColor".Trim() -ne 'green') {
        throw 'Promotion requires the exact persisted active route to be green.'
    }
    docker compose @compose --env-file $envPath exec -T nginx cmp -s `
        /etc/nginx/runtime/active-upstreams.conf /etc/nginx/upstreams/green.conf
    if ($LASTEXITCODE -ne 0) {
        throw 'Promotion requires the persisted green route to match its reviewed template.'
    }

    $backendImage = Read-EnvFileValue 'BACKEND_GREEN_IMAGE'
    $backendRelease = Read-EnvFileValue 'BACKEND_GREEN_RELEASE'
    $frontendImage = Read-EnvFileValue 'FRONTEND_GREEN_IMAGE'
    if ($backendImage -notmatch '@sha256:[0-9a-fA-F]{64}$' -or
        $frontendImage -notmatch '@sha256:[0-9a-fA-F]{64}$' -or
        $backendRelease -notmatch '^[0-9a-fA-F]{40}$') {
        throw 'Promotion requires immutable green digests and a full backend release revision.'
    }
    if ((Read-EnvFileValue 'BACKEND_WORKER_IMAGE') -ne $backendImage -or
        (Read-EnvFileValue 'BACKEND_WORKER_RELEASE') -ne $backendRelease -or
        (Read-EnvFileValue 'BACKEND_WORKER_GREEN_IMAGE') -ne $backendImage -or
        (Read-EnvFileValue 'BACKEND_WORKER_GREEN_RELEASE') -ne $backendRelease) {
        throw 'The active generic worker pointer must exactly equal retained green.'
    }
    $backendImageId = "$(docker image inspect --format '{{.Id}}' $backendImage)".Trim()
    $frontendImageId = "$(docker image inspect --format '{{.Id}}' $frontendImage)".Trim()
    if ($LASTEXITCODE -ne 0 -or
        $backendImageId -notmatch '^sha256:[0-9a-fA-F]{64}$' -or
        $frontendImageId -notmatch '^sha256:[0-9a-fA-F]{64}$') {
        throw 'Promotion requires both exact green images to exist locally.'
    }

    $baselineIds = @{}
    foreach ($service in @('api2', 'frontend2') + $workers) {
        $ids = @(docker compose @compose --env-file $envPath ps -q $service) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $ids.Count -ne 1) {
            throw "Promotion requires exactly one running $service."
        }
        $id = $ids[0].Trim()
        $expectedImageId = if ($service -eq 'frontend2') { $frontendImageId } else { $backendImageId }
        $state = "$(docker inspect --format '{{.State.Status}}|{{.RestartCount}}|{{.Image}}' $id)".Trim()
        if ($LASTEXITCODE -ne 0 -or $state -ne "running|0|$expectedImageId") {
            throw "Promotion baseline for $service is not stable on the exact green image."
        }
        $baselineIds[$service] = $id
    }

    $env:BACKEND_BLUE_IMAGE = $backendImage
    $env:BACKEND_BLUE_RELEASE = $backendRelease
    $env:FRONTEND_BLUE_IMAGE = $frontendImage
    $env:BACKEND_WORKER_BLUE_IMAGE = $backendImage
    $env:BACKEND_WORKER_BLUE_RELEASE = $backendRelease
    Write-Phase 'blue-candidate-recreate'
    docker compose @compose --env-file $envPath up -d --no-deps `
        --force-recreate --pull never api1 frontend1
    if ($LASTEXITCODE -ne 0) { throw 'Unable to recreate the blue promotion candidate.' }

    Write-Phase 'blue-route-switch'
    $routeMutationAttempted = $true
    & (Join-Path $PSScriptRoot 'switch-blue-green.ps1') -Color blue `
        -EnvFile $EnvFile -DeploymentTier $DeploymentTier -ProjectName $ProjectName `
        -DeploymentLockToken $lockHandle.Token -ExpectedWorkerImageId $backendImageId `
        -ToolingRelease $ToolingRelease -EvidenceDirectory (Join-Path $evidence 'route-blue')
    if ($LASTEXITCODE -ne 0) { throw 'Blue promotion route switch failed.' }
    Write-Phase 'pointer-commit'
    Set-PromotionPointersAtomically -BackendImage $backendImage `
        -BackendRelease $backendRelease -FrontendImage $frontendImage
    $promotionCommitted = $true

    foreach ($service in @('api2', 'frontend2') + $workers) {
        $ids = @(docker compose @compose --env-file $envPath ps -q $service) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $ids.Count -ne 1 -or
            $ids[0].Trim() -ne $baselineIds[$service]) {
            throw "$service changed during promotion commit."
        }
    }
    Write-Phase 'complete'
    Write-Output "Green release $backendRelease promoted to the blue baseline with exact-image verification. Evidence: $evidence"
}
catch {
    $originalError = $_
    if ($promotionCommitted) {
        $preserveDeploymentLock = $true
        Write-Phase 'post-commit-verification-unproven-lock-preserved'
        throw
    }
    if ($routeMutationAttempted) {
        try {
            Write-Phase 'automatic-green-route-recovery'
            & (Join-Path $PSScriptRoot 'switch-blue-green.ps1') -Color green `
                -EnvFile $EnvFile -DeploymentTier $DeploymentTier -ProjectName $ProjectName `
                -DeploymentLockToken $lockHandle.Token -ExpectedWorkerImageId $backendImageId `
                -ToolingRelease $ToolingRelease -EvidenceDirectory (Join-Path $evidence 'route-green-recovery')
            if ($LASTEXITCODE -ne 0) { throw 'Green route recovery failed.' }
            docker compose @compose --env-file $envPath stop api1 frontend1 | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Blue candidate cleanup failed.' }
            Write-Phase 'recovered-green'
        }
        catch {
            $preserveDeploymentLock = $true
            Write-Phase 'recovery-unproven-lock-preserved'
            throw [InvalidOperationException]::new(
                "Promotion failed and green recovery is unproven; the daemon-global lock was preserved. Evidence: $evidence",
                $originalError.Exception
            )
        }
    }
    throw
}
finally {
    foreach ($name in $overriddenVariables) {
        if ($null -eq $originalOverrides[$name]) {
            Remove-Item "Env:$name" -ErrorAction SilentlyContinue
        } else {
            [Environment]::SetEnvironmentVariable($name, $originalOverrides[$name])
        }
    }
    if ($null -eq $originalAppEnv) {
        Remove-Item Env:APP_ENV_FILE -ErrorAction SilentlyContinue
    } else {
        $env:APP_ENV_FILE = $originalAppEnv
    }
    if ($locationPushed) { Pop-Location }
    if ($null -ne $lockHandle -and -not $preserveDeploymentLock) {
        Exit-DeploymentLock -Handle $lockHandle
    }
}
