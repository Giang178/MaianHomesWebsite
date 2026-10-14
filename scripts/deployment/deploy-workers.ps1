param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('blue', 'green')]
    [string]$Color,
    [string]$EnvFile = '.env.production',
    [ValidateSet('production', 'staging')]
    [string]$DeploymentTier = 'production',
    [string]$ProjectName = '',
    [string]$EvidenceDirectory = '',
    [string]$ReadinessApiService = '',
    [switch]$AllowLegacyWithoutActivityWorker,
    [switch]$AllowLegacyWithoutImageRevision,
    [switch]$PreflightOnly,
    [switch]$FinalizeDeferredActivityWorker,
    [string]$DeploymentLockToken = '',
    [string]$ExpectedWorkerImageId = '',
    [string]$ToolingRelease = '',
    [switch]$TransitionRecovery,
    [switch]$AllowLegacyPreviousWorkerPointer
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$pinnedWorkerImageId = $ExpectedWorkerImageId
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$envPath = (Resolve-Path (Join-Path $workspace $EnvFile)).Path
$overlayFile = Join-Path $workspace "docker-compose.$DeploymentTier.yml"
$lockScript = Join-Path $PSScriptRoot 'deployment-lock.ps1'
$sourceGuardScript = Join-Path $PSScriptRoot 'deployment-source-guard.ps1'
. $lockScript
. $sourceGuardScript
$composeFiles = @()
if ($ProjectName) {
    $composeFiles += @('--project-name', $ProjectName)
}
$composeFiles += @(
    '-f', (Join-Path $workspace 'docker-compose.yml'),
    '-f', $overlayFile
)
$activityCapabilityLabel = 'com.maianhomes.capability.activity-worker'
$imageRevisionLabel = 'org.opencontainers.image.revision'
$baseWorkers = @('content-worker', 'system-monitor-worker')
$allWorkers = @('activity-worker') + $baseWorkers
$workers = $allWorkers
$mutationStarted = $false
$preserveDeploymentLock = $false
$workerDeploymentPhase = 'locked-preflight'
if ($AllowLegacyWithoutActivityWorker -and $Color -ne 'blue') {
    throw 'Legacy activity-worker compatibility is allowed only for an explicit blue rollback.'
}
if ($AllowLegacyWithoutImageRevision -and $Color -ne 'blue') {
    throw 'A legacy image without a baked revision is allowed only for an explicit blue rollback.'
}
if (($AllowLegacyWithoutActivityWorker -or $AllowLegacyWithoutImageRevision) -and
    $DeploymentTier -ne 'production') {
    throw 'Legacy worker compatibility is production-blue rollback only.'
}
if ($AllowLegacyPreviousWorkerPointer -and
    ($Color -ne 'green' -or $DeploymentTier -ne 'production' -or
     -not $DeploymentLockToken)) {
    throw 'A legacy previous-worker recovery pointer is allowed only inside the locked production green-rollout orchestrator.'
}
if (-not $PreflightOnly -and -not $DeploymentLockToken) {
    throw 'Worker mutation is orchestration-only and requires a verified deployment-lock token; standalone use is preflight-only.'
}
if (-not $ProjectName) {
    throw 'ProjectName is required so the script cannot target an inferred Compose project.'
}
if ($FinalizeDeferredActivityWorker -and $Color -ne 'green') {
    throw 'Deferred Activity activation is supported only for the explicit green transition.'
}
if ($FinalizeDeferredActivityWorker -and -not $DeploymentLockToken) {
    throw 'Deferred Activity activation requires the verified rollout deployment-lock token.'
}
if ($FinalizeDeferredActivityWorker -and -not $pinnedWorkerImageId) {
    throw 'Deferred Activity activation requires the candidate image ID pinned before rollout mutation.'
}
if ($TransitionRecovery -and -not $DeploymentLockToken) {
    throw 'TransitionRecovery requires the verified orchestration lock.'
}
if (-not $ReadinessApiService) {
    $ReadinessApiService = if ($FinalizeDeferredActivityWorker) {
        if ($Color -eq 'green') { 'api2' } else { 'api1' }
    } else {
        if ($Color -eq 'green') { 'api1' } else { 'api2' }
    }
}
if ($ReadinessApiService -notin @('api1', 'api2')) {
    throw 'ReadinessApiService must be api1 or api2.'
}
$variableName = 'BACKEND_WORKER_{0}_IMAGE' -f $Color.ToUpperInvariant()
$releaseVariableName = 'BACKEND_WORKER_{0}_RELEASE' -f $Color.ToUpperInvariant()

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

function Test-ImmutableImageReference([string]$Image) {
    return (
        $Image -match '@sha256:[0-9a-fA-F]{64}$' -or
        $Image -match ':[0-9a-fA-F]{7,40}$'
    )
}

function Test-DigestImageReference([string]$Image) {
    return $Image -match '@sha256:[0-9a-fA-F]{64}$'
}

$configuredTier = Read-EnvFileValue 'DEPLOYMENT_TIER'
if ($configuredTier -ne $DeploymentTier) {
    throw "DEPLOYMENT_TIER in $EnvFile must equal the explicit DeploymentTier '$DeploymentTier'."
}
$configuredInstance = Read-EnvFileValue 'DEPLOYMENT_INSTANCE_ID'
if ($configuredInstance -ne $ProjectName) {
    throw "DEPLOYMENT_INSTANCE_ID in $EnvFile must equal the exact ProjectName '$ProjectName'."
}

$workerImage = Read-EnvValue $variableName
if (-not $workerImage) {
    throw "$variableName must be configured."
}
$selectedLegacyOptIn = (
    $Color -eq 'blue' -and
    ($AllowLegacyWithoutActivityWorker -or $AllowLegacyWithoutImageRevision)
)
if ((-not $selectedLegacyOptIn -and -not (Test-DigestImageReference $workerImage)) -or
    ($selectedLegacyOptIn -and -not (Test-ImmutableImageReference $workerImage))) {
    throw "$variableName must use an immutable digest; only an explicitly authorized legacy blue rollback may use a commit-SHA tag."
}

# Capture the last operator-approved generic pointer as resolved from the
# process/environment file before overriding Compose with the candidate.
$originalProcessWorkerImage = [Environment]::GetEnvironmentVariable('BACKEND_WORKER_IMAGE')
$originalProcessWorkerRelease = [Environment]::GetEnvironmentVariable('BACKEND_WORKER_RELEASE')
$originalProcessServiceEnvFile = [Environment]::GetEnvironmentVariable('APP_ENV_FILE')
$previousWorkerImage = Read-EnvValue 'BACKEND_WORKER_IMAGE'
$previousWorkerRelease = Read-EnvValue 'BACKEND_WORKER_RELEASE'
if ((-not $AllowLegacyPreviousWorkerPointer -and
     -not (Test-DigestImageReference $previousWorkerImage)) -or
    ($AllowLegacyPreviousWorkerPointer -and
     -not (Test-ImmutableImageReference $previousWorkerImage))) {
    throw 'BACKEND_WORKER_IMAGE must use a digest; only the locked legacy-blue transition may use a commit-SHA tag.'
}
if ((-not $AllowLegacyPreviousWorkerPointer -and
     $previousWorkerRelease -notmatch '^[0-9a-fA-F]{40}$') -or
    ($AllowLegacyPreviousWorkerPointer -and
     $previousWorkerRelease -notmatch '^[0-9a-fA-F]{7,40}$')) {
    throw 'BACKEND_WORKER_RELEASE must identify the previously proven worker revision.'
}
$workerRelease = Read-EnvValue $releaseVariableName
if ((-not $selectedLegacyOptIn -and $workerRelease -notmatch '^[0-9a-fA-F]{40}$') -or
    ($selectedLegacyOptIn -and $workerRelease -notmatch '^[0-9a-fA-F]{7,40}$')) {
    throw "$releaseVariableName must be the immutable Git revision baked into the worker image."
}
$backendVariableName = 'BACKEND_{0}_IMAGE' -f $Color.ToUpperInvariant()
$backendReleaseVariableName = 'BACKEND_{0}_RELEASE' -f $Color.ToUpperInvariant()
$backendImage = Read-EnvValue $backendVariableName
$backendRelease = Read-EnvValue $backendReleaseVariableName
if ($backendImage -ne $workerImage -or $backendRelease -ne $workerRelease) {
    throw "$backendVariableName/$backendReleaseVariableName must exactly match the worker artifact and release for single-owner Activity handoff."
}

