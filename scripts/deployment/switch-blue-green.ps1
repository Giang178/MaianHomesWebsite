param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("blue", "green")]
    [string]$Color,
    [string]$EnvFile = ".env.production",
    [ValidateSet("production", "staging")]
    [string]$DeploymentTier = "production",
    [string]$ProjectName = "",
    [switch]$AllowLegacyBackendWithoutRevision,
    [switch]$AllowLegacyWithoutActivityWorker,
    [switch]$AllowDeferredActivityWorker,
    [string]$DeploymentLockToken = "",
    [string]$ExpectedWorkerImageId = "",
    [string]$ToolingRelease = "",
    [string]$EvidenceDirectory = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$lockScript = Join-Path $PSScriptRoot 'deployment-lock.ps1'
$sourceGuardScript = Join-Path $PSScriptRoot 'deployment-source-guard.ps1'
. $lockScript
. $sourceGuardScript
$overlayFile = Join-Path $workspace "docker-compose.$DeploymentTier.yml"
$composeFiles = @()
if ($ProjectName) {
    $composeFiles += @("--project-name", $ProjectName)
}
$composeFiles += @(
    "-f", (Join-Path $workspace "docker-compose.yml"),
    "-f", $overlayFile
)
$envPath = (Resolve-Path (Join-Path $workspace $EnvFile)).Path
$apiService = if ($Color -eq "blue") { "api1" } else { "api2" }
$frontendService = if ($Color -eq "blue") { "frontend1" } else { "frontend2" }
$imageSuffix = $Color.ToUpperInvariant()
$revisionLabel = 'org.opencontainers.image.revision'
$baseWorkers = @('content-worker', 'system-monitor-worker')
$allWorkers = @('activity-worker') + $baseWorkers

if ($AllowLegacyBackendWithoutRevision -and $Color -ne 'blue') {
    throw 'A legacy backend without a baked revision is allowed only for an explicit blue rollback.'
}
if ($AllowLegacyBackendWithoutRevision -and $DeploymentTier -ne 'production') {
    throw 'A legacy backend without a baked revision is production-blue rollback only.'
}
if ($AllowLegacyWithoutActivityWorker -and
    ($Color -ne 'blue' -or $DeploymentTier -ne 'production')) {
    throw 'Legacy embedded Activity ownership is production-blue rollback only.'
}
if ($AllowDeferredActivityWorker -and $Color -ne 'green') {
    throw 'Deferred Activity readiness is allowed only for the explicit green transition.'
}
if ($AllowDeferredActivityWorker -and
    (-not $DeploymentLockToken -or
     $ExpectedWorkerImageId -notmatch '^sha256:[0-9a-fA-F]{64}$')) {
    throw 'Deferred Activity route switching is orchestration-only and requires the verified lock plus the worker image ID pinned before mutation.'
}
if (($AllowLegacyWithoutActivityWorker -or $AllowLegacyBackendWithoutRevision) -and
    (-not $DeploymentLockToken -or -not $ExpectedWorkerImageId)) {
    throw 'Legacy blue route switching is orchestration-only and requires the verified lock plus the retained worker image ID.'
}
if (-not $ProjectName) {
    throw 'ProjectName is required so the script cannot target an inferred Compose project.'
}
if (-not $EvidenceDirectory) {
    $EvidenceDirectory = Join-Path $workspace (
        '.release-artifacts/switch-{0}-{1}' -f $Color, (Get-Date -Format 'yyyyMMdd-HHmmss')
    )
}
New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null

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

$configuredTier = Read-EnvFileValue 'DEPLOYMENT_TIER'
if ($configuredTier -ne $DeploymentTier) {
    throw "DEPLOYMENT_TIER in $EnvFile must equal the explicit DeploymentTier '$DeploymentTier'."
}
$configuredInstance = Read-EnvFileValue 'DEPLOYMENT_INSTANCE_ID'
if ($configuredInstance -ne $ProjectName) {
    throw "DEPLOYMENT_INSTANCE_ID in $EnvFile must equal the exact ProjectName '$ProjectName'."
}

