param(
    [string]$EnvFile = '.env.production',
    [ValidateSet('production', 'staging')]
    [string]$DeploymentTier = 'production',
    [string]$ProjectName = '',
    [switch]$AllowLegacyBlueWithoutActivityWorker,
    [switch]$AllowLegacyBlueWithoutImageRevision,
    [string]$ToolingRelease = '',
    [string]$DeploymentLockToken = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$envPath = (Resolve-Path (Join-Path $workspace $EnvFile)).Path
. (Join-Path $PSScriptRoot 'deployment-lock.ps1')
. (Join-Path $PSScriptRoot 'deployment-source-guard.ps1')
$evidence = Join-Path $workspace (
    '.release-artifacts/rollback-{0}-{1}' -f $DeploymentTier, (Get-Date -Format 'yyyyMMdd-HHmmss')
)
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$workers = @('activity-worker', 'content-worker', 'system-monitor-worker')
$overlayFile = Join-Path $workspace "docker-compose.$DeploymentTier.yml"
$composeFiles = @()
if ($ProjectName) {
    $composeFiles += @('--project-name', $ProjectName)
}
$composeFiles += @(
    '-f', (Join-Path $workspace 'docker-compose.yml'),
    '-f', $overlayFile
)
if (-not $ProjectName) {
    throw 'ProjectName is required so rollback cannot target an inferred Compose project.'
}
if (($AllowLegacyBlueWithoutActivityWorker -or $AllowLegacyBlueWithoutImageRevision) -and
    $DeploymentTier -ne 'production') {
    throw 'Legacy rollback compatibility is production only.'
}

function Read-EnvFileValue([string]$Name) {
    $match = Get-Content -LiteralPath $envPath |
        Where-Object { $_ -match ('^[ ]*{0}[ ]*=' -f [regex]::Escape($Name)) } |
        Select-Object -Last 1
    if (-not $match) { return '' }
    return (($match -split '=', 2)[1]).Trim().Trim('"').Trim("'")
}

function Read-EnvValue([string]$Name) {
    $processValue = [Environment]::GetEnvironmentVariable($Name)
    if ($processValue) { return $processValue }
    return Read-EnvFileValue $Name
}

function Set-WorkerPointersAtomically {
    param(
        [Parameter(Mandatory = $true)][string]$Image,
        [Parameter(Mandatory = $true)][string]$Release,
        [switch]$AllowLegacy
    )
    $validIdentity = if ($AllowLegacy) {
        $Image -match '(@sha256:[0-9a-fA-F]{64}|:[0-9a-fA-F]{7,40})$' -and
        $Release -match '^[0-9a-fA-F]{7,40}$'
    } else {
        $Image -match '@sha256:[0-9a-fA-F]{64}$' -and
        $Release -match '^[0-9a-fA-F]{40}$'
    }
    if (-not $validIdentity -or $Image -match '[\r\n]') {
        throw 'Refusing to write invalid worker pointer values.'
    }
    $content = [System.IO.File]::ReadAllText($envPath)
    foreach ($name in @('BACKEND_WORKER_IMAGE', 'BACKEND_WORKER_RELEASE')) {
        $pattern = "(?m)^[ ]*$name[ ]*=.*$"
        if ([regex]::Matches($content, $pattern).Count -ne 1) {
            throw "$name must occur exactly once for an atomic pointer commit."
        }
        $value = if ($name -eq 'BACKEND_WORKER_IMAGE') { $Image } else { $Release }
        $content = [regex]::Replace($content, $pattern, "$name=$value")
    }
    $suffix = [Guid]::NewGuid().ToString('N')
    $temporaryPath = "$envPath.pointer-$suffix.tmp"
    try {
        [System.IO.File]::Copy($envPath, $temporaryPath, $false)
        [System.IO.File]::WriteAllText(
            $temporaryPath,
            $content,
            [System.Text.UTF8Encoding]::new($false)
        )
        [System.IO.File]::Replace($temporaryPath, $envPath, $null)
    }
    finally {
        if ([System.IO.File]::Exists($temporaryPath)) {
            [System.IO.File]::Delete($temporaryPath)
        }
    }
    if ((Read-EnvFileValue 'BACKEND_WORKER_IMAGE') -ne $Image -or
        (Read-EnvFileValue 'BACKEND_WORKER_RELEASE') -ne $Release) {
        throw 'Atomic worker pointer commit could not be verified.'
    }
    return ''
}

$configuredTier = Read-EnvFileValue 'DEPLOYMENT_TIER'
if ($configuredTier -ne $DeploymentTier) {
    throw "DEPLOYMENT_TIER in $EnvFile must equal '$DeploymentTier'."
}
$configuredInstance = Read-EnvFileValue 'DEPLOYMENT_INSTANCE_ID'
if ($configuredInstance -ne $ProjectName) {
    throw "DEPLOYMENT_INSTANCE_ID in $EnvFile must equal '$ProjectName'."
}

$lockHandle = $null
$locationPushed = $false
$mutationStarted = $false
$preserveDeploymentLock = $false
$rollbackPhase = 'locked-preflight'
$originalProcessServiceEnvFile = [Environment]::GetEnvironmentVariable('APP_ENV_FILE')
$bluePointerBackup = ''
try {
    $lockHandle = Enter-DeploymentLock -Workspace $workspace `
        -DeploymentTier $DeploymentTier -ProjectName $ProjectName `
        -ExistingToken $DeploymentLockToken -EvidenceDirectory $evidence
    Assert-DeploymentSourceIdentity -Workspace $workspace `
        -ToolingRelease $ToolingRelease -EvidenceDirectory $evidence
    $env:APP_ENV_FILE = $envPath
    Push-Location $workspace
    $locationPushed = $true
    $initialRoute = docker compose @composeFiles --env-file $envPath exec -T nginx `
        cat /etc/nginx/runtime/active-color
    if ($LASTEXITCODE -ne 0 -or "$initialRoute".Trim() -ne 'green') {
        throw 'Rollback requires the persisted initial route to be green.'
    }
    docker compose @composeFiles --env-file $envPath exec -T nginx cmp -s `
        /etc/nginx/runtime/active-upstreams.conf /etc/nginx/upstreams/green.conf
    if ($LASTEXITCODE -ne 0) {
        throw 'Rollback requires the persisted route to match green exactly.'
    }
    $currentGreenWorkerImage = Read-EnvValue 'BACKEND_WORKER_IMAGE'
    $currentGreenWorkerRelease = Read-EnvValue 'BACKEND_WORKER_RELEASE'
    $greenBackendImage = Read-EnvValue 'BACKEND_GREEN_IMAGE'
    $greenBackendRelease = Read-EnvValue 'BACKEND_GREEN_RELEASE'
    $greenFrontendImage = Read-EnvValue 'FRONTEND_GREEN_IMAGE'
    if ($currentGreenWorkerImage -ne (Read-EnvValue 'BACKEND_WORKER_GREEN_IMAGE') -or
        $currentGreenWorkerRelease -ne (Read-EnvValue 'BACKEND_WORKER_GREEN_RELEASE')) {
        throw 'Rollback requires the proven generic worker pointer to equal current green.'
    }
    if ($currentGreenWorkerImage -notmatch '@sha256:[0-9a-fA-F]{64}$' -or
        $greenBackendImage -notmatch '@sha256:[0-9a-fA-F]{64}$' -or
        $greenFrontendImage -notmatch '@sha256:[0-9a-fA-F]{64}$' -or
        $currentGreenWorkerRelease -notmatch '^[0-9a-fA-F]{40}$' -or
        $greenBackendRelease -notmatch '^[0-9a-fA-F]{40}$') {
        throw 'Current green API/frontend/workers require digest references and full releases.'
    }
    if ($greenBackendImage -ne $currentGreenWorkerImage -or
        $greenBackendRelease -ne $currentGreenWorkerRelease) {
        throw 'Current green API and workers must be the exact same artifact and release.'
    }
    $currentGreenWorkerImageId = docker image inspect --format '{{.Id}}' `
        $currentGreenWorkerImage
    if ($LASTEXITCODE -ne 0 -or -not "$currentGreenWorkerImageId".Trim()) {
        throw 'Current green worker image must already exist locally for recovery.'
    }
    $currentGreenWorkerImageId = "$currentGreenWorkerImageId".Trim()
    $greenBackendImageId = docker image inspect --format '{{.Id}}' $greenBackendImage
    if ($LASTEXITCODE -ne 0 -or
        "$greenBackendImageId".Trim() -ne $currentGreenWorkerImageId) {
        throw 'Current green API and worker references do not resolve to one local artifact.'
    }
    $greenBackendImageId = "$greenBackendImageId".Trim()
    $greenFrontendImageId = docker image inspect --format '{{.Id}}' $greenFrontendImage
    if ($LASTEXITCODE -ne 0 -or -not "$greenFrontendImageId".Trim()) {
        throw 'Current green frontend image must already exist locally for recovery.'
    }
    $greenFrontendImageId = "$greenFrontendImageId".Trim()
    $greenBakedRevision = docker image inspect --format `
        '{{ index .Config.Labels "org.opencontainers.image.revision" }}' `
        $greenBackendImage
    if ($LASTEXITCODE -ne 0 -or
        "$greenBakedRevision".Trim() -ne $greenBackendRelease) {
        throw 'Current green local artifact revision does not match its full release.'
    }
    $greenLiveEvidence = @()
    foreach ($greenWorker in $workers) {
        $greenIds = @(docker compose @composeFiles --env-file $envPath ps -q $greenWorker) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $greenIds.Count -ne 1) {
            throw "Current green pointer does not describe exactly one $greenWorker."
        }
        $greenId = $greenIds[0].Trim()
        $greenImageId = docker inspect --format '{{.Image}}' $greenId
        $greenImageExitCode = $LASTEXITCODE
        $greenState = docker inspect --format '{{.State.Status}}|{{.RestartCount}}' $greenId
        $greenStateExitCode = $LASTEXITCODE
        if ($greenImageExitCode -ne 0 -or $greenStateExitCode -ne 0 -or
            "$greenImageId".Trim() -ne $currentGreenWorkerImageId -or
            "$greenState".Trim() -ne 'running|0') {
            throw "Current green pointer does not match stable live $greenWorker."
        }
        $greenLiveEvidence += "$greenWorker|$greenId|$($greenImageId.Trim())|$greenState"
    }
    $greenLiveEvidence | Set-Content -Encoding utf8 (
        Join-Path $evidence 'current-green-worker-snapshot.txt'
    )
    $greenServiceIds = @{}
    foreach ($greenService in @('api2', 'frontend2')) {
        $greenServiceContainers = @(docker compose @composeFiles --env-file $envPath `
            ps -q $greenService) | Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $greenServiceContainers.Count -ne 1) {
            throw "Current recovery baseline requires one running $greenService."
        }
        $greenServiceId = $greenServiceContainers[0].Trim()
        $greenServiceImageId = docker inspect --format '{{.Image}}' $greenServiceId
        $greenServiceImageExitCode = $LASTEXITCODE
        $greenServiceState = docker inspect --format `
            '{{.State.Status}}|{{.RestartCount}}' $greenServiceId
        $expectedGreenServiceImageId = if ($greenService -eq 'api2') {
            $greenBackendImageId
        } else {
            $greenFrontendImageId
        }
        if ($greenServiceImageExitCode -ne 0 -or $LASTEXITCODE -ne 0 -or
            "$greenServiceImageId".Trim() -ne $expectedGreenServiceImageId -or
            "$greenServiceState".Trim() -ne 'running|0') {
            throw "Current $greenService is not stable on its pinned local image."
        }
        $greenServiceIds[$greenService] = $greenServiceId
    }
    $retainedBlueWorkerImage = Read-EnvValue 'BACKEND_WORKER_BLUE_IMAGE'
    $retainedBlueWorkerRelease = Read-EnvValue 'BACKEND_WORKER_BLUE_RELEASE'
    $retainedBlueBackendImage = Read-EnvValue 'BACKEND_BLUE_IMAGE'
    $retainedBlueBackendRelease = Read-EnvValue 'BACKEND_BLUE_RELEASE'
    $retainedBlueFrontendImage = Read-EnvValue 'FRONTEND_BLUE_IMAGE'
    $legacyBlueOptIn = (
        $AllowLegacyBlueWithoutActivityWorker -or
        $AllowLegacyBlueWithoutImageRevision
    )
    $strictBlueIdentity = (
        $retainedBlueWorkerImage -match '@sha256:[0-9a-fA-F]{64}$' -and
        $retainedBlueBackendImage -match '@sha256:[0-9a-fA-F]{64}$' -and
        $retainedBlueFrontendImage -match '@sha256:[0-9a-fA-F]{64}$' -and
        $retainedBlueWorkerRelease -match '^[0-9a-fA-F]{40}$' -and
        $retainedBlueBackendRelease -match '^[0-9a-fA-F]{40}$'
    )
    $legacyBlueIdentity = (
        $retainedBlueWorkerImage -match '(@sha256:[0-9a-fA-F]{64}|:[0-9a-fA-F]{7,40})$' -and
        $retainedBlueBackendImage -match '(@sha256:[0-9a-fA-F]{64}|:[0-9a-fA-F]{7,40})$' -and
        $retainedBlueFrontendImage -match '(@sha256:[0-9a-fA-F]{64}|:[0-9a-fA-F]{7,40})$' -and
        $retainedBlueWorkerRelease -match '^[0-9a-fA-F]{7,40}$' -and
        $retainedBlueBackendRelease -match '^[0-9a-fA-F]{7,40}$'
    )
    if ((-not $legacyBlueOptIn -and -not $strictBlueIdentity) -or
        ($legacyBlueOptIn -and -not $legacyBlueIdentity)) {
        throw 'Retained blue artifacts require digest/full-release identity unless explicit production legacy recovery is selected.'
    }
    if ($retainedBlueBackendImage -ne $retainedBlueWorkerImage -or
        $retainedBlueBackendRelease -ne $retainedBlueWorkerRelease) {
        throw 'Retained blue API and workers must be the exact same artifact and release.'
    }
    $retainedBlueWorkerImageId = docker image inspect --format '{{.Id}}' `
        $retainedBlueWorkerImage
    if ($LASTEXITCODE -ne 0 -or -not "$retainedBlueWorkerImageId".Trim()) {
        throw 'Retained blue worker image must exist locally before rollback mutation.'
    }
    $retainedBlueWorkerImageId = "$retainedBlueWorkerImageId".Trim()
    $retainedBlueBackendImageId = docker image inspect --format '{{.Id}}' `
        $retainedBlueBackendImage
    if ($LASTEXITCODE -ne 0 -or
        "$retainedBlueBackendImageId".Trim() -ne $retainedBlueWorkerImageId) {
        throw 'Retained blue API and worker references do not resolve to one local artifact.'
    }
    $retainedBlueBackendImageId = "$retainedBlueBackendImageId".Trim()
    $retainedBlueFrontendImageId = docker image inspect --format '{{.Id}}' `
        $retainedBlueFrontendImage
    if ($LASTEXITCODE -ne 0 -or -not "$retainedBlueFrontendImageId".Trim()) {
        throw 'Retained blue frontend image must exist locally before rollback mutation.'
    }
    $retainedBlueFrontendImageId = "$retainedBlueFrontendImageId".Trim()
    $retainedBlueRevision = docker image inspect --format `
        '{{ index .Config.Labels "org.opencontainers.image.revision" }}' `
        $retainedBlueBackendImage
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to inspect retained blue backend revision.'
    }
    $retainedBlueHasRevision = "$retainedBlueRevision".Trim() -match '^[0-9a-fA-F]{7,40}$'
    if ($retainedBlueHasRevision -and
        "$retainedBlueRevision".Trim() -ne $retainedBlueBackendRelease) {
        throw 'Retained blue backend revision does not match its configured release.'
    }
    if (-not $retainedBlueHasRevision -and
        -not $AllowLegacyBlueWithoutImageRevision) {
        throw 'Retained blue backend lacks a revision; explicit legacy recovery authorization is required.'
    }
    $retainedBlueActivityCapability = docker image inspect --format `
        '{{ index .Config.Labels "com.maianhomes.capability.activity-worker" }}' `
        $retainedBlueWorkerImage
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to inspect retained blue Activity capability.'
    }
    $retainedBlueHasActivityWorker = "$retainedBlueActivityCapability".Trim().Equals(
        'true', [StringComparison]::OrdinalIgnoreCase
    )
    if (-not $retainedBlueHasActivityWorker -and
        -not $AllowLegacyBlueWithoutActivityWorker) {
        throw 'Retained blue lacks dedicated Activity capability; explicit legacy recovery authorization is required.'
    }
    $bluePointerWorkers = if ($retainedBlueHasActivityWorker) {
        $workers
    } else {
        @($workers | Where-Object { $_ -ne 'activity-worker' })
    }
    @(
        "blue_api_worker_local_image_id=$retainedBlueWorkerImageId"
        "blue_frontend_local_image_id=$retainedBlueFrontendImageId"
        "blue_release=$retainedBlueWorkerRelease"
        "blue_activity_capability=$retainedBlueActivityCapability"
        "blue_worker_count=$($bluePointerWorkers.Count)"
        'api_worker_artifact_coherent=true'
    ) | Set-Content -Encoding utf8 (
        Join-Path $evidence 'retained-blue-preflight.txt'
    )

    $workerArguments = @{
        Color = 'blue'
        EnvFile = $EnvFile
        DeploymentTier = $DeploymentTier
        EvidenceDirectory = (Join-Path $evidence 'workers-blue')
        ReadinessApiService = 'api2'
        ProjectName = $ProjectName
        DeploymentLockToken = $lockHandle.Token
        ToolingRelease = $ToolingRelease
        ExpectedWorkerImageId = $retainedBlueWorkerImageId
        TransitionRecovery = $true
    }
    New-Item -ItemType Directory -Force -Path $workerArguments.EvidenceDirectory |
        Out-Null
    if ($AllowLegacyBlueWithoutActivityWorker) {
        $workerArguments.AllowLegacyWithoutActivityWorker = $true
    }
    if ($AllowLegacyBlueWithoutImageRevision) {
        $workerArguments.AllowLegacyWithoutImageRevision = $true
    }
    & (Join-Path $PSScriptRoot 'deploy-workers.ps1') @workerArguments -PreflightOnly |
        Tee-Object -FilePath (Join-Path $evidence 'worker-preflight.txt')

    # Inverse ownership order: stop dedicated Activity inside deploy-workers,
    # restore blue base workers, then start the legacy API, and only then route.
    $rollbackPhase = 'inverse-worker-transition'
    $mutationStarted = $true
    & (Join-Path $PSScriptRoot 'deploy-workers.ps1') @workerArguments |
        Tee-Object -FilePath (Join-Path $evidence 'worker-rollback.txt')
    $rollbackPhase = 'retained-blue-api-start'
    docker compose @composeFiles --env-file $envPath up -d --no-deps `
        --pull never api1 frontend1
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to start retained blue API/frontend from local images.'
    }
    foreach ($blueService in @('api1', 'frontend1')) {
        $blueServiceIds = @(docker compose @composeFiles --env-file $envPath `
            ps -q $blueService) | Where-Object { $_ -and $_.Trim() }
        $expectedBlueServiceImageId = if ($blueService -eq 'api1') {
            $retainedBlueBackendImageId
        } else {
            $retainedBlueFrontendImageId
        }
        if ($LASTEXITCODE -ne 0 -or $blueServiceIds.Count -ne 1) {
            throw "Expected exactly one running $blueService after local restore."
        }
        $blueServiceImageId = docker inspect --format '{{.Image}}' `
            $blueServiceIds[0].Trim()
        $blueServiceImageExitCode = $LASTEXITCODE
        $blueServiceState = docker inspect --format `
            '{{.State.Status}}|{{.RestartCount}}' $blueServiceIds[0].Trim()
        if ($blueServiceImageExitCode -ne 0 -or $LASTEXITCODE -ne 0 -or
            "$blueServiceImageId".Trim() -ne $expectedBlueServiceImageId -or
            "$blueServiceState".Trim() -ne 'running|0') {
            throw "$blueService did not start stably on its preflight-pinned local image."
        }
    }
    $switchArguments = @{
        Color = 'blue'
        EnvFile = $EnvFile
        DeploymentTier = $DeploymentTier
        ProjectName = $ProjectName
        DeploymentLockToken = $lockHandle.Token
        ToolingRelease = $ToolingRelease
        EvidenceDirectory = (Join-Path $evidence 'traffic-blue')
        ExpectedWorkerImageId = $retainedBlueWorkerImageId
    }
    New-Item -ItemType Directory -Force -Path $switchArguments.EvidenceDirectory |
        Out-Null
    if ($AllowLegacyBlueWithoutImageRevision) {
        $switchArguments.AllowLegacyBackendWithoutRevision = $true
    }
    if ($AllowLegacyBlueWithoutActivityWorker) {
        $switchArguments.AllowLegacyWithoutActivityWorker = $true
    }
    $rollbackPhase = 'blue-route-switch'
    & (Join-Path $PSScriptRoot 'switch-blue-green.ps1') @switchArguments |
        Tee-Object -FilePath (Join-Path $evidence 'traffic-switch.txt')
    $blueWorkerIds = @{}
    $bluePointerEvidence = @()
    foreach ($blueWorker in $bluePointerWorkers) {
        $blueIds = @(docker compose @composeFiles --env-file $envPath ps -q $blueWorker) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $blueIds.Count -ne 1) {
            throw "Blue pointer commit requires exactly one running $blueWorker."
        }
        $blueId = $blueIds[0].Trim()
        $blueImageId = docker inspect --format '{{.Image}}' $blueId
        $blueImageExitCode = $LASTEXITCODE
        $blueState = docker inspect --format '{{.State.Status}}|{{.RestartCount}}' $blueId
        $blueStateExitCode = $LASTEXITCODE
        if ($blueImageExitCode -ne 0 -or $blueStateExitCode -ne 0 -or
            "$blueImageId".Trim() -ne $retainedBlueWorkerImageId -or
            "$blueState".Trim() -ne 'running|0') {
            throw "Blue pointer commit requires stable exact retained $blueWorker."
        }
        $blueWorkerIds[$blueWorker] = $blueId
        $bluePointerEvidence += "$blueWorker|$blueId|$($blueImageId.Trim())|$blueState"
    }
    if (-not $retainedBlueHasActivityWorker) {
        $blueActivityRunning = @(docker compose @composeFiles --env-file $envPath `
            ps --status running -q activity-worker) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $blueActivityRunning.Count -ne 0) {
            throw 'Legacy blue pointer commit requires zero dedicated Activity workers.'
        }
        $bluePointerEvidence += 'activity-worker|absent|legacy-api-embedded'
    }
    $rollbackPhase = 'durable-blue-pointer-commit'
    $bluePointerBackup = Set-WorkerPointersAtomically `
        -Image $retainedBlueWorkerImage -Release $retainedBlueWorkerRelease `
        -AllowLegacy:$legacyBlueOptIn
    $env:BACKEND_WORKER_IMAGE = $retainedBlueWorkerImage
    $env:BACKEND_WORKER_RELEASE = $retainedBlueWorkerRelease
    foreach ($blueWorker in $bluePointerWorkers) {
        $blueIdsAfterCommit = @(docker compose @composeFiles --env-file $envPath `
            ps -q $blueWorker) |
            Where-Object { $_ -and $_.Trim() }
        $blueStateAfterCommit = docker inspect --format `
            '{{.State.Status}}|{{.RestartCount}}' $blueWorkerIds[$blueWorker]
        if ($LASTEXITCODE -ne 0 -or $blueIdsAfterCommit.Count -ne 1 -or
            $blueIdsAfterCommit[0].Trim() -ne $blueWorkerIds[$blueWorker] -or
            "$blueStateAfterCommit".Trim() -ne 'running|0') {
            throw "Retained $blueWorker changed during atomic pointer commit."
        }
    }
    if (-not $retainedBlueHasActivityWorker) {
        $blueActivityAfterCommit = @(docker compose @composeFiles --env-file $envPath `
            ps --status running -q activity-worker) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $blueActivityAfterCommit.Count -ne 0) {
            throw 'Legacy Activity ownership changed during atomic pointer commit.'
        }
    }
    if ([System.IO.File]::Exists($bluePointerBackup)) {
        [System.IO.File]::Delete($bluePointerBackup)
        $bluePointerBackup = ''
    }
    $bluePointerEvidence += @(
        'status=verified'
        "pointer_image=$retainedBlueWorkerImage"
        "pointer_release=$retainedBlueWorkerRelease"
    )
    $bluePointerEvidence | Set-Content -Encoding utf8 (
        Join-Path $evidence 'worker-pointer-commit.txt'
    )
    Write-Output "Rollback completed. Evidence: $evidence"
}
catch {
    $rollbackError = $_
    if (-not $mutationStarted) { throw }
    $recoveryProven = $false
    try {
        # Stop the legacy embedded Activity consumer before restoring the
        # dedicated green worker.
        $legacyApiStop = docker compose @composeFiles --env-file $envPath stop api1 2>&1
        $legacyApiStopExitCode = $LASTEXITCODE
        $legacyApiStop | Set-Content -Encoding utf8 (
            Join-Path $evidence 'recovery-legacy-api-stop.txt'
        )
        $legacyApiRunning = @(docker compose @composeFiles --env-file $envPath `
            ps --status running -q api1) |
            Where-Object { $_ -and $_.Trim() }
        if ($legacyApiStopExitCode -ne 0 -or
            $LASTEXITCODE -ne 0 -or
            $legacyApiRunning.Count -ne 0) {
            throw 'Unable to stop and prove zero legacy API consumers during recovery.'
        }
        $greenWorkerEvidence = Join-Path $evidence 'automatic-green-worker-recovery'
        New-Item -ItemType Directory -Force -Path $greenWorkerEvidence | Out-Null
        & (Join-Path $PSScriptRoot 'deploy-workers.ps1') -Color green `
            -EnvFile $EnvFile -DeploymentTier $DeploymentTier `
            -ProjectName $ProjectName -ReadinessApiService api2 `
            -EvidenceDirectory $greenWorkerEvidence `
            -DeploymentLockToken $lockHandle.Token -ToolingRelease $ToolingRelease `
            -ExpectedWorkerImageId $currentGreenWorkerImageId -TransitionRecovery |
            Tee-Object -FilePath (Join-Path $evidence 'automatic-green-workers.txt')
        $greenSwitchEvidence = Join-Path $evidence 'automatic-green-route-recovery'
        New-Item -ItemType Directory -Force -Path $greenSwitchEvidence | Out-Null
        & (Join-Path $PSScriptRoot 'switch-blue-green.ps1') -Color green `
            -EnvFile $EnvFile -DeploymentTier $DeploymentTier `
            -ProjectName $ProjectName -DeploymentLockToken $lockHandle.Token `
            -ToolingRelease $ToolingRelease -EvidenceDirectory $greenSwitchEvidence `
            -ExpectedWorkerImageId $currentGreenWorkerImageId |
            Tee-Object -FilePath (Join-Path $evidence 'automatic-green-route.txt')
        $greenRecoveryWorkerIds = @{}
        foreach ($greenRecoveryWorker in $workers) {
            $greenRecoveryIds = @(docker compose @composeFiles --env-file $envPath `
                ps -q $greenRecoveryWorker) |
                Where-Object { $_ -and $_.Trim() }
            if ($LASTEXITCODE -ne 0 -or $greenRecoveryIds.Count -ne 1) {
                throw "Green recovery pointer commit requires one $greenRecoveryWorker."
            }
            $greenRecoveryId = $greenRecoveryIds[0].Trim()
            $greenRecoveryImageId = docker inspect --format '{{.Image}}' `
                $greenRecoveryId
            $greenRecoveryImageExitCode = $LASTEXITCODE
            $greenRecoveryState = docker inspect --format `
                '{{.State.Status}}|{{.RestartCount}}' $greenRecoveryId
            if ($greenRecoveryImageExitCode -ne 0 -or $LASTEXITCODE -ne 0 -or
                "$greenRecoveryImageId".Trim() -ne $currentGreenWorkerImageId -or
                "$greenRecoveryState".Trim() -ne 'running|0') {
                throw "Green recovery pointer commit found unstable $greenRecoveryWorker."
            }
            $greenRecoveryWorkerIds[$greenRecoveryWorker] = $greenRecoveryId
        }
        $greenPointerBackup = Set-WorkerPointersAtomically `
            -Image $currentGreenWorkerImage -Release $currentGreenWorkerRelease
        $env:BACKEND_WORKER_IMAGE = $currentGreenWorkerImage
        $env:BACKEND_WORKER_RELEASE = $currentGreenWorkerRelease
        foreach ($greenRecoveryWorker in $workers) {
            $greenIdsAfterRecoveryCommit = @(docker compose @composeFiles `
                --env-file $envPath ps -q $greenRecoveryWorker) |
                Where-Object { $_ -and $_.Trim() }
            $greenStateAfterRecoveryCommit = docker inspect --format `
                '{{.State.Status}}|{{.RestartCount}}' `
                $greenRecoveryWorkerIds[$greenRecoveryWorker]
            if ($LASTEXITCODE -ne 0 -or
                $greenIdsAfterRecoveryCommit.Count -ne 1 -or
                $greenIdsAfterRecoveryCommit[0].Trim() -ne $greenRecoveryWorkerIds[$greenRecoveryWorker] -or
                "$greenStateAfterRecoveryCommit".Trim() -ne 'running|0') {
                throw "Green recovery $greenRecoveryWorker changed during pointer commit."
            }
        }
        if ([System.IO.File]::Exists($greenPointerBackup)) {
            [System.IO.File]::Delete($greenPointerBackup)
        }
        if ($bluePointerBackup -and [System.IO.File]::Exists($bluePointerBackup)) {
            [System.IO.File]::Delete($bluePointerBackup)
            $bluePointerBackup = ''
        }
        $recoveryProven = $true
        @(
            'status=restored'
            "failed_phase=$rollbackPhase"
            "original_error_type=$($rollbackError.Exception.GetType().FullName)"
            'route=green'
            'legacy_api_running_count=0'
            'green_workers=exact-and-ready'
        ) | Set-Content -Encoding utf8 (
            Join-Path $evidence 'rollback-recovery-result.txt'
        )
    }
    catch {
        if ($recoveryProven) { throw }
        $recoveryError = $_
        $emergencyServices = $workers + @('api1', 'api2')
        $stopOutput = docker compose @composeFiles --env-file $envPath `
            stop @emergencyServices 2>&1
        $stopExitCode = $LASTEXITCODE
        $stopOutput |
            Set-Content -Encoding utf8 (Join-Path $evidence 'worker-emergency-stop.txt')
        $runningWorkers = @(docker compose @composeFiles --env-file $envPath `
            ps --status running -q @emergencyServices) |
            Where-Object { $_ -and $_.Trim() }
        $runningCheckExitCode = $LASTEXITCODE
        @(
            "stop_exit_code=$stopExitCode"
            "running_check_exit_code=$runningCheckExitCode"
            "running_worker_count=$($runningWorkers.Count)"
            $runningWorkers
        ) | Set-Content -Encoding utf8 (Join-Path $evidence 'worker-emergency-stop-verification.txt')
        @(
            "failed_phase=$rollbackPhase"
            "original_error_type=$($rollbackError.Exception.GetType().FullName)"
            "recovery_error_type=$($recoveryError.Exception.GetType().FullName)"
        ) | Set-Content -Encoding utf8 (
            Join-Path $evidence 'worker-rollback-error.txt'
        )
        if ($stopExitCode -ne 0 -or
            $runningCheckExitCode -ne 0 -or
            $runningWorkers.Count -ne 0) {
            $preserveDeploymentLock = $true
            throw "Rollback failed during '$rollbackPhase'; recovery failed and zero running writers could not be proven. Isolate writes immediately. Evidence: $evidence"
        }
        throw "Rollback failed during '$rollbackPhase'; recovery failed. Both APIs and every worker were stopped and proven zero. Evidence: $evidence"
    }
    if ($recoveryProven) {
        throw "Rollback failed during '$rollbackPhase'; green route, workers, and durable pointer were restored and verified. Evidence: $evidence"
    }
}
finally {
    if ($null -eq $originalProcessServiceEnvFile) {
        Remove-Item Env:APP_ENV_FILE -ErrorAction SilentlyContinue
    } else {
        $env:APP_ENV_FILE = $originalProcessServiceEnvFile
    }
    if ($locationPushed) { Pop-Location }
    if ($null -ne $lockHandle -and -not $preserveDeploymentLock) {
        Exit-DeploymentLock -Handle $lockHandle
    }
}
