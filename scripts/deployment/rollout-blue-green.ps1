param(
    [string]$EnvFile = '.env.production',
    [ValidateSet('production', 'staging')]
    [string]$DeploymentTier = 'production',
    [string]$ProjectName = '',
    [string]$ToolingRelease = '',
    [switch]$AllowLegacyBlueWithoutActivityWorker,
    [switch]$AllowLegacyBlueWithoutImageRevision
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$envPath = (Resolve-Path (Join-Path $workspace $EnvFile)).Path
$overlayFile = Join-Path $workspace "docker-compose.$DeploymentTier.yml"
$composeFiles = @('--project-name', $ProjectName)
$composeFiles += @(
    '-f', (Join-Path $workspace 'docker-compose.yml'),
    '-f', $overlayFile
)
$allWorkers = @(
    'activity-worker',
    'content-worker',
    'system-monitor-worker'
)
$evidence = Join-Path $workspace (
    '.release-artifacts/rollout-green-{0}' -f (Get-Date -Format 'yyyyMMdd-HHmmss')
)
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
. (Join-Path $PSScriptRoot 'deployment-lock.ps1')
. (Join-Path $PSScriptRoot 'deployment-source-guard.ps1')

if (-not $ProjectName) {
    throw 'ProjectName is required so rollout cannot target an inferred Compose project.'
}
if (($AllowLegacyBlueWithoutActivityWorker -or
    $AllowLegacyBlueWithoutImageRevision) -and
    $DeploymentTier -ne 'production') {
    throw 'Legacy blue compatibility is production only.'
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
$workerMutationStarted = $false
$candidateServicesStarted = $false
$pointerCommitted = $false
$pointerBackupPath = ''
$workerEvidence = ''
$rolloutPhase = 'locked-preflight'
$originalProcessServiceEnvFile = [Environment]::GetEnvironmentVariable('APP_ENV_FILE')
try {
    $lockHandle = Enter-DeploymentLock -Workspace $workspace `
        -DeploymentTier $DeploymentTier -ProjectName $ProjectName `
        -EvidenceDirectory $evidence
    Assert-DeploymentSourceIdentity -Workspace $workspace `
        -ToolingRelease $ToolingRelease -EvidenceDirectory $evidence
    $env:APP_ENV_FILE = $envPath
    Push-Location $workspace
    $locationPushed = $true

    $previousWorkerImage = Read-EnvValue 'BACKEND_WORKER_IMAGE'
    $previousWorkerRelease = Read-EnvValue 'BACKEND_WORKER_RELEASE'
    $retainedBlueWorkerImage = Read-EnvValue 'BACKEND_WORKER_BLUE_IMAGE'
    $retainedBlueWorkerRelease = Read-EnvValue 'BACKEND_WORKER_BLUE_RELEASE'
    if ($previousWorkerImage -ne $retainedBlueWorkerImage -or
        $previousWorkerRelease -ne $retainedBlueWorkerRelease) {
        throw 'Green rollout requires the proven generic worker pointer to equal retained blue.'
    }
    $legacyBlueOptIn = (
        $AllowLegacyBlueWithoutActivityWorker -or
        $AllowLegacyBlueWithoutImageRevision
    )
    $blueBackendImage = Read-EnvValue 'BACKEND_BLUE_IMAGE'
    $blueBackendRelease = Read-EnvValue 'BACKEND_BLUE_RELEASE'
    $blueFrontendImage = Read-EnvValue 'FRONTEND_BLUE_IMAGE'
    $strictBlueIdentity = (
        $blueBackendImage -match '@sha256:[0-9a-fA-F]{64}$' -and
        $blueFrontendImage -match '@sha256:[0-9a-fA-F]{64}$' -and
        $retainedBlueWorkerImage -match '@sha256:[0-9a-fA-F]{64}$' -and
        $blueBackendRelease -match '^[0-9a-fA-F]{40}$' -and
        $retainedBlueWorkerRelease -match '^[0-9a-fA-F]{40}$'
    )
    $legacyBlueIdentity = (
        $blueBackendImage -match '(@sha256:[0-9a-fA-F]{64}|:[0-9a-fA-F]{7,40})$' -and
        $blueFrontendImage -match '(@sha256:[0-9a-fA-F]{64}|:[0-9a-fA-F]{7,40})$' -and
        $retainedBlueWorkerImage -match '(@sha256:[0-9a-fA-F]{64}|:[0-9a-fA-F]{7,40})$' -and
        $blueBackendRelease -match '^[0-9a-fA-F]{7,40}$' -and
        $retainedBlueWorkerRelease -match '^[0-9a-fA-F]{7,40}$'
    )
    if ((-not $legacyBlueOptIn -and -not $strictBlueIdentity) -or
        ($legacyBlueOptIn -and -not $legacyBlueIdentity)) {
        throw 'Retained blue artifacts require digest/full-release identity unless the production legacy break-glass flags are explicit.'
    }
    if ($blueBackendImage -ne $retainedBlueWorkerImage -or
        $blueBackendRelease -ne $retainedBlueWorkerRelease) {
        throw 'Retained blue API and worker must be the exact same artifact and release for coherent Activity ownership.'
    }
    $previousWorkerImageId = docker image inspect --format '{{.Id}}' $previousWorkerImage
    if ($LASTEXITCODE -ne 0 -or -not "$previousWorkerImageId".Trim()) {
        throw 'The retained blue worker image must already be present locally.'
    }
    $previousWorkerImageId = "$previousWorkerImageId".Trim()

    $initialColor = docker compose @composeFiles --env-file $envPath exec -T nginx `
        cat /etc/nginx/runtime/active-color
    if ($LASTEXITCODE -ne 0 -or "$initialColor".Trim() -ne 'blue') {
        throw 'Green rollout requires the persisted initial route to be blue.'
    }
    docker compose @composeFiles --env-file $envPath exec -T nginx cmp -s `
        /etc/nginx/runtime/active-upstreams.conf /etc/nginx/upstreams/blue.conf
    if ($LASTEXITCODE -ne 0) {
        throw 'Green rollout requires the persisted route to match blue exactly.'
    }
    Assert-NginxUpstreamTemplate -Workspace $workspace -Color blue `
        -EvidenceDirectory $evidence | Out-Null
    @(
        'initial_color=blue'
        "previous_worker_image=$previousWorkerImage"
        "previous_worker_local_image_id=$previousWorkerImageId"
        "previous_worker_release=$previousWorkerRelease"
    ) | Set-Content -Encoding utf8 (Join-Path $evidence 'rollout-baseline.txt')

    $previousActivityCapability = docker image inspect --format `
        '{{ index .Config.Labels "com.maianhomes.capability.activity-worker" }}' `
        $previousWorkerImage
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to inspect retained blue Activity ownership.'
    }
    $previousHasActivityWorker = "$previousActivityCapability".Trim().Equals(
        'true', [StringComparison]::OrdinalIgnoreCase
    )
    if (-not $previousHasActivityWorker -and
        -not $AllowLegacyBlueWithoutActivityWorker) {
        throw 'Retained blue lacks dedicated Activity capability; the explicit production legacy Activity flag is required before mutation.'
    }
    $baselineWorkers = if (
        $previousHasActivityWorker
    ) {
        $allWorkers
    } else {
        @($allWorkers | Where-Object { $_ -ne 'activity-worker' })
    }
    $blueBackendImageId = docker image inspect --format '{{.Id}}' $blueBackendImage
    if ($LASTEXITCODE -ne 0 -or -not "$blueBackendImageId".Trim()) {
        throw 'Retained blue API image must already exist locally.'
    }
    $blueBackendImageId = "$blueBackendImageId".Trim()
    if ($blueBackendImageId -ne $previousWorkerImageId) {
        throw 'Retained blue API and worker references do not resolve to the same local artifact.'
    }
    $blueFrontendImageId = docker image inspect --format '{{.Id}}' $blueFrontendImage
    if ($LASTEXITCODE -ne 0 -or -not "$blueFrontendImageId".Trim()) {
        throw 'Retained blue frontend image must already exist locally.'
    }
    $blueFrontendImageId = "$blueFrontendImageId".Trim()
    $blueBackendRevision = docker image inspect --format `
        '{{ index .Config.Labels "org.opencontainers.image.revision" }}' `
        $blueBackendImage
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to inspect retained blue backend revision.'
    }
    $blueHasRevision = "$blueBackendRevision".Trim() -match '^[0-9a-fA-F]{7,40}$'
    if ($blueHasRevision -and "$blueBackendRevision".Trim() -ne $blueBackendRelease) {
        throw 'Retained blue backend revision does not match BACKEND_BLUE_RELEASE.'
    }
    if (-not $blueHasRevision -and -not $AllowLegacyBlueWithoutImageRevision) {
        throw 'Retained blue backend lacks a revision; the explicit production legacy revision flag is required.'
    }
    $baselineWriterIds = @{}
    $baselineEvidence = @()
    foreach ($baselineService in ($baselineWorkers + @('api1', 'frontend1'))) {
        $baselineIds = @(docker compose @composeFiles --env-file $envPath `
            ps -q $baselineService) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $baselineIds.Count -ne 1) {
            throw "Baseline requires exactly one running $baselineService."
        }
        $baselineId = $baselineIds[0].Trim()
        $baselineImageId = docker inspect --format '{{.Image}}' $baselineId
        $baselineImageExitCode = $LASTEXITCODE
        $baselineState = docker inspect --format '{{.State.Status}}|{{.RestartCount}}' `
            $baselineId
        $baselineStateExitCode = $LASTEXITCODE
        $baselineExpectedImageId = if ($baselineService -eq 'api1') {
            $blueBackendImageId
        } elseif ($baselineService -eq 'frontend1') {
            $blueFrontendImageId
        } else {
            $previousWorkerImageId
        }
        if ($baselineImageExitCode -ne 0 -or
            $baselineStateExitCode -ne 0 -or
            "$baselineImageId".Trim() -ne $baselineExpectedImageId -or
            "$baselineState".Trim() -ne 'running|0') {
            throw "Baseline $baselineService is not stable on its proven image."
        }
        $baselineWriterIds[$baselineService] = $baselineId
        $baselineEvidence += "$baselineService|$baselineId|$($baselineImageId.Trim())|$baselineState"
    }
    if ($baselineWorkers -notcontains 'activity-worker') {
        $baselineActivity = @(docker compose @composeFiles --env-file $envPath `
            ps --status running -q activity-worker) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $baselineActivity.Count -ne 0) {
            throw 'Legacy blue baseline requires zero dedicated Activity workers.'
        }
    }
    $baselineEvidence | Set-Content -Encoding utf8 (
        Join-Path $evidence 'baseline-writer-identities.txt'
    )

    # Candidate API/frontend are part of the same locked transaction. They are
    # started without --wait because full API readiness intentionally lacks
    # only Activity until the ownership handoff completes.
    $greenBackendImage = Read-EnvValue 'BACKEND_GREEN_IMAGE'
    $greenBackendRelease = Read-EnvValue 'BACKEND_GREEN_RELEASE'
    $greenFrontendImage = Read-EnvValue 'FRONTEND_GREEN_IMAGE'
    $greenWorkerImage = Read-EnvValue 'BACKEND_WORKER_GREEN_IMAGE'
    $greenWorkerRelease = Read-EnvValue 'BACKEND_WORKER_GREEN_RELEASE'
    if ($greenBackendImage -notmatch '@sha256:[0-9a-fA-F]{64}$' -or
        $greenFrontendImage -notmatch '@sha256:[0-9a-fA-F]{64}$' -or
        $greenWorkerImage -notmatch '@sha256:[0-9a-fA-F]{64}$' -or
        $greenBackendRelease -notmatch '^[0-9a-fA-F]{40}$' -or
        $greenWorkerRelease -notmatch '^[0-9a-fA-F]{40}$') {
        throw 'Green API/frontend/worker artifacts require digest references and full 40-character releases.'
    }
    if ($greenBackendImage -ne $greenWorkerImage -or
        $greenBackendRelease -ne $greenWorkerRelease) {
        throw 'Green API and worker must be the exact same artifact and release for coherent Activity ownership.'
    }
    $greenBackendImageId = docker image inspect --format '{{.Id}}' $greenBackendImage
    $greenBackendInspectExitCode = $LASTEXITCODE
    $greenFrontendImageId = docker image inspect --format '{{.Id}}' $greenFrontendImage
    $greenFrontendInspectExitCode = $LASTEXITCODE
    if ($greenBackendInspectExitCode -ne 0 -or
        $greenFrontendInspectExitCode -ne 0 -or
        -not "$greenBackendImageId".Trim() -or
        -not "$greenFrontendImageId".Trim()) {
        throw 'Candidate API/frontend images must already exist locally before rollout.'
    }
    $greenBackendImageId = "$greenBackendImageId".Trim()
    $greenFrontendImageId = "$greenFrontendImageId".Trim()
    $greenWorkerImageId = docker image inspect --format '{{.Id}}' $greenWorkerImage
    if ($LASTEXITCODE -ne 0 -or
        "$greenWorkerImageId".Trim() -ne $greenBackendImageId) {
        throw 'Green API and worker references do not resolve to the same local artifact.'
    }
    $greenBackendRevision = docker image inspect --format `
        '{{ index .Config.Labels "org.opencontainers.image.revision" }}' `
        $greenBackendImage
    if ($LASTEXITCODE -ne 0 -or "$greenBackendRevision".Trim() -ne $greenBackendRelease) {
        throw 'Candidate backend local image revision does not match BACKEND_GREEN_RELEASE.'
    }
    $rolloutPhase = 'candidate-api-frontend-start'
    $mutationStarted = $true
    $candidateServicesStarted = $true
    docker compose @composeFiles --env-file $envPath up -d --no-deps `
        --pull never api2 frontend2
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to start candidate API/frontend from their pinned local images.'
    }
    $candidateServiceEvidence = @()
    foreach ($candidateService in @('api2', 'frontend2')) {
        $candidateIds = @(docker compose @composeFiles --env-file $envPath `
            ps -q $candidateService) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $candidateIds.Count -ne 1) {
            throw "Expected exactly one running $candidateService."
        }
        $candidateId = $candidateIds[0].Trim()
        $candidateImageId = docker inspect --format '{{.Image}}' $candidateId
        $candidateImageExitCode = $LASTEXITCODE
        $candidateState = docker inspect --format '{{.State.Status}}|{{.RestartCount}}' `
            $candidateId
        $candidateStateExitCode = $LASTEXITCODE
        $expectedCandidateImageId = if ($candidateService -eq 'api2') {
            $greenBackendImageId
        } else {
            $greenFrontendImageId
        }
        if ($candidateImageExitCode -ne 0 -or $candidateStateExitCode -ne 0 -or
            "$candidateImageId".Trim() -ne $expectedCandidateImageId -or
            "$candidateState".Trim() -ne 'running|0') {
            throw "$candidateService is not a stable exact-image candidate."
        }
        $candidateServiceEvidence += (
            "$candidateService|$candidateId|$($candidateImageId.Trim())|$candidateState"
        )
    }
    $candidateServiceEvidence | Set-Content -Encoding utf8 (
        Join-Path $evidence 'candidate-service-identities.txt'
    )
    docker compose @composeFiles --env-file $envPath exec -T api2 python -c `
        "import json, urllib.request; from app.core.config import settings; payload=json.load(urllib.request.urlopen('http://127.0.0.1:8000/', timeout=10)); assert payload.get('release') == '$greenBackendRelease'; assert payload.get('image_revision') == '$greenBackendRelease'; assert settings.DEPLOYMENT_INSTANCE_ID == '$ProjectName'"
    if ($LASTEXITCODE -ne 0) {
        throw 'Candidate API liveness, release, or deployment-instance identity failed.'
    }
    docker compose @composeFiles --env-file $envPath exec -T frontend2 node -e `
        "fetch('http://127.0.0.1:3000',{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
    if ($LASTEXITCODE -ne 0) {
        throw 'Candidate frontend bounded liveness check failed.'
    }

    $workerEvidence = Join-Path $evidence 'workers-green'
    New-Item -ItemType Directory -Force -Path $workerEvidence | Out-Null
    $workerArguments = @{
        Color = 'green'
        EnvFile = $EnvFile
        DeploymentTier = $DeploymentTier
        ProjectName = $ProjectName
        EvidenceDirectory = $workerEvidence
        ReadinessApiService = 'api1'
        DeploymentLockToken = $lockHandle.Token
        ToolingRelease = $ToolingRelease
    }
    if ($legacyBlueOptIn) {
        $workerArguments.AllowLegacyPreviousWorkerPointer = $true
    }
    & (Join-Path $PSScriptRoot 'deploy-workers.ps1') @workerArguments -PreflightOnly |
        Tee-Object -FilePath (Join-Path $evidence 'worker-preflight.txt')
    $candidateWorkerImageId = (
        Get-Content -LiteralPath (Join-Path $workerEvidence 'selected-image-id.txt') -Raw
    ).Trim()
    if ($candidateWorkerImageId -notmatch '^sha256:[0-9a-fA-F]{64}$') {
        throw 'Worker preflight did not produce a valid pinned local candidate image ID.'
    }
    $workerArguments.ExpectedWorkerImageId = $candidateWorkerImageId

    $rolloutPhase = 'candidate-base-worker-rollout'
    & (Join-Path $PSScriptRoot 'deploy-workers.ps1') @workerArguments |
        Tee-Object -FilePath (Join-Path $evidence 'worker-rollout.txt')
    $workerMutationStarted = Test-Path -LiteralPath (
        Join-Path $workerEvidence 'worker-mutation-started.txt'
    )
    if (-not $workerMutationStarted) {
        throw 'Worker rollout returned without durable mutation-start evidence.'
    }
    $result = Get-Content -LiteralPath (
        Join-Path $workerEvidence 'worker-deployment-result.txt'
    )
    $activityDeferred = $result -contains 'activity_transition_deferred=true'

    $switchEvidence = Join-Path $evidence 'traffic-green'
    New-Item -ItemType Directory -Force -Path $switchEvidence | Out-Null
    $switchArguments = @{
        Color = 'green'
        EnvFile = $EnvFile
        DeploymentTier = $DeploymentTier
        ProjectName = $ProjectName
        DeploymentLockToken = $lockHandle.Token
        ToolingRelease = $ToolingRelease
        EvidenceDirectory = $switchEvidence
        ExpectedWorkerImageId = $candidateWorkerImageId
    }
    if ($activityDeferred) {
        $switchArguments.AllowDeferredActivityWorker = $true
    }
    $rolloutPhase = 'green-route-switch'
    & (Join-Path $PSScriptRoot 'switch-blue-green.ps1') @switchArguments |
        Tee-Object -FilePath (Join-Path $evidence 'traffic-switch.txt')

    if ($activityDeferred) {
        $rolloutPhase = 'legacy-api-quiescence'
        $legacyApiStop = docker compose @composeFiles --env-file $envPath stop api1 2>&1
        $legacyApiStopExitCode = $LASTEXITCODE
        $legacyApiStop | Set-Content -Encoding utf8 (
            Join-Path $evidence 'legacy-api-stop.txt'
        )
        $legacyApiRunning = @(docker compose @composeFiles --env-file $envPath `
            ps --status running -q api1) |
            Where-Object { $_ -and $_.Trim() }
        $legacyApiRunningExitCode = $LASTEXITCODE
        @(
            "stop_exit_code=$legacyApiStopExitCode"
            "running_check_exit_code=$legacyApiRunningExitCode"
            "running_count=$($legacyApiRunning.Count)"
        ) | Set-Content -Encoding utf8 (
            Join-Path $evidence 'legacy-api-stop-verification.txt'
        )
        if ($legacyApiStopExitCode -ne 0 -or
            $legacyApiRunningExitCode -ne 0 -or
            $legacyApiRunning.Count -ne 0) {
            throw 'Legacy blue API could not be stopped and proven zero after route switch.'
        }
        $finalEvidence = Join-Path $evidence 'activity-finalize'
        New-Item -ItemType Directory -Force -Path $finalEvidence | Out-Null
        $rolloutPhase = 'dedicated-activity-finalize'
        & (Join-Path $PSScriptRoot 'deploy-workers.ps1') -Color green `
            -EnvFile $EnvFile -DeploymentTier $DeploymentTier `
            -ProjectName $ProjectName -ReadinessApiService api2 `
            -EvidenceDirectory $finalEvidence `
            -DeploymentLockToken $lockHandle.Token `
            -ToolingRelease $ToolingRelease `
            -ExpectedWorkerImageId $candidateWorkerImageId `
            -AllowLegacyPreviousWorkerPointer:$legacyBlueOptIn `
            -FinalizeDeferredActivityWorker |
            Tee-Object -FilePath (Join-Path $evidence 'activity-finalize.txt')
    }

    $candidateWorkerImage = Read-EnvValue 'BACKEND_WORKER_GREEN_IMAGE'
    $candidateWorkerRelease = Read-EnvValue 'BACKEND_WORKER_GREEN_RELEASE'
    $candidateWorkerIds = @{}
    $pointerCommitEvidence = @()
    foreach ($worker in $allWorkers) {
        $ids = @(docker compose @composeFiles --env-file $envPath ps -q $worker) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $ids.Count -ne 1) {
            throw "Pointer commit requires exactly one running $worker."
        }
        $id = $ids[0].Trim()
        $imageId = docker inspect --format '{{.Image}}' $id
        $imageExitCode = $LASTEXITCODE
        $state = docker inspect --format '{{.State.Status}}|{{.RestartCount}}' $id
        $stateExitCode = $LASTEXITCODE
        if ($imageExitCode -ne 0 -or $stateExitCode -ne 0 -or
            "$imageId".Trim() -ne $candidateWorkerImageId -or
            "$state".Trim() -ne 'running|0') {
            throw "Pointer commit requires stable exact candidate $worker."
        }
        $candidateWorkerIds[$worker] = $id
        $pointerCommitEvidence += "$worker|$id|$($imageId.Trim())|$state"
    }
    $rolloutPhase = 'durable-worker-pointer-commit'
    $pointerBackupPath = Set-WorkerPointersAtomically `
        -Image $candidateWorkerImage -Release $candidateWorkerRelease
    $pointerCommitted = $true
    $env:BACKEND_WORKER_IMAGE = $candidateWorkerImage
    $env:BACKEND_WORKER_RELEASE = $candidateWorkerRelease
    foreach ($worker in $allWorkers) {
        $idsAfterCommit = @(docker compose @composeFiles --env-file $envPath ps -q $worker) |
            Where-Object { $_ -and $_.Trim() }
        $stateAfterCommit = docker inspect --format '{{.State.Status}}|{{.RestartCount}}' `
            $candidateWorkerIds[$worker]
        if ($LASTEXITCODE -ne 0 -or $idsAfterCommit.Count -ne 1 -or
            $idsAfterCommit[0].Trim() -ne $candidateWorkerIds[$worker] -or
            "$stateAfterCommit".Trim() -ne 'running|0') {
            throw "Worker $worker changed during atomic pointer commit."
        }
    }
    $pointerCommitEvidence += "pointer_image=$candidateWorkerImage"
    $pointerCommitEvidence += "pointer_release=$candidateWorkerRelease"
    $pointerCommitEvidence += 'pointer_commit=verified'
    $pointerCommitEvidence | Set-Content -Encoding utf8 (
        Join-Path $evidence 'worker-pointer-commit.txt'
    )
    if ([System.IO.File]::Exists($pointerBackupPath)) {
        [System.IO.File]::Delete($pointerBackupPath)
        $pointerBackupPath = ''
    }
    @(
        'status=success'
        "activity_transition_deferred=$($activityDeferred.ToString().ToLowerInvariant())"
        "candidate_worker_local_image_id=$candidateWorkerImageId"
        'route=green'
        'full_readiness=true'
    ) | Set-Content -Encoding utf8 (Join-Path $evidence 'rollout-result.txt')
    Write-Output "Transactional green rollout completed. Evidence: $evidence"
}
catch {
    $originalError = $_
    if (-not $mutationStarted) { throw }
    if (-not $workerMutationStarted -and $workerEvidence -and
        (Test-Path -LiteralPath (
            Join-Path $workerEvidence 'worker-mutation-started.txt'
        ))) {
        $workerMutationStarted = $true
    }
    if (-not $workerMutationStarted) {
        try {
            if ($candidateServicesStarted) {
                $candidateCleanup = docker compose @composeFiles --env-file $envPath `
                    stop api2 frontend2 2>&1
                $candidateCleanupExitCode = $LASTEXITCODE
                $candidateCleanup | Set-Content -Encoding utf8 (
                    Join-Path $evidence 'candidate-only-cleanup.txt'
                )
                $candidateRunning = @(docker compose @composeFiles --env-file $envPath `
                    ps --status running -q api2 frontend2) |
                    Where-Object { $_ -and $_.Trim() }
                if ($candidateCleanupExitCode -ne 0 -or
                    $LASTEXITCODE -ne 0 -or
                    $candidateRunning.Count -ne 0) {
                    throw 'Candidate-only cleanup could not prove api2/frontend2 stopped.'
                }
            }
            $unchangedRoute = docker compose @composeFiles --env-file $envPath `
                exec -T nginx cat /etc/nginx/runtime/active-color
            if ($LASTEXITCODE -ne 0 -or "$unchangedRoute".Trim() -ne 'blue') {
                throw 'Candidate-only cleanup could not prove the route remained blue.'
            }
            docker compose @composeFiles --env-file $envPath exec -T nginx cmp -s `
                /etc/nginx/runtime/active-upstreams.conf /etc/nginx/upstreams/blue.conf
            if ($LASTEXITCODE -ne 0) {
                throw 'Candidate-only cleanup found an unexpected blue route config.'
            }
            $unchangedEvidence = @()
            foreach ($baselineService in ($baselineWorkers + @('api1', 'frontend1'))) {
                $currentIds = @(docker compose @composeFiles --env-file $envPath `
                    ps -q $baselineService) |
                    Where-Object { $_ -and $_.Trim() }
                $baselineId = $baselineWriterIds[$baselineService]
                $currentState = docker inspect --format `
                    '{{.State.Status}}|{{.RestartCount}}' $baselineId
                if ($LASTEXITCODE -ne 0 -or $currentIds.Count -ne 1 -or
                    $currentIds[0].Trim() -ne $baselineId -or
                    "$currentState".Trim() -ne 'running|0') {
                    throw "Active baseline $baselineService changed before worker mutation."
                }
                $unchangedEvidence += "$baselineService|$baselineId|$currentState"
            }
            if ($baselineWorkers -notcontains 'activity-worker') {
                $legacyActivityRunning = @(docker compose @composeFiles --env-file $envPath `
                    ps --status running -q activity-worker) |
                    Where-Object { $_ -and $_.Trim() }
                if ($LASTEXITCODE -ne 0 -or $legacyActivityRunning.Count -ne 0) {
                    throw 'Legacy Activity ownership changed before worker mutation.'
                }
                $unchangedEvidence += 'activity-worker|absent|legacy-api-embedded'
            }
            @(
                'status=active-blue-unchanged'
                "failed_phase=$rolloutPhase"
                "original_error_type=$($originalError.Exception.GetType().FullName)"
                'candidate_services=stopped-and-zero'
                'route=blue-exact'
                $unchangedEvidence
            ) | Set-Content -Encoding utf8 (
                Join-Path $evidence 'candidate-only-recovery-result.txt'
            )
        }
        catch {
            @(
                'status=unproven'
                "failed_phase=$rolloutPhase"
                "original_error_type=$($originalError.Exception.GetType().FullName)"
                "cleanup_error_type=$($_.Exception.GetType().FullName)"
                'active_writers_were_not_recreated=true'
            ) | Set-Content -Encoding utf8 (
                Join-Path $evidence 'candidate-only-recovery-result.txt'
            )
            throw "Green rollout failed before worker mutation and candidate cleanup could not be proven; active blue writers were not recreated. Evidence: $evidence"
        }
        throw "Green rollout failed during '$rolloutPhase' before worker mutation; candidate services were stopped and the original blue route/API/frontend/workers were proven unchanged. Evidence: $evidence"
    }
    $recoveryProven = $false
    try {
        $recoveryRoute = docker compose @composeFiles --env-file $envPath exec -T `
            nginx cat /etc/nginx/runtime/active-color
        if ($LASTEXITCODE -ne 0 -or "$recoveryRoute".Trim() -notin @('blue', 'green')) {
            throw 'Automatic recovery could not determine a valid persisted route.'
        }
        $recoveryRoute = "$recoveryRoute".Trim()
        docker compose @composeFiles --env-file $envPath exec -T nginx cmp -s `
            /etc/nginx/runtime/active-upstreams.conf `
            "/etc/nginx/upstreams/$recoveryRoute.conf"
        if ($LASTEXITCODE -ne 0) {
            throw 'Automatic recovery found a route marker/config mismatch.'
        }
        $recoveryReadinessApi = if ($recoveryRoute -eq 'blue') { 'api1' } else { 'api2' }
        $blueWorkerEvidence = Join-Path $evidence 'automatic-blue-worker-recovery'
        New-Item -ItemType Directory -Force -Path $blueWorkerEvidence | Out-Null
        $blueWorkerArguments = @{
            Color = 'blue'
            EnvFile = $EnvFile
            DeploymentTier = $DeploymentTier
            ProjectName = $ProjectName
            ReadinessApiService = $recoveryReadinessApi
            EvidenceDirectory = $blueWorkerEvidence
            DeploymentLockToken = $lockHandle.Token
            ToolingRelease = $ToolingRelease
            ExpectedWorkerImageId = $previousWorkerImageId
            TransitionRecovery = $true
        }
        if ($AllowLegacyBlueWithoutActivityWorker) {
            $blueWorkerArguments.AllowLegacyWithoutActivityWorker = $true
        }
        if ($AllowLegacyBlueWithoutImageRevision) {
            $blueWorkerArguments.AllowLegacyWithoutImageRevision = $true
        }
        & (Join-Path $PSScriptRoot 'deploy-workers.ps1') @blueWorkerArguments |
            Tee-Object -FilePath (Join-Path $evidence 'automatic-blue-workers.txt')

        docker compose @composeFiles --env-file $envPath up -d --no-deps `
            --pull never api1 frontend1
        if ($LASTEXITCODE -ne 0) {
            throw 'Unable to restore the retained blue API and frontend locally.'
        }
        $blueSwitchArguments = @{
            Color = 'blue'
            EnvFile = $EnvFile
            DeploymentTier = $DeploymentTier
            ProjectName = $ProjectName
            DeploymentLockToken = $lockHandle.Token
            ToolingRelease = $ToolingRelease
            EvidenceDirectory = (Join-Path $evidence 'automatic-blue-route-recovery')
            ExpectedWorkerImageId = $previousWorkerImageId
        }
        New-Item -ItemType Directory -Force `
            -Path $blueSwitchArguments.EvidenceDirectory | Out-Null
        if ($AllowLegacyBlueWithoutImageRevision) {
            $blueSwitchArguments.AllowLegacyBackendWithoutRevision = $true
        }
        if ($AllowLegacyBlueWithoutActivityWorker) {
            $blueSwitchArguments.AllowLegacyWithoutActivityWorker = $true
        }
        & (Join-Path $PSScriptRoot 'switch-blue-green.ps1') @blueSwitchArguments |
            Tee-Object -FilePath (Join-Path $evidence 'automatic-blue-route.txt')
        $recoveryPointerWorkers = if ($previousHasActivityWorker) {
            $allWorkers
        } else {
            @($allWorkers | Where-Object { $_ -ne 'activity-worker' })
        }
        $recoveryPointerIds = @{}
        foreach ($recoveryPointerWorker in $recoveryPointerWorkers) {
            $recoveryIds = @(docker compose @composeFiles --env-file $envPath `
                ps -q $recoveryPointerWorker) |
                Where-Object { $_ -and $_.Trim() }
            if ($LASTEXITCODE -ne 0 -or $recoveryIds.Count -ne 1) {
                throw "Recovery pointer commit requires one $recoveryPointerWorker."
            }
            $recoveryId = $recoveryIds[0].Trim()
            $recoveryImageId = docker inspect --format '{{.Image}}' $recoveryId
            $recoveryState = docker inspect --format `
                '{{.State.Status}}|{{.RestartCount}}' $recoveryId
            if ($LASTEXITCODE -ne 0 -or
                "$recoveryImageId".Trim() -ne $previousWorkerImageId -or
                "$recoveryState".Trim() -ne 'running|0') {
                throw "Recovery pointer commit found unstable $recoveryPointerWorker."
            }
            $recoveryPointerIds[$recoveryPointerWorker] = $recoveryId
        }
        if (-not $previousHasActivityWorker) {
            $legacyActivity = @(docker compose @composeFiles --env-file $envPath `
                ps --status running -q activity-worker) |
                Where-Object { $_ -and $_.Trim() }
            if ($LASTEXITCODE -ne 0 -or $legacyActivity.Count -ne 0) {
                throw 'Legacy blue recovery pointer commit requires zero Activity workers.'
            }
        }
        $recoveryPointerBackup = Set-WorkerPointersAtomically `
            -Image $previousWorkerImage -Release $previousWorkerRelease `
            -AllowLegacy:$legacyBlueOptIn
        $env:BACKEND_WORKER_IMAGE = $previousWorkerImage
        $env:BACKEND_WORKER_RELEASE = $previousWorkerRelease
        foreach ($recoveryPointerWorker in $recoveryPointerWorkers) {
            $idsAfterRecoveryCommit = @(docker compose @composeFiles --env-file $envPath `
                ps -q $recoveryPointerWorker) |
                Where-Object { $_ -and $_.Trim() }
            $stateAfterRecoveryCommit = docker inspect --format `
                '{{.State.Status}}|{{.RestartCount}}' `
                $recoveryPointerIds[$recoveryPointerWorker]
            if ($LASTEXITCODE -ne 0 -or $idsAfterRecoveryCommit.Count -ne 1 -or
                $idsAfterRecoveryCommit[0].Trim() -ne $recoveryPointerIds[$recoveryPointerWorker] -or
                "$stateAfterRecoveryCommit".Trim() -ne 'running|0') {
                throw "Recovery $recoveryPointerWorker changed during pointer commit."
            }
        }
        if ([System.IO.File]::Exists($recoveryPointerBackup)) {
            [System.IO.File]::Delete($recoveryPointerBackup)
        }
        $pointerCommitted = $false
        $recoveryProven = $true
        @(
            'status=restored'
            "failed_phase=$rolloutPhase"
            "original_error_type=$($originalError.Exception.GetType().FullName)"
            'route=blue'
            'old_api=running-and-ready'
            'old_workers=exact-and-ready'
            'worker_pointer=retained-blue'
        ) | Set-Content -Encoding utf8 (
            Join-Path $evidence 'automatic-recovery-result.txt'
        )
    }
    catch {
        if ($recoveryProven) { throw }
        $recoveryError = $_
        $emergencyServices = $allWorkers + @('api1', 'api2')
        $emergencyStop = docker compose @composeFiles --env-file $envPath `
            stop @emergencyServices 2>&1
        $emergencyStopExitCode = $LASTEXITCODE
        $emergencyStop | Set-Content -Encoding utf8 (
            Join-Path $evidence 'emergency-consumer-stop.txt'
        )
        $runningConsumers = @(docker compose @composeFiles --env-file $envPath `
            ps --status running -q @emergencyServices) |
            Where-Object { $_ -and $_.Trim() }
        $runningCheckExitCode = $LASTEXITCODE
        @(
            "failed_phase=$rolloutPhase"
            "original_error_type=$($originalError.Exception.GetType().FullName)"
            "recovery_error_type=$($recoveryError.Exception.GetType().FullName)"
            "stop_exit_code=$emergencyStopExitCode"
            "running_check_exit_code=$runningCheckExitCode"
            "running_writer_count=$($runningConsumers.Count)"
        ) | Set-Content -Encoding utf8 (
            Join-Path $evidence 'automatic-recovery-result.txt'
        )
        if ($emergencyStopExitCode -ne 0 -or
            $runningCheckExitCode -ne 0 -or
            $runningConsumers.Count -ne 0) {
            $preserveDeploymentLock = $true
            throw "Green rollout failed during '$rolloutPhase'; automatic recovery failed and zero running writers could not be proven. Isolate writes immediately. Evidence: $evidence"
        }
        throw "Green rollout failed during '$rolloutPhase'; automatic recovery failed. Both APIs and every queue worker were stopped and proven zero. Evidence: $evidence"
    }
    if ($recoveryProven) {
        throw "Green rollout failed during '$rolloutPhase'; the retained blue route, API, workers, and durable pointer were restored and verified. Evidence: $evidence"
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