if (-not $EvidenceDirectory) {
    $EvidenceDirectory = Join-Path $workspace (
        '.release-artifacts/workers-{0}-{1}' -f $Color, (Get-Date -Format 'yyyyMMdd-HHmmss')
    )
}
New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null
$workerMutationMarker = Join-Path $EvidenceDirectory 'worker-mutation-started.txt'
$lockHandle = $null
$locationPushed = $false
try {
    $lockHandle = Enter-DeploymentLock -Workspace $workspace `
        -DeploymentTier $DeploymentTier -ProjectName $ProjectName `
        -ExistingToken $DeploymentLockToken -EvidenceDirectory $EvidenceDirectory
    Assert-DeploymentSourceIdentity -Workspace $workspace `
        -ToolingRelease $ToolingRelease -EvidenceDirectory $EvidenceDirectory
    Push-Location $workspace
    $locationPushed = $true
    $env:BACKEND_WORKER_IMAGE = $workerImage
    $env:BACKEND_WORKER_RELEASE = $workerRelease
    $env:APP_ENV_FILE = $envPath
    # Green is fetched exactly once before mutation. Blue rollback is
    # registry-independent and must already exist locally. A later transition
    # phase supplies the image ID pinned by the first phase.
    if ($pinnedWorkerImageId) {
        $imageAcquisitionMode = 'pinned-local-image-id'
    } elseif ($Color -eq 'green') {
        $candidatePull = docker compose @composeFiles --env-file $envPath pull content-worker 2>&1
        $candidatePullExitCode = $LASTEXITCODE
        $candidatePull |
            Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'candidate-image-pull.txt')
        if ($candidatePullExitCode -ne 0) {
            throw 'Unable to pull the immutable green worker image before mutation.'
        }
        $imageAcquisitionMode = 'single-preflight-pull'
    } else {
        $imageAcquisitionMode = 'retained-local-blue-no-registry'
    }
    $resolvedWorkerImageId = docker image inspect --format '{{.Id}}' $workerImage
    if ($LASTEXITCODE -ne 0 -or -not "$resolvedWorkerImageId".Trim()) {
        throw 'Unable to resolve the selected worker image locally before mutation.'
    }
    $resolvedWorkerImageId = "$resolvedWorkerImageId".Trim()
    $resolvedBackendImageId = docker image inspect --format '{{.Id}}' $backendImage
    if ($LASTEXITCODE -ne 0 -or
        "$resolvedBackendImageId".Trim() -ne $resolvedWorkerImageId) {
        throw 'The selected API and worker references do not resolve to the same local artifact.'
    }
    if ($pinnedWorkerImageId -and $resolvedWorkerImageId -ne $pinnedWorkerImageId) {
        throw 'The selected worker reference no longer resolves to the image ID pinned before mutation.'
    }
    $resolvedWorkerImageId |
        Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'selected-image-id.txt')
    @(
        "image=$workerImage"
        "local_image_id=$resolvedWorkerImageId"
        "acquisition_mode=$imageAcquisitionMode"
    ) | Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'worker-image-resolution.txt')
    $activityCapability = docker image inspect --format "{{ index .Config.Labels `"$activityCapabilityLabel`" }}" $workerImage
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect worker image capabilities.' }
    $bakedRevision = docker image inspect --format "{{ index .Config.Labels `"$imageRevisionLabel`" }}" $workerImage
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect the worker image revision.' }
    $bakedRevision = "$bakedRevision".Trim()
    $hasBakedRevision = $bakedRevision -match '^[0-9a-fA-F]{7,40}$'
    if ($hasBakedRevision -and $bakedRevision -ne $workerRelease) {
        throw "$releaseVariableName does not match $imageRevisionLabel on $variableName."
    }
    if (-not $hasBakedRevision -and (-not $AllowLegacyWithoutImageRevision -or $Color -ne 'blue')) {
        throw "Worker image lacks a valid $imageRevisionLabel. Only an explicitly authorized blue rollback may use this legacy image."
    }
    $hasActivityWorker = "$activityCapability".Trim().Equals('true', [StringComparison]::OrdinalIgnoreCase)
    $legacyMode = -not $hasActivityWorker
    $mode = if ($legacyMode) { 'legacy-blue-without-dedicated-activity-worker' } else { 'dedicated-activity-worker' }
    @(
        "image=$workerImage"
        "capability_label=$activityCapabilityLabel"
        "capability_value=$activityCapability"
        "revision_label=$imageRevisionLabel"
        "revision_label_value=$bakedRevision"
        "configured_release=$workerRelease"
        "deployment_tier=$DeploymentTier"
        "compose_project=$ProjectName"
        "mode=$mode"
        "legacy_opt_in=$($AllowLegacyWithoutActivityWorker.IsPresent.ToString().ToLowerInvariant())"
        "legacy_revision_opt_in=$($AllowLegacyWithoutImageRevision.IsPresent.ToString().ToLowerInvariant())"
        "preflight_only=$($PreflightOnly.IsPresent.ToString().ToLowerInvariant())"
        "api_worker_artifact_coherent=true"
        "api_local_image_id=$($resolvedBackendImageId.Trim())"
    ) | Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'worker-capability.txt')
    if ($legacyMode -and (-not $AllowLegacyWithoutActivityWorker -or $Color -ne 'blue')) {
        throw "Worker image lacks $activityCapabilityLabel=true. Only an explicitly authorized blue rollback may use this legacy image."
    }

    # Validate the candidate image against the real secret-managed environment
    # before stopping or recreating any singleton queue consumer. The container
    # has no network, imports settings only, and cannot touch MongoDB/Redis/S3.
    # A retained blue image can predate the validator module, so its explicitly
    # authorized legacy path uses an inline, redacted Settings import instead.
    if ($hasBakedRevision) {
        $settingsPreflight = docker run --rm --network none --env-file $envPath `
            --env "APP_RELEASE=$workerRelease" --entrypoint python $workerImage `
            -m scripts.validate_runtime_settings 2>&1
    } else {
        $legacyPreflightCode = @'
import json
import os

try:
    from app.core.config import settings
except Exception as exc:
    print(json.dumps({"settings": "invalid", "error_type": type(exc).__name__}, sort_keys=True))
    raise SystemExit(2)

environment = str(getattr(settings, "ENVIRONMENT", "")).strip().lower()
if environment != "production":
    print(json.dumps({"settings": "invalid", "error_type": "LegacyEnvironmentMismatch"}, sort_keys=True))
    raise SystemExit(2)

expected_tier = os.environ.get("EXPECTED_DEPLOYMENT_TIER", "")
configured_tier = str(getattr(settings, "DEPLOYMENT_TIER", expected_tier)).strip().lower()
if configured_tier != expected_tier:
    print(json.dumps({"settings": "invalid", "error_type": "LegacyDeploymentTierMismatch"}, sort_keys=True))
    raise SystemExit(2)

print(json.dumps({
    "settings": "valid",
    "environment": environment,
    "deployment_tier": configured_tier,
    "release": getattr(settings, "APP_RELEASE", "legacy"),
    "image_revision": "",
    "legacy_image": True,
}, sort_keys=True))
'@
        $settingsPreflight = docker run --rm --network none --env-file $envPath `
            --env "APP_RELEASE=$workerRelease" `
            --env "EXPECTED_DEPLOYMENT_TIER=$DeploymentTier" `
            --entrypoint python $workerImage `
            -c $legacyPreflightCode 2>&1
    }
    $settingsExitCode = $LASTEXITCODE
    $settingsPreflight | Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'worker-settings-preflight.txt')
    if ($settingsExitCode -ne 0) {
        throw 'Candidate worker settings preflight failed; no running worker was changed.'
    }
    try {
        $settingsPayload = $settingsPreflight |
            Select-Object -Last 1 |
            ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw 'Candidate worker settings preflight returned no valid redacted JSON; no running worker was changed.'
    }
    if ($settingsPayload.settings -ne 'valid' -or
        "$($settingsPayload.environment)".ToLowerInvariant() -ne 'production' -or
        $settingsPayload.deployment_tier -ne $DeploymentTier) {
        throw 'Candidate worker settings identity does not match the selected deployment tier; no running worker was changed.'
    }

    # Preflight the exact generic recovery pointer before any worker mutation.
    # It must already be local; recovery never contacts the registry.
    $previousWorkerImageId = docker image inspect --format '{{.Id}}' $previousWorkerImage
    if ($LASTEXITCODE -ne 0 -or -not "$previousWorkerImageId".Trim()) {
        throw 'Previously proven BACKEND_WORKER_IMAGE is not present locally; no worker was changed.'
    }
    $previousWorkerImageId = "$previousWorkerImageId".Trim()
    $previousActivityCapability = docker image inspect --format "{{ index .Config.Labels `"$activityCapabilityLabel`" }}" $previousWorkerImage
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to inspect the previous worker activity capability; no worker was changed.'
    }
    $previousBakedRevision = docker image inspect --format "{{ index .Config.Labels `"$imageRevisionLabel`" }}" $previousWorkerImage
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to inspect the previous worker revision; no worker was changed.'
    }
    $previousBakedRevision = "$previousBakedRevision".Trim()
    $previousHasBakedRevision = $previousBakedRevision -match '^[0-9a-fA-F]{7,40}$'
    if ($previousHasBakedRevision -and $previousBakedRevision -ne $previousWorkerRelease) {
        throw 'Previously proven BACKEND_WORKER_RELEASE does not match its local image revision.'
    }
    if (-not $previousHasBakedRevision -and -not $AllowLegacyPreviousWorkerPointer) {
        throw 'The previous recovery image lacks a revision and was not explicitly authorized by the locked legacy-blue rollout.'
    }
    $previousHasActivityWorker = "$previousActivityCapability".Trim().Equals(
        'true', [StringComparison]::OrdinalIgnoreCase
    )
    if ($previousHasBakedRevision) {
        $previousSettingsPreflight = docker run --rm --network none --env-file $envPath `
            --env "APP_RELEASE=$previousWorkerRelease" --entrypoint python $previousWorkerImage `
            -m scripts.validate_runtime_settings 2>&1
    } else {
        $previousLegacyPreflightCode = @'
import json
import os

try:
    from app.core.config import settings
except Exception as exc:
    print(json.dumps({"settings": "invalid", "error_type": type(exc).__name__}, sort_keys=True))
    raise SystemExit(2)

environment = str(getattr(settings, "ENVIRONMENT", "")).strip().lower()
if environment != "production":
    print(json.dumps({"settings": "invalid", "error_type": "LegacyEnvironmentMismatch"}, sort_keys=True))
    raise SystemExit(2)
expected_tier = os.environ.get("EXPECTED_DEPLOYMENT_TIER", "")
configured_tier = str(getattr(settings, "DEPLOYMENT_TIER", expected_tier)).strip().lower()
if configured_tier != expected_tier:
    print(json.dumps({"settings": "invalid", "error_type": "LegacyDeploymentTierMismatch"}, sort_keys=True))
    raise SystemExit(2)
print(json.dumps({
    "settings": "valid",
    "environment": environment,
    "deployment_tier": configured_tier,
    "legacy_image": True,
}, sort_keys=True))
'@
        $previousSettingsPreflight = docker run --rm --network none --env-file $envPath `
            --env "APP_RELEASE=$previousWorkerRelease" `
            --env "EXPECTED_DEPLOYMENT_TIER=$DeploymentTier" `
            --entrypoint python $previousWorkerImage `
            -c $previousLegacyPreflightCode 2>&1
    }
    $previousSettingsExitCode = $LASTEXITCODE
    $previousSettingsPreflight |
        Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'previous-worker-settings-preflight.txt')
    if ($previousSettingsExitCode -ne 0) {
        throw 'Previous worker recovery-target settings preflight failed; no worker was changed.'
    }
    try {
        $previousSettingsPayload = $previousSettingsPreflight |
            Select-Object -Last 1 |
            ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw 'Previous worker recovery-target preflight returned invalid redacted JSON; no worker was changed.'
    }
    if ($previousSettingsPayload.settings -ne 'valid' -or
        "$($previousSettingsPayload.environment)".ToLowerInvariant() -ne 'production' -or
        $previousSettingsPayload.deployment_tier -ne $DeploymentTier) {
        throw 'Previous worker recovery-target identity is invalid; no worker was changed.'
    }
    @(
        "image=$previousWorkerImage"
        "local_image_id=$previousWorkerImageId"
        "configured_release=$previousWorkerRelease"
        "capability_value=$previousActivityCapability"
        "revision_label_value=$previousBakedRevision"
        "activity_semantics=$(if ($previousHasActivityWorker) { 'dedicated' } else { 'legacy-api-embedded' })"
        "registry_dependency=none-after-mutation"
    ) | Set-Content -Encoding utf8 (
        Join-Path $EvidenceDirectory 'previous-worker-recovery-target.txt'
    )

    # A generic pointer is recoverable only when it exactly describes the
    # worker set that is running before mutation. Reject stale, prematurely
    # updated, or mixed pointers.
    if ($FinalizeDeferredActivityWorker -or $TransitionRecovery) {
        @(
            "state=$(if ($FinalizeDeferredActivityWorker) { 'deferred-transition' } else { 'orchestrated-inverse-transition' })"
            'generic_pointer_is_retained_rollback_target'
            'live_prestate_proof=held-by-transactional-orchestrator-under-the-same-lock'
        ) | Set-Content -Encoding utf8 (
            Join-Path $EvidenceDirectory 'previous-worker-live-snapshot.txt'
        )
    } else {
        $previousRunningWorkers = if ($previousHasActivityWorker) {
            $allWorkers
        } else {
            $baseWorkers
        }
        $previousLiveEvidence = @()
        foreach ($previousRunningWorker in $previousRunningWorkers) {
        $previousIds = @(docker compose @composeFiles --env-file $envPath `
            ps -q $previousRunningWorker) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $previousIds.Count -ne 1) {
            throw "Previous worker pointer does not describe exactly one running $previousRunningWorker."
        }
        $previousId = $previousIds[0].Trim()
        $previousLiveImageId = docker inspect --format '{{.Image}}' $previousId
        $previousLiveImageExitCode = $LASTEXITCODE
        $previousLiveState = docker inspect --format '{{.State.Status}}|{{.RestartCount}}' `
            $previousId
        $previousLiveStateExitCode = $LASTEXITCODE
        if ($previousLiveImageExitCode -ne 0 -or
            $previousLiveStateExitCode -ne 0 -or
            "$previousLiveImageId".Trim() -ne $previousWorkerImageId -or
            "$previousLiveState".Trim() -ne 'running|0') {
            throw "Previous worker pointer does not match stable live $previousRunningWorker."
        }
            $previousLiveEvidence += (
                "$previousRunningWorker|$previousId|$($previousLiveImageId.Trim())|$previousLiveState"
            )
        }
        if (-not $previousHasActivityWorker) {
            $previousActivityRunning = @(docker compose @composeFiles --env-file $envPath `
                ps --status running -q activity-worker) |
                Where-Object { $_ -and $_.Trim() }
            if ($LASTEXITCODE -ne 0 -or $previousActivityRunning.Count -ne 0) {
                throw 'Legacy previous ownership requires zero running dedicated Activity workers.'
            }
            $previousLiveEvidence += 'activity-worker|stopped|legacy-api-embedded'
        }
        $previousLiveEvidence | Set-Content -Encoding utf8 (
            Join-Path $EvidenceDirectory 'previous-worker-live-snapshot.txt'
        )
    }

    # Derive the serving API from persisted routing rather than trusting a
    # caller-selected ReadinessApiService.
    $expectedActiveColor = if ($FinalizeDeferredActivityWorker) {
        $Color
    } elseif ($TransitionRecovery) {
        if ($ReadinessApiService -eq 'api1') { 'blue' } else { 'green' }
    } elseif ($Color -eq 'green') {
        'blue'
    } else {
        'green'
    }
    $expectedReadinessApi = if ($expectedActiveColor -eq 'blue') { 'api1' } else { 'api2' }
    if ($ReadinessApiService -ne $expectedReadinessApi) {
        throw 'ReadinessApiService does not match the persisted active color required for this phase.'
    }
    $activeColorBeforeMutation = docker compose @composeFiles --env-file $envPath `
        exec -T nginx cat /etc/nginx/runtime/active-color
    if ($LASTEXITCODE -ne 0 -or
        "$activeColorBeforeMutation".Trim() -ne $expectedActiveColor) {
        throw 'Persisted active color does not match the requested worker transition phase.'
    }
    docker compose @composeFiles --env-file $envPath exec -T nginx cmp -s `
        /etc/nginx/runtime/active-upstreams.conf `
        "/etc/nginx/upstreams/$expectedActiveColor.conf"
    if ($LASTEXITCODE -ne 0) {
        throw 'Persisted active route does not match its approved upstream template.'
    }

    # Never infer Activity ownership from an env-file that cannot change an
    # already-running legacy API. Probe the serving process itself. Any missing
    # attribute, import error, or true value forces the deferred transition.
    $activityOwnershipCode = @'
import json
try:
    from app.core.config import settings
    value = getattr(settings, "ACTIVITY_EMBEDDED_JOBS", None)
    print(json.dumps({"activity_embedded_jobs": value}, sort_keys=True))
except Exception as exc:
    print(json.dumps({
        "activity_embedded_jobs": None,
        "error_type": type(exc).__name__,
    }, sort_keys=True))
    raise SystemExit(2)
'@
    $ownershipOutput = docker compose @composeFiles --env-file $envPath exec -T `
        $ReadinessApiService python -c $activityOwnershipCode 2>&1
    $ownershipExitCode = $LASTEXITCODE
    $ownershipOutput |
        Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'active-api-activity-ownership.txt')
    $externalActivityOwnershipProven = $false
    if ($ownershipExitCode -eq 0) {
        try {
            $ownershipPayload = $ownershipOutput |
                Select-Object -Last 1 |
                ConvertFrom-Json -ErrorAction Stop
            $externalActivityOwnershipProven = (
                $ownershipPayload.activity_embedded_jobs -eq $false
            )
        }
        catch {
            $externalActivityOwnershipProven = $false
        }
    }
    $deferredActivityTransition = (
        $hasActivityWorker -and
        -not $FinalizeDeferredActivityWorker -and
        -not $externalActivityOwnershipProven
    )
    $mode = if ($FinalizeDeferredActivityWorker) {
        'finalize-deferred-activity-worker'
    } elseif ($legacyMode) {
        'legacy-blue-without-dedicated-activity-worker'
    } elseif ($deferredActivityTransition) {
        'dedicated-activity-worker-deferred-until-legacy-api-stops'
    } else {
        'dedicated-activity-worker'
    }
    @(
        "mode=$mode"
        "activity_transition_deferred=$($deferredActivityTransition.ToString().ToLowerInvariant())"
        "active_api_external_activity_ownership_proven=$($externalActivityOwnershipProven.ToString().ToLowerInvariant())"
        "deployment_instance_id=$ProjectName"
    ) | Add-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'worker-capability.txt')

    if ($FinalizeDeferredActivityWorker -or
        ($TransitionRecovery -and $ReadinessApiService -eq 'api2')) {
        $transitionExpectedApiRelease = if ($FinalizeDeferredActivityWorker) {
            $workerRelease
        } elseif ($ReadinessApiService -eq 'api2') {
            Read-EnvValue 'BACKEND_GREEN_RELEASE'
        } else {
            Read-EnvValue 'BACKEND_BLUE_RELEASE'
        }
        $transitionReadinessCode = @'
import json
import os
import urllib.error
import urllib.request
try:
    response = urllib.request.urlopen("http://127.0.0.1:8000/health/ready", timeout=10)
    payload = json.load(response)
except urllib.error.HTTPError as exc:
    payload = json.load(exc)
assert payload.get("release") == os.environ["EXPECTED_RELEASE"]
assert payload.get("image_revision") == os.environ["EXPECTED_RELEASE"]
assert payload.get("deployment_tier") == os.environ["EXPECTED_TIER"]
assert payload.get("deployment_instance_id") == os.environ["EXPECTED_INSTANCE"]
checks = payload.get("checks")
assert isinstance(checks, dict)
for worker in ("content-worker", "system-monitor-worker"):
    assert checks.get(worker) == "ok"
failures = sorted(
    key for key, value in checks.items()
    if not key.endswith("_metrics") and value != "ok"
)
assert all(key == "activity-worker" for key in failures)
assert checks.get("activity-worker") in {"ok", "failed"}
print(json.dumps(payload, sort_keys=True))
'@
        $liveTierPreflight = docker compose @composeFiles --env-file $envPath exec -T `
            --env "EXPECTED_RELEASE=$transitionExpectedApiRelease" `
            --env "EXPECTED_TIER=$DeploymentTier" `
            --env "EXPECTED_INSTANCE=$ProjectName" $ReadinessApiService `
            python -c $transitionReadinessCode 2>&1
    } else {
        $liveTierPreflight = docker compose @composeFiles --env-file $envPath exec -T `
            $ReadinessApiService python -c "import json, urllib.request; expected='$DeploymentTier'; payload=json.load(urllib.request.urlopen('http://127.0.0.1:8000/health/ready', timeout=10)); reported=payload.get('deployment_tier'); assert payload.get('status') == 'ready'; assert reported == expected or (expected == 'production' and reported is None); print(json.dumps({'status': payload.get('status'), 'deployment_tier': reported or 'legacy-production'}, sort_keys=True))"
    }
    $liveTierExitCode = $LASTEXITCODE
    $liveTierPreflight |
        Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'live-tier-preflight.txt')
    if ($liveTierExitCode -ne 0) {
        throw 'Selected Compose project/tier readiness preflight failed; no running worker was changed.'
    }

    if ($FinalizeDeferredActivityWorker) {
        $targetApi = if ($Color -eq 'green') { 'api2' } else { 'api1' }
        $retiredApi = if ($Color -eq 'green') { 'api1' } else { 'api2' }
        if ($ReadinessApiService -ne $targetApi) {
            throw 'FinalizeDeferredActivityWorker must probe the API for the selected color.'
        }
        $persistedColor = docker compose @composeFiles --env-file $envPath exec -T nginx `
            cat /etc/nginx/runtime/active-color
        if ($LASTEXITCODE -ne 0 -or "$persistedColor".Trim() -ne $Color) {
            throw 'Deferred Activity activation requires persisted candidate routing.'
        }
        docker compose @composeFiles --env-file $envPath exec -T nginx cmp -s `
            /etc/nginx/runtime/active-upstreams.conf "/etc/nginx/upstreams/$Color.conf"
        if ($LASTEXITCODE -ne 0) {
            throw 'Deferred Activity activation requires exact persisted candidate routing.'
        }
        $retiredApiRunning = @(docker compose @composeFiles --env-file $envPath `
            ps --status running -q $retiredApi) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $retiredApiRunning.Count -ne 0) {
            throw 'Deferred Activity activation requires the legacy API stopped and proven zero.'
        }
        $activityRunning = @(docker compose @composeFiles --env-file $envPath `
            ps --status running -q activity-worker) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $activityRunning.Count -ne 0) {
            throw 'Deferred Activity activation requires zero running dedicated Activity workers.'
        }
        $transitionHosts = @{}
        $transitionContainerIds = @{}
        $transitionEvidence = @()
        foreach ($baseWorker in $baseWorkers) {
            $ids = @(docker compose @composeFiles --env-file $envPath ps -q $baseWorker) |
                Where-Object { $_ -and $_.Trim() }
            if ($LASTEXITCODE -ne 0 -or $ids.Count -ne 1) {
                throw "Deferred Activity activation requires exactly one $baseWorker."
            }
            $id = $ids[0].Trim()
            $imageId = docker inspect --format '{{.Image}}' $id
            $state = docker inspect --format '{{.State.Status}}|{{.RestartCount}}' $id
            if ($LASTEXITCODE -ne 0 -or
                "$imageId".Trim() -ne $resolvedWorkerImageId -or
                "$state".Trim() -ne 'running|0') {
                throw "Deferred Activity activation requires stable candidate $baseWorker."
            }
            $hostname = docker compose @composeFiles --env-file $envPath exec -T $baseWorker hostname
            if ($LASTEXITCODE -ne 0 -or -not "$hostname".Trim()) {
                throw "Unable to identify candidate $baseWorker before Activity activation."
            }
            $transitionHosts[$baseWorker] = "$hostname".Trim()
            $transitionContainerIds[$baseWorker] = $id
            $transitionEvidence += "$baseWorker|$id|$($transitionHosts[$baseWorker])|$state"
        }
        $transitionEvidence | Set-Content -Encoding utf8 (
            Join-Path $EvidenceDirectory 'activity-transition-base-container-identities.txt'
        )
        $transitionHeartbeatArguments = @(
            'python', '-m', 'scripts.verify_worker_heartbeats',
            '--expected-release', $workerRelease,
            '--expected-tier', $DeploymentTier,
            '--expected-instance', $ProjectName,
            '--timeout-seconds', '90'
        )
        foreach ($baseWorker in $baseWorkers) {
            $transitionHeartbeatArguments += @(
                '--expect', "$baseWorker=$($transitionHosts[$baseWorker])"
            )
        }
        $transitionHeartbeat = docker compose @composeFiles --env-file $envPath exec -T `
            content-worker @transitionHeartbeatArguments 2>&1
        $transitionHeartbeatExitCode = $LASTEXITCODE
        $transitionHeartbeat | Set-Content -Encoding utf8 (
            Join-Path $EvidenceDirectory 'activity-transition-base-heartbeats.txt'
        )
        if ($transitionHeartbeatExitCode -ne 0) {
            throw 'Candidate base-worker heartbeat proof failed before Activity activation.'
        }
        foreach ($baseWorker in $baseWorkers) {
            $stableIds = @(docker compose @composeFiles --env-file $envPath ps -q $baseWorker) |
                Where-Object { $_ -and $_.Trim() }
            $stableState = docker inspect --format '{{.State.Status}}|{{.RestartCount}}' `
                $transitionContainerIds[$baseWorker]
            if ($LASTEXITCODE -ne 0 -or $stableIds.Count -ne 1 -or
                $stableIds[0].Trim() -ne $transitionContainerIds[$baseWorker] -or
                "$stableState".Trim() -ne 'running|0') {
                throw "Candidate $baseWorker changed during transition preflight."
            }
        }
        @(
            "persisted_color=$($persistedColor.Trim())"
            "retired_api=$retiredApi"
            "retired_api_running_count=$($retiredApiRunning.Count)"
            "activity_worker_running_count=$($activityRunning.Count)"
            "base_workers_exact=true"
        ) | Set-Content -Encoding utf8 (
            Join-Path $EvidenceDirectory 'activity-transition-finalize-preflight.txt'
        )
    }
    if ($PreflightOnly) {
        Write-Output "Worker preflight passed for $Color ($mode). Evidence: $EvidenceDirectory"
        return
    }

    if ($legacyMode -or $deferredActivityTransition) {
        # The service is singleton across blue/green. Stop the newer dedicated
        # consumer before legacy embedded ownership or a deferred transition.
        $activityBeforeStop = docker compose @composeFiles --env-file $envPath images activity-worker
        if ($LASTEXITCODE -ne 0) { throw 'Unable to capture the dedicated Activity worker image before stop.' }
        $activityBeforeStop |
            Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'activity-worker-before-stop.txt')
        $workerDeploymentPhase = 'activity-worker-stop'
        [System.IO.File]::WriteAllText(
            "$workerMutationMarker.tmp",
            "phase=$workerDeploymentPhase`n",
            [System.Text.UTF8Encoding]::new($false)
        )
        [System.IO.File]::Move("$workerMutationMarker.tmp", $workerMutationMarker)
        $mutationStarted = $true
        docker compose @composeFiles --env-file $envPath stop activity-worker
        if ($LASTEXITCODE -ne 0) { throw 'Unable to stop the dedicated Activity worker.' }
        $activityStillRunning = @(docker compose @composeFiles --env-file $envPath `
            ps --status running -q activity-worker) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $activityStillRunning.Count -ne 0) {
            throw 'Dedicated Activity worker is still running after the required stop.'
        }
        $activityAfterStop = docker compose @composeFiles --env-file $envPath ps --all activity-worker
        if ($LASTEXITCODE -ne 0) { throw 'Unable to verify the dedicated Activity worker stopped state.' }
        $activityAfterStop |
            Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'activity-worker-stopped.txt')
        $workers = $baseWorkers
    }

    $workersToRecreate = if ($FinalizeDeferredActivityWorker) {
        @('activity-worker')
    } else {
        $workers
    }
    if ($FinalizeDeferredActivityWorker) {
        $workers = $allWorkers
    }
    $workerDeploymentPhase = 'worker-recreate'
    if (-not $mutationStarted) {
        [System.IO.File]::WriteAllText(
            "$workerMutationMarker.tmp",
            "phase=$workerDeploymentPhase`n",
            [System.Text.UTF8Encoding]::new($false)
        )
        [System.IO.File]::Move("$workerMutationMarker.tmp", $workerMutationMarker)
        $mutationStarted = $true
    }
    docker compose @composeFiles --env-file $envPath up -d --no-deps `
        --force-recreate --pull never @workersToRecreate
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to recreate workers from the pinned local image.'
    }

    Start-Sleep -Seconds 2
    $workerDeploymentPhase = 'exact-container-heartbeat-verification'
    $workerContainerIds = @{}
    $workerHostnames = @{}
    $containerEvidence = @()
    foreach ($worker in $workers) {
        $containerIds = @(docker compose @composeFiles --env-file $envPath ps -q $worker) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $containerIds.Count -ne 1) {
            throw "Expected exactly one $worker container after recreation."
        }
        $containerId = $containerIds[0].Trim()
        $runningImageId = docker inspect --format '{{.Image}}' $containerId
        if ($LASTEXITCODE -ne 0 -or "$runningImageId".Trim() -ne $resolvedWorkerImageId) {
            throw "$worker is not running the selected immutable worker image."
        }
        $containerState = docker inspect --format '{{.State.Status}}|{{.RestartCount}}' $containerId
        if ($LASTEXITCODE -ne 0 -or "$containerState".Trim() -ne 'running|0') {
            throw "$worker is not stable after recreation."
        }
        $hostname = docker compose @composeFiles --env-file $envPath exec -T $worker hostname
        if ($LASTEXITCODE -ne 0 -or -not "$hostname".Trim()) {
            throw "Unable to capture the exact $worker container hostname."
        }
        $workerContainerIds[$worker] = $containerId
        $workerHostnames[$worker] = "$hostname".Trim()
        $containerEvidence += "$worker|$containerId|$($workerHostnames[$worker])|$containerState"
    }
    $containerEvidence |
        Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'worker-container-identities.txt')

    if ($hasBakedRevision) {
        $heartbeatArguments = @(
            'python', '-m', 'scripts.verify_worker_heartbeats',
            '--expected-release', $workerRelease,
            '--expected-tier', $DeploymentTier,
            '--expected-instance', $ProjectName,
            '--timeout-seconds', '90'
        )
        foreach ($worker in $workers) {
            $heartbeatArguments += @('--expect', "$worker=$($workerHostnames[$worker])")
        }
        $heartbeatEvidence = docker compose @composeFiles --env-file $envPath exec -T `
            content-worker @heartbeatArguments 2>&1
    } else {
        $legacyHeartbeatCode = @'
import asyncio
import json
import os
import re
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def verify():
    expectations = json.loads(os.environ["EXPECTED_WORKER_HOSTS"])
    client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        tz_aware=True,
        serverSelectionTimeoutMS=5000,
    )
    collection = client[settings.DATABASE_NAME]["system_worker_heartbeats"]
    deadline = asyncio.get_running_loop().time() + 90
    try:
        while True:
            cutoff = datetime.now(timezone.utc) - timedelta(
                seconds=int(getattr(settings, "WORKER_HEARTBEAT_MAX_AGE_SECONDS", 120))
            )
            missing = []
            verified = []
            for worker_name, hostname in expectations.items():
                heartbeat = await collection.find_one({
                    "worker_name": worker_name,
                    "instance_id": {"$regex": "^" + re.escape(hostname) + "-"},
                    "status": "running",
                    "updated_at": {"$gte": cutoff},
                })
                if heartbeat:
                    verified.append({
                        "worker_name": worker_name,
                        "instance_id": str(heartbeat["instance_id"]),
                    })
                else:
                    missing.append(worker_name)
            if not missing:
                print(json.dumps({"status": "valid", "legacy_image": True, "workers": verified}, sort_keys=True))
                return 0
            if asyncio.get_running_loop().time() >= deadline:
                print(json.dumps({"status": "invalid", "error_type": "WorkerHeartbeatTimeout", "missing_workers": sorted(missing)}, sort_keys=True))
                return 2
            await asyncio.sleep(2)
    except Exception as exc:
        print(json.dumps({"status": "invalid", "error_type": type(exc).__name__}, sort_keys=True))
        return 2
    finally:
        client.close()