$backendImageVariable = "BACKEND_${imageSuffix}_IMAGE"
$frontendImageVariable = "FRONTEND_${imageSuffix}_IMAGE"
$backendReleaseVariable = "BACKEND_${imageSuffix}_RELEASE"
$workerImageVariable = "BACKEND_WORKER_${imageSuffix}_IMAGE"
$workerReleaseVariable = "BACKEND_WORKER_${imageSuffix}_RELEASE"
$legacyTarget = (
    $Color -eq 'blue' -and
    ($AllowLegacyBackendWithoutRevision -or $AllowLegacyWithoutActivityWorker)
)
foreach ($variableName in @($backendImageVariable, $frontendImageVariable)) {
    $image = Read-EnvValue $variableName
    if ((-not $legacyTarget -and
         $image -notmatch '@sha256:[0-9a-fA-F]{64}$') -or
        ($legacyTarget -and
         $image -notmatch '(@sha256:[0-9a-fA-F]{64}|:[0-9a-fA-F]{7,40})$')) {
        throw "$variableName must use an immutable digest; only explicit production-blue legacy recovery may use a commit-SHA tag."
    }
}
$backendImage = Read-EnvValue $backendImageVariable
$frontendImage = Read-EnvValue $frontendImageVariable
$backendRelease = Read-EnvValue $backendReleaseVariable
$workerImage = Read-EnvValue $workerImageVariable
$workerRelease = Read-EnvValue $workerReleaseVariable
if ((-not $legacyTarget -and $backendRelease -notmatch '^[0-9a-fA-F]{40}$') -or
    ($legacyTarget -and $backendRelease -notmatch '^[0-9a-fA-F]{7,40}$')) {
    throw "$backendReleaseVariable must be the immutable Git revision baked into the backend image."
}
if ($backendImage -ne $workerImage -or $backendRelease -ne $workerRelease) {
    throw 'Target API and worker must be the exact same configured artifact and release for coherent Activity ownership.'
}