raise SystemExit(asyncio.run(verify()))
'@
        $heartbeatHostsJson = $workerHostnames | ConvertTo-Json -Compress
        $heartbeatEvidence = docker compose @composeFiles --env-file $envPath exec -T `
            --env "EXPECTED_WORKER_HOSTS=$heartbeatHostsJson" content-worker `
            python -c $legacyHeartbeatCode 2>&1
    }
    $heartbeatExitCode = $LASTEXITCODE
    $heartbeatEvidence |
        Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'worker-heartbeat-identities.txt')
    if ($heartbeatExitCode -ne 0) {
        throw 'Exact post-recreate worker heartbeat identity verification failed.'
    }

    foreach ($worker in $workers) {
        $currentContainerIds = @(docker compose @composeFiles --env-file $envPath ps -q $worker) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or
            $currentContainerIds.Count -ne 1 -or
            $currentContainerIds[0].Trim() -ne $workerContainerIds[$worker]) {
            throw "$worker container changed during heartbeat verification."
        }
        $containerState = docker inspect --format '{{.State.Status}}|{{.RestartCount}}' `
            $workerContainerIds[$worker]
        if ($LASTEXITCODE -ne 0 -or "$containerState".Trim() -ne 'running|0') {
            throw "$worker restarted or became unstable during heartbeat verification."
        }
    }

    $workerDeploymentPhase = 'full-readiness-verification'
    $finalIdentityAssertions = if ($FinalizeDeferredActivityWorker) {
        "assert payload.get('release') == '$workerRelease'; assert payload.get('image_revision') == '$workerRelease'; assert payload.get('deployment_tier') == '$DeploymentTier'; assert payload.get('deployment_instance_id') == '$ProjectName';"
    } else {
        "reported=payload.get('deployment_tier'); assert reported == '$DeploymentTier' or ('$DeploymentTier' == 'production' and reported is None);"
    }
    if ($TransitionRecovery) {
        @(
            'status=deferred'
            'reason=blue-api-not-yet-started-during-inverse-activity-transition'
            'bounded_full_readiness_gate=required-by-orchestrator-before-route-switch'
        ) | Set-Content -Encoding utf8 (
            Join-Path $EvidenceDirectory 'worker-full-readiness.txt'
        )
    } else {
        docker compose @composeFiles --env-file $envPath exec -T $ReadinessApiService python -c "import json, urllib.request; payload=json.load(urllib.request.urlopen('http://127.0.0.1:8000/health/ready', timeout=10)); assert payload.get('status') == 'ready'; $finalIdentityAssertions"
        if ($LASTEXITCODE -ne 0) { throw 'Worker heartbeat or queue readiness check failed.' }
    }
    docker compose @composeFiles --env-file $envPath images @workers |
        Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'worker-images.txt')
    $workerImage | Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'selected-image.txt')
    @(
        "status=success"
        "mode=$mode"
        "activity_transition_deferred=$($deferredActivityTransition.ToString().ToLowerInvariant())"
        "local_image_id=$resolvedWorkerImageId"
        "registry_dependency_after_mutation=none"
    ) | Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'worker-deployment-result.txt')
    Write-Output "Workers switched to $Color ($workerImage, $mode). Evidence: $EvidenceDirectory"
}
catch {
    $originalError = $_
    if (-not $mutationStarted) { throw }

    if ($FinalizeDeferredActivityWorker) {
        $recoveryTargetImage = $workerImage
        $recoveryTargetImageId = $resolvedWorkerImageId
        $recoveryTargetRelease = $workerRelease
        $recoveryTargetHasRevision = $hasBakedRevision
        $recoveryTargetHasActivity = $false
        $recoveryMode = 'deferred-transition-base-workers'
    } else {
        $recoveryTargetImage = $previousWorkerImage
        $recoveryTargetImageId = $previousWorkerImageId
        $recoveryTargetRelease = $previousWorkerRelease
        $recoveryTargetHasRevision = $previousHasBakedRevision
        $recoveryTargetHasActivity = $previousHasActivityWorker
        $recoveryMode = if ($previousHasActivityWorker) {
            'dedicated'
        } else {
            'legacy-api-embedded'
        }
    }

    @(
        "status=started"
        "original_error_type=$($originalError.Exception.GetType().FullName)"
        "failed_phase=$workerDeploymentPhase"
        "recovery_image=$recoveryTargetImage"
        "recovery_local_image_id=$recoveryTargetImageId"
        "recovery_release=$recoveryTargetRelease"
        "recovery_mode=$recoveryMode"
        "registry_dependency=none"
    ) | Set-Content -Encoding utf8 (
        Join-Path $EvidenceDirectory 'worker-automatic-recovery.txt'
    )
    $automaticRecoveryProven = $false
    try {
        $env:BACKEND_WORKER_IMAGE = $recoveryTargetImage
        $env:BACKEND_WORKER_RELEASE = $recoveryTargetRelease
        $recoveryWorkers = if ($recoveryTargetHasActivity) {
            $allWorkers
        } else {
            $baseWorkers
        }
        if (-not $recoveryTargetHasActivity) {
            $recoveryActivityStop = docker compose @composeFiles --env-file $envPath `
                stop activity-worker 2>&1
            $recoveryActivityStopExitCode = $LASTEXITCODE
            $recoveryActivityStop | Set-Content -Encoding utf8 (
                Join-Path $EvidenceDirectory 'worker-recovery-legacy-activity-stop.txt'
            )
            $recoveryActivityRunning = @(docker compose @composeFiles --env-file $envPath `
                ps --status running -q activity-worker) |
                Where-Object { $_ -and $_.Trim() }
            if ($recoveryActivityStopExitCode -ne 0 -or
                $LASTEXITCODE -ne 0 -or
                $recoveryActivityRunning.Count -ne 0) {
                throw 'Recovery could not prove legacy Activity-worker semantics.'
            }
        }
        if (-not $FinalizeDeferredActivityWorker) {
            docker compose @composeFiles --env-file $envPath up -d --no-deps `
                --force-recreate --pull never @recoveryWorkers
            if ($LASTEXITCODE -ne 0) {
                throw 'Unable to recreate the previous worker set from its pinned local image.'
            }
        }
        Start-Sleep -Seconds 2
        $recoveryContainerIds = @{}
        $recoveryHostnames = @{}
        $recoveryContainerEvidence = @()
        foreach ($recoveryWorker in $recoveryWorkers) {
            $ids = @(docker compose @composeFiles --env-file $envPath ps -q $recoveryWorker) |
                Where-Object { $_ -and $_.Trim() }
            if ($LASTEXITCODE -ne 0 -or $ids.Count -ne 1) {
                throw "Recovery expected exactly one $recoveryWorker container."
            }
            $id = $ids[0].Trim()
            $imageId = docker inspect --format '{{.Image}}' $id
            $state = docker inspect --format '{{.State.Status}}|{{.RestartCount}}' $id
            if ($LASTEXITCODE -ne 0 -or
                "$imageId".Trim() -ne $recoveryTargetImageId -or
                "$state".Trim() -ne 'running|0') {
                throw "Recovery did not restore a stable exact-image $recoveryWorker."
            }
            $hostname = docker compose @composeFiles --env-file $envPath exec -T `
                $recoveryWorker hostname
            if ($LASTEXITCODE -ne 0 -or -not "$hostname".Trim()) {
                throw "Recovery could not identify $recoveryWorker."
            }
            $recoveryContainerIds[$recoveryWorker] = $id
            $recoveryHostnames[$recoveryWorker] = "$hostname".Trim()
            $recoveryContainerEvidence += "$recoveryWorker|$id|$($recoveryHostnames[$recoveryWorker])|$state"
        }
        $recoveryContainerEvidence | Set-Content -Encoding utf8 (
            Join-Path $EvidenceDirectory 'worker-recovery-container-identities.txt'
        )
        if ($recoveryTargetHasRevision) {
            $recoveryHeartbeatArguments = @(
                'python', '-m', 'scripts.verify_worker_heartbeats',
                '--expected-release', $recoveryTargetRelease,
                '--expected-tier', $DeploymentTier,
                '--expected-instance', $ProjectName,
                '--timeout-seconds', '90'
            )
            foreach ($recoveryWorker in $recoveryWorkers) {
                $recoveryHeartbeatArguments += @(
                    '--expect', "$recoveryWorker=$($recoveryHostnames[$recoveryWorker])"
                )
            }
            $recoveryHeartbeatEvidence = docker compose @composeFiles --env-file $envPath `
                exec -T content-worker @recoveryHeartbeatArguments 2>&1
        } else {
            $recoveryLegacyHeartbeatCode = @'
import asyncio
import json
import os
import re
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def verify():
    expected = json.loads(os.environ["EXPECTED_WORKER_HOSTS"])
    client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        tz_aware=True,
        serverSelectionTimeoutMS=5000,
    )
    collection = client[settings.DATABASE_NAME]["system_worker_heartbeats"]
    deadline = asyncio.get_running_loop().time() + 90
    try:
        while True:
            cutoff = datetime.now(timezone.utc) - timedelta(
                seconds=int(getattr(settings, "WORKER_HEARTBEAT_MAX_AGE_SECONDS", 120))
            )
            missing = []
            verified = []
            for worker_name, hostname in expected.items():
                item = await collection.find_one({
                    "worker_name": worker_name,
                    "instance_id": {"$regex": "^" + re.escape(hostname) + "-"},
                    "status": "running",
                    "updated_at": {"$gte": cutoff},
                })
                if item:
                    verified.append({
                        "worker_name": worker_name,
                        "instance_id": str(item["instance_id"]),
                        "compatibility_scope": "exact-container-hostname",
                    })
                else:
                    missing.append(worker_name)
            if not missing:
                print(json.dumps({
                    "status": "valid",
                    "legacy_image": True,
                    "deployment_instance_compatibility": "exact-container-hostname",
                    "workers": verified,
                }, sort_keys=True))
                return 0
            if asyncio.get_running_loop().time() >= deadline:
                print(json.dumps({
                    "status": "invalid",
                    "error_type": "WorkerHeartbeatTimeout",
                    "missing_workers": sorted(missing),
                }, sort_keys=True))
                return 2
            await asyncio.sleep(2)
    except Exception as exc:
        print(json.dumps({
            "status": "invalid",
            "error_type": type(exc).__name__,
        }, sort_keys=True))
        return 2
    finally:
        client.close()