$lockHandle = $null
$locationPushed = $false
$routeMutationStarted = $false
$routeMutationVerified = $false
$preserveDeploymentLock = $false
$originalProcessServiceEnvFile = [Environment]::GetEnvironmentVariable('APP_ENV_FILE')
try {
    $lockHandle = Enter-DeploymentLock -Workspace $workspace `
        -DeploymentTier $DeploymentTier -ProjectName $ProjectName `
        -ExistingToken $DeploymentLockToken -EvidenceDirectory $EvidenceDirectory
    Assert-DeploymentSourceIdentity -Workspace $workspace `
        -ToolingRelease $ToolingRelease -EvidenceDirectory $EvidenceDirectory
    $env:APP_ENV_FILE = $envPath
    Push-Location $workspace
    $locationPushed = $true
    docker compose @composeFiles --env-file $envPath ps $apiService $frontendService nginx
    if ($LASTEXITCODE -ne 0) { throw "Unable to inspect the target color." }

    $expectedBackendImageId = docker image inspect --format '{{.Id}}' $backendImage
    if ($LASTEXITCODE -ne 0) { throw "Unable to inspect $backendImageVariable." }
    $expectedBackendImageId = "$expectedBackendImageId".Trim()
    $expectedFrontendImageId = docker image inspect --format '{{.Id}}' $frontendImage
    if ($LASTEXITCODE -ne 0) { throw "Unable to inspect $frontendImageVariable." }
    $expectedFrontendImageId = "$expectedFrontendImageId".Trim()
    $resolvedWorkerImageId = docker image inspect --format '{{.Id}}' $workerImage
    if ($LASTEXITCODE -ne 0 -or
        "$resolvedWorkerImageId".Trim() -ne $expectedBackendImageId) {
        throw 'Target API and worker references do not resolve to the same local artifact.'
    }
    $resolvedWorkerImageId = "$resolvedWorkerImageId".Trim()
    if ($ExpectedWorkerImageId -and
        ($ExpectedWorkerImageId -notmatch '^sha256:[0-9a-fA-F]{64}$' -or
         $resolvedWorkerImageId -ne $ExpectedWorkerImageId)) {
        throw 'The target worker reference differs from the image ID pinned by the orchestrator.'
    }
    $activityCapability = docker image inspect --format `
        '{{ index .Config.Labels "com.maianhomes.capability.activity-worker" }}' `
        $workerImage
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to inspect the target Activity-worker capability.'
    }
    $hasActivityWorker = "$activityCapability".Trim().Equals(
        'true', [StringComparison]::OrdinalIgnoreCase
    )
    $bakedRevision = docker image inspect --format "{{ index .Config.Labels `"$revisionLabel`" }}" $backendImage
    if ($LASTEXITCODE -ne 0) { throw "Unable to inspect $revisionLabel on $backendImageVariable." }
    $bakedRevision = "$bakedRevision".Trim()
    $hasBakedRevision = $bakedRevision -match '^[0-9a-fA-F]{7,40}$'
    if ($hasBakedRevision -and $bakedRevision -ne $backendRelease) {
        throw "$backendReleaseVariable does not match $revisionLabel on $backendImageVariable."
    }
    if (-not $hasBakedRevision -and (-not $AllowLegacyBackendWithoutRevision -or $Color -ne 'blue')) {
        throw "Backend image lacks a valid $revisionLabel. Only an explicitly authorized blue rollback may use this legacy image."
    }
    if (-not $hasActivityWorker -and
        (-not $AllowLegacyWithoutActivityWorker -or $Color -ne 'blue')) {
        throw 'Target image lacks dedicated Activity-worker capability; only explicitly authorized production-blue recovery may use embedded ownership.'
    }
    @(
        "backend_image=$backendImage"
        "worker_image=$workerImage"
        "shared_local_image_id=$resolvedWorkerImageId"
        "backend_release=$backendRelease"
        "worker_release=$workerRelease"
        "activity_capability=$activityCapability"
        'api_worker_artifact_coherent=true'
    ) | Set-Content -Encoding utf8 (
        Join-Path $EvidenceDirectory 'api-worker-coherence.txt'
    )

    $apiContainerIds = @(docker compose @composeFiles --env-file $envPath ps -q $apiService) |
        Where-Object { $_ -and $_.Trim() }
    if ($LASTEXITCODE -ne 0 -or $apiContainerIds.Count -ne 1) {
        throw "Expected exactly one running $apiService container."
    }
    $frontendContainerIds = @(docker compose @composeFiles --env-file $envPath ps -q $frontendService) |
        Where-Object { $_ -and $_.Trim() }
    if ($LASTEXITCODE -ne 0 -or $frontendContainerIds.Count -ne 1) {
        throw "Expected exactly one running $frontendService container."
    }
    $runningBackendImageId = docker inspect --format '{{.Image}}' $apiContainerIds[0].Trim()
    if ($LASTEXITCODE -ne 0 -or "$runningBackendImageId".Trim() -ne "$expectedBackendImageId".Trim()) {
        throw "$apiService is not running the exact image configured by $backendImageVariable."
    }
    $runningFrontendImageId = docker inspect --format '{{.Image}}' $frontendContainerIds[0].Trim()
    if ($LASTEXITCODE -ne 0 -or "$runningFrontendImageId".Trim() -ne "$expectedFrontendImageId".Trim()) {
        throw "$frontendService is not running the exact image configured by $frontendImageVariable."
    }

    $targetWorkers = if ($AllowDeferredActivityWorker -or -not $hasActivityWorker) {
        $baseWorkers
    } else {
        $allWorkers
    }
    if ($AllowDeferredActivityWorker -or -not $hasActivityWorker) {
        $activityContainers = @(docker compose @composeFiles --env-file $envPath `
            ps --status running -q activity-worker) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $activityContainers.Count -ne 0) {
            throw 'This Activity-ownership transition requires zero running dedicated Activity-worker containers.'
        }
    }
    $workerContainerIds = @{}
    $workerHostnames = @{}
    $workerIdentityEvidence = @()
    foreach ($worker in $targetWorkers) {
        $workerIds = @(docker compose @composeFiles --env-file $envPath ps -q $worker) |
            Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -ne 0 -or $workerIds.Count -ne 1) {
            throw "Route switch requires exactly one running $worker."
        }
        $workerId = $workerIds[0].Trim()
        $workerRunningImageId = docker inspect --format '{{.Image}}' $workerId
        $workerImageExitCode = $LASTEXITCODE
        $workerState = docker inspect --format '{{.State.Status}}|{{.RestartCount}}' `
            $workerId
        $workerStateExitCode = $LASTEXITCODE
        $workerHostname = docker compose @composeFiles --env-file $envPath exec -T `
            $worker hostname
        $workerHostnameExitCode = $LASTEXITCODE
        if ($workerImageExitCode -ne 0 -or $workerStateExitCode -ne 0 -or
            $workerHostnameExitCode -ne 0 -or
            "$workerRunningImageId".Trim() -ne $resolvedWorkerImageId -or
            "$workerState".Trim() -ne 'running|0' -or
            -not "$workerHostname".Trim()) {
            throw "$worker is not stable on the exact target worker artifact."
        }
        $workerContainerIds[$worker] = $workerId
        $workerHostnames[$worker] = "$workerHostname".Trim()
        $workerIdentityEvidence += (
            "$worker|$workerId|$($workerHostnames[$worker])|$($workerRunningImageId.Trim())|$workerState"
        )
    }
    $workerIdentityEvidence | Set-Content -Encoding utf8 (
        Join-Path $EvidenceDirectory 'target-worker-identities.txt'
    )

    if ($hasBakedRevision) {
        $heartbeatArguments = @(
            'python', '-m', 'scripts.verify_worker_heartbeats',
            '--expected-release', $workerRelease,
            '--expected-tier', $DeploymentTier,
            '--expected-instance', $ProjectName,
            '--timeout-seconds', '90'
        )
        foreach ($worker in $targetWorkers) {
            $heartbeatArguments += @(
                '--expect', "$worker=$($workerHostnames[$worker])"
            )
        }
        $workerHeartbeatEvidence = docker compose @composeFiles --env-file $envPath `
            exec -T content-worker @heartbeatArguments 2>&1
    }
    else {
        $legacyHeartbeatCode = @'
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
            for worker_name, hostname in expected.items():
                item = await collection.find_one({
                    "worker_name": worker_name,
                    "instance_id": {"$regex": "^" + re.escape(hostname) + "-"},
                    "status": "running",
                    "updated_at": {"$gte": cutoff},
                })
                if not item:
                    missing.append(worker_name)
            if not missing:
                print(json.dumps({"status": "valid", "workers": sorted(expected)}, sort_keys=True))
                return 0
            if asyncio.get_running_loop().time() >= deadline:
                print(json.dumps({"status": "invalid", "missing_workers": sorted(missing)}, sort_keys=True))
                return 2
            await asyncio.sleep(2)
    except Exception as exc:
        print(json.dumps({"status": "invalid", "error_type": type(exc).__name__}, sort_keys=True))
        return 2
    finally:
        client.close()

raise SystemExit(asyncio.run(verify()))
'@
        $workerHostsJson = $workerHostnames | ConvertTo-Json -Compress
        $workerHeartbeatEvidence = docker compose @composeFiles --env-file $envPath `
            exec -T --env "EXPECTED_WORKER_HOSTS=$workerHostsJson" content-worker `
            python -c $legacyHeartbeatCode 2>&1
    }
    $workerHeartbeatExitCode = $LASTEXITCODE
    $workerHeartbeatEvidence | Set-Content -Encoding utf8 (
        Join-Path $EvidenceDirectory 'target-worker-heartbeats.txt'
    )
    if ($workerHeartbeatExitCode -ne 0) {
        throw 'Exact target worker heartbeat identity verification failed.'
    }

    $identityAssertions = if ($hasBakedRevision) {
        "assert payload.get('release') == '$backendRelease'; assert payload.get('image_revision') == '$backendRelease'; assert payload.get('deployment_tier') == '$DeploymentTier'; assert payload.get('deployment_instance_id') == '$ProjectName';"
    } else {
        ''
    }
    if ($AllowDeferredActivityWorker) {
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
        $apiReadiness = docker compose @composeFiles --env-file $envPath exec -T `
            --env "EXPECTED_RELEASE=$backendRelease" `
            --env "EXPECTED_TIER=$DeploymentTier" `
            --env "EXPECTED_INSTANCE=$ProjectName" $apiService `
            python -c $transitionReadinessCode 2>&1
    } else {
        $apiReadiness = docker compose @composeFiles --env-file $envPath exec -T `
            $apiService python -c "import json, urllib.request; payload=json.load(urllib.request.urlopen('http://127.0.0.1:8000/health/ready', timeout=10)); assert payload.get('status') == 'ready'; $identityAssertions print(json.dumps(payload, sort_keys=True))" 2>&1
    }
    $apiReadinessExitCode = $LASTEXITCODE
    $apiReadiness | Set-Content -Encoding utf8 (
        Join-Path $EvidenceDirectory 'target-api-readiness.json'
    )
    if ($apiReadinessExitCode -ne 0) {
        throw "Target API readiness or immutable image identity check failed."
    }

    docker compose @composeFiles --env-file $envPath exec -T $frontendService node -e "fetch('http://127.0.0.1:3000',{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
    if ($LASTEXITCODE -ne 0) { throw "Target frontend is not ready." }

    $nginxContainerIds = @(docker compose @composeFiles --env-file $envPath ps -q nginx) |
        Where-Object { $_ -and $_.Trim() }
    if ($LASTEXITCODE -ne 0 -or $nginxContainerIds.Count -ne 1) {
        throw 'Expected exactly one running nginx container.'
    }
    $routingMount = docker inspect --format '{{range .Mounts}}{{if eq .Destination "/etc/nginx/runtime"}}{{.Type}}:{{.Name}}{{end}}{{end}}' $nginxContainerIds[0].Trim()
    $expectedRoutingVolume = if ($DeploymentTier -eq 'staging') {
        'volume:maian_staging_nginx_active_state'
    } else {
        'volume:maian_production_nginx_active_state'
    }
    if ($LASTEXITCODE -ne 0 -or "$routingMount".Trim() -ne $expectedRoutingVolume) {
        throw "Nginx persistent routing volume is not $expectedRoutingVolume; migrate and verify the selected stack before switching traffic."
    }

    # Close the source/runtime TOCTOU immediately before the route mutation.
    # The reviewed checkout must still be clean, and the exact bind-mounted
    # script/templates that Nginx will execute/read must match that checkout.
    Assert-DeploymentSourceIdentity -Workspace $workspace `
        -ToolingRelease $ToolingRelease -EvidenceDirectory $EvidenceDirectory
    foreach ($reviewColor in @('blue', 'green')) {
        Assert-NginxUpstreamTemplate -Workspace $workspace -Color $reviewColor `
            -EvidenceDirectory $EvidenceDirectory | Out-Null
    }
    $nginxMountLines = @(docker inspect --format `
        '{{range .Mounts}}{{printf "%s|%s|%s\n" .Type .Source .Destination}}{{end}}' `
        $nginxContainerIds[0].Trim())
    if ($LASTEXITCODE -ne 0 -or $nginxMountLines.Count -eq 0) {
        throw 'Unable to inspect Nginx runtime bind mounts.'
    }
    $nginxMounts = @{}
    foreach ($mountLine in $nginxMountLines) {
        if (-not "$mountLine".Trim()) { continue }
        $mountParts = "$mountLine".Trim() -split '\|', 3
        if ($mountParts.Count -ne 3 -or $nginxMounts.ContainsKey($mountParts[2])) {
            throw 'Nginx runtime mount identity is ambiguous.'
        }
        $nginxMounts[$mountParts[2]] = @($mountParts[0], $mountParts[1])
    }
    $expectedMounts = @{
        '/etc/nginx/scripts/switch-nginx-upstream.sh' = (
            Join-Path $workspace 'infrastructure/switch-nginx-upstream.sh'
        )
        '/etc/nginx/upstreams' = (
            Join-Path $workspace 'infrastructure/upstreams'
        )
    }
    $pathComparison = if (
        [System.Environment]::OSVersion.Platform -eq
        [System.PlatformID]::Win32NT
    ) {
        [StringComparison]::OrdinalIgnoreCase
    } else {
        [StringComparison]::Ordinal
    }
    $runtimeEvidence = @()
    foreach ($destination in $expectedMounts.Keys) {
        if (-not $nginxMounts.ContainsKey($destination) -or
            $nginxMounts[$destination][0] -ne 'bind') {
            throw "Nginx $destination must be an exact bind mount from the reviewed workspace."
        }
        $expectedSource = (Resolve-Path -LiteralPath $expectedMounts[$destination]).Path
        $actualSource = [System.IO.Path]::GetFullPath($nginxMounts[$destination][1])
        if (-not $actualSource.Equals($expectedSource, $pathComparison)) {
            throw "Nginx $destination is mounted from another checkout or path."
        }
        $runtimeEvidence += "mount|$destination|$actualSource"
    }
    $runtimeFiles = [ordered]@{
        '/etc/nginx/scripts/switch-nginx-upstream.sh' = (
            Join-Path $workspace 'infrastructure/switch-nginx-upstream.sh'
        )
        '/etc/nginx/upstreams/blue.conf' = (
            Join-Path $workspace 'infrastructure/upstreams/blue.conf'
        )
        '/etc/nginx/upstreams/green.conf' = (
            Join-Path $workspace 'infrastructure/upstreams/green.conf'
        )
    }
    foreach ($containerPath in $runtimeFiles.Keys) {
        $localHash = (Get-FileHash -Algorithm SHA256 `
            -LiteralPath $runtimeFiles[$containerPath]).Hash.ToLowerInvariant()
        $containerHashLine = @(docker compose @composeFiles --env-file $envPath `
            exec -T nginx sha256sum $containerPath)
        if ($LASTEXITCODE -ne 0 -or $containerHashLine.Count -ne 1 -or
            "$($containerHashLine[0])".Trim() -notmatch '^([0-9a-fA-F]{64})[ ]+') {
            throw "Unable to hash Nginx runtime file $containerPath."
        }
        $containerHash = $Matches[1].ToLowerInvariant()
        if ($containerHash -ne $localHash) {
            throw "Nginx runtime file $containerPath differs from the reviewed checkout."
        }
        $runtimeEvidence += "sha256|$containerPath|$containerHash"
    }
    $runtimeEvidence | Set-Content -Encoding utf8 (
        Join-Path $EvidenceDirectory 'nginx-runtime-source-identity.txt'
    )

    foreach ($worker in $targetWorkers) {
        $stableWorkerIds = @(docker compose @composeFiles --env-file $envPath `
            ps -q $worker) | Where-Object { $_ -and $_.Trim() }
        $stableWorkerState = docker inspect --format `
            '{{.State.Status}}|{{.RestartCount}}' $workerContainerIds[$worker]
        if ($LASTEXITCODE -ne 0 -or $stableWorkerIds.Count -ne 1 -or
            $stableWorkerIds[0].Trim() -ne $workerContainerIds[$worker] -or
            "$stableWorkerState".Trim() -ne 'running|0') {
            throw "$worker changed after exact heartbeat verification and before route mutation."
        }
    }
    $templateHash = Assert-NginxUpstreamTemplate -Workspace $workspace `
        -Color $Color -EvidenceDirectory $EvidenceDirectory
    $routeMutationStarted = $true
    docker compose @composeFiles --env-file $envPath exec -T nginx /bin/sh `
        /etc/nginx/scripts/switch-nginx-upstream.sh $Color
    if ($LASTEXITCODE -ne 0) { throw "Persistent Nginx validation or reload failed." }
    $persistedColor = docker compose @composeFiles --env-file $envPath exec -T nginx `
        cat /etc/nginx/runtime/active-color
    if ($LASTEXITCODE -ne 0 -or "$persistedColor".Trim() -ne $Color) {
        throw "Nginx reloaded but its persisted active-color evidence is not $Color."
    }
    docker compose @composeFiles --env-file $envPath exec -T nginx cmp -s `
        /etc/nginx/runtime/active-upstreams.conf "/etc/nginx/upstreams/$Color.conf"
    if ($LASTEXITCODE -ne 0) {
        throw "Nginx persisted route does not match the approved $Color upstream."
    }
    $routeMutationVerified = $true

    Write-Output "Traffic persistently switched to $Color in $DeploymentTier after readiness and image identity checks (backend image $expectedBackendImageId, revision $backendRelease, routing mount $routingMount, template SHA256 $templateHash)."
}
catch {
    if ($routeMutationStarted -and -not $routeMutationVerified -and
        $null -ne $lockHandle -and $lockHandle.Owned) {
        $preserveDeploymentLock = $true
        @(
            'status=route-mutation-unproven'
            "error_type=$($_.Exception.GetType().FullName)"
            "lock_resource=docker-volume:$($lockHandle.VolumeName)"
            'lock_preserved=true'
        ) | Set-Content -Encoding utf8 (
            Join-Path $EvidenceDirectory 'route-mutation-failure.txt'
        )
    }
    throw
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