raise SystemExit(asyncio.run(verify()))
'@
            $recoveryHostsJson = $recoveryHostnames | ConvertTo-Json -Compress
            $recoveryHeartbeatEvidence = docker compose @composeFiles --env-file $envPath `
                exec -T --env "EXPECTED_WORKER_HOSTS=$recoveryHostsJson" content-worker `
                python -c $recoveryLegacyHeartbeatCode 2>&1
        }
        $recoveryHeartbeatExitCode = $LASTEXITCODE
        $recoveryHeartbeatEvidence | Set-Content -Encoding utf8 (
            Join-Path $EvidenceDirectory 'worker-recovery-heartbeats.txt'
        )
        if ($recoveryHeartbeatExitCode -ne 0) {
            throw 'Recovery exact fresh-heartbeat verification failed.'
        }
        foreach ($recoveryWorker in $recoveryWorkers) {
            $stableIds = @(docker compose @composeFiles --env-file $envPath `
                ps -q $recoveryWorker) |
                Where-Object { $_ -and $_.Trim() }
            $stableState = docker inspect --format '{{.State.Status}}|{{.RestartCount}}' `
                $recoveryContainerIds[$recoveryWorker]
            if ($LASTEXITCODE -ne 0 -or $stableIds.Count -ne 1 -or
                $stableIds[0].Trim() -ne $recoveryContainerIds[$recoveryWorker] -or
                "$stableState".Trim() -ne 'running|0') {
                throw "Recovery $recoveryWorker changed during heartbeat verification."
            }
        }
        if (-not $FinalizeDeferredActivityWorker) {
            $recoveryReadiness = docker compose @composeFiles --env-file $envPath exec -T `
                $ReadinessApiService python -c "import json, urllib.request; payload=json.load(urllib.request.urlopen('http://127.0.0.1:8000/health/ready', timeout=10)); assert payload.get('status') == 'ready'; print(json.dumps(payload, sort_keys=True))" 2>&1
            $recoveryReadinessExitCode = $LASTEXITCODE
            $recoveryReadiness | Set-Content -Encoding utf8 (
                Join-Path $EvidenceDirectory 'worker-recovery-readiness.txt'
            )
            if ($recoveryReadinessExitCode -ne 0) {
                throw 'Recovery readiness verification failed.'
            }
        }
        @(
            "status=restored"
            "original_error_type=$($originalError.Exception.GetType().FullName)"
            "failed_phase=$workerDeploymentPhase"
            "recovery_image=$recoveryTargetImage"
            "recovery_local_image_id=$recoveryTargetImageId"
            "recovery_release=$recoveryTargetRelease"
            "recovery_mode=$recoveryMode"
            "recovered_worker_count=$($recoveryWorkers.Count)"
            "exact_container_and_heartbeat_verification=true"
            "readiness=$(if ($FinalizeDeferredActivityWorker) { 'deferred-to-rollout-orchestrator' } else { 'ready' })"
            "registry_dependency=none"
        ) | Set-Content -Encoding utf8 (
            Join-Path $EvidenceDirectory 'worker-automatic-recovery.txt'
        )
        $automaticRecoveryProven = $true
        throw [InvalidOperationException]::new(
            "Worker deployment failed during '$workerDeploymentPhase'; automatic recovery restored and verified the previous worker set. Evidence: $EvidenceDirectory",
            $originalError.Exception
        )
    }
    catch {
        if ($automaticRecoveryProven) {
            throw
        }
        $recoveryError = $_
        $emergencyWriters = $allWorkers + @('api1', 'api2')
        $stopOutput = docker compose @composeFiles --env-file $envPath `
            stop @emergencyWriters 2>&1
        $stopExitCode = $LASTEXITCODE
        $stopOutput |
            Set-Content -Encoding utf8 (Join-Path $EvidenceDirectory 'worker-emergency-stop.txt')
        $runningWorkers = @(docker compose @composeFiles --env-file $envPath `
            ps --status running -q @emergencyWriters) |
            Where-Object { $_ -and $_.Trim() }
        $runningCheckExitCode = $LASTEXITCODE
        @(
            "stop_exit_code=$stopExitCode"
            "running_check_exit_code=$runningCheckExitCode"
            "running_writer_count=$($runningWorkers.Count)"
            $runningWorkers
        ) | Set-Content -Encoding utf8 (
            Join-Path $EvidenceDirectory 'worker-emergency-stop-verification.txt'
        )
        @(
            "status=failed"
            "original_error_type=$($originalError.Exception.GetType().FullName)"
            "failed_phase=$workerDeploymentPhase"
            "recovery_error_type=$($recoveryError.Exception.GetType().FullName)"
            "emergency_stop_exit_code=$stopExitCode"
            "running_check_exit_code=$runningCheckExitCode"
            "running_writer_count=$($runningWorkers.Count)"
        ) | Set-Content -Encoding utf8 (
            Join-Path $EvidenceDirectory 'worker-automatic-recovery.txt'
        )
        if ($stopExitCode -ne 0 -or
            $runningCheckExitCode -ne 0 -or
            $runningWorkers.Count -ne 0) {
            $preserveDeploymentLock = $true
            throw [InvalidOperationException]::new(
                "Worker deployment failed during '$workerDeploymentPhase'; automatic recovery failed and zero running queue consumers could not be proven. Isolate writes immediately. Evidence: $EvidenceDirectory",
                $originalError.Exception
            )
        }
        throw [InvalidOperationException]::new(
            "Worker deployment failed during '$workerDeploymentPhase'; automatic recovery failed. Both APIs and all queue workers were stopped and zero writers were verified. Evidence: $EvidenceDirectory",
            $originalError.Exception
        )
    }
}
finally {
    if ($null -eq $originalProcessWorkerImage) {
        Remove-Item Env:BACKEND_WORKER_IMAGE -ErrorAction SilentlyContinue
    } else {
        $env:BACKEND_WORKER_IMAGE = $originalProcessWorkerImage
    }
    if ($null -eq $originalProcessWorkerRelease) {
        Remove-Item Env:BACKEND_WORKER_RELEASE -ErrorAction SilentlyContinue
    } else {
        $env:BACKEND_WORKER_RELEASE = $originalProcessWorkerRelease
    }
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
