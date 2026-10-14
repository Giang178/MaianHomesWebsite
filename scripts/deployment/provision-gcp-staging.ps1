param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z][a-z0-9-]{4,28}[a-z0-9]$')]
    [string]$Project,
    [ValidatePattern('^[a-z]+-[a-z]+[0-9]$')]
    [string]$Region = "asia-southeast1",
    [ValidatePattern('^[a-z]+-[a-z]+[0-9]-[a-z]$')]
    [string]$Zone = "asia-southeast1-b",
    [ValidatePattern('^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$')]
    [string]$Instance = "maian-staging",
    [ValidatePattern('^[a-z0-9]+(?:-[a-z0-9]+)*$')]
    [string]$MachineType = "e2-standard-4",
    [ValidateRange(50, 2048)]
    [int]$DiskGb = 100,
    [ValidatePattern('^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$')]
    [string]$Repository = "maian",
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F]{40}$')]
    [string]$ToolingRelease,
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$EvidenceDirectory,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$')]
    [string]$LockBucket
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startupScript = Join-Path $workspace "infrastructure\gcp\bootstrap-vm.sh"
$sourceGuard = Join-Path $PSScriptRoot "deployment-source-guard.ps1"
$network = "maian-staging"
$subnet = "maian-staging-$Region"
$serviceAccountName = "maian-staging-vm"
$serviceAccount = "$serviceAccountName@$Project.iam.gserviceaccount.com"
$addressName = "maian-staging-ip"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    throw "gcloud CLI is required."
}
if (-not (Test-Path $startupScript)) {
    throw "Missing startup script: $startupScript"
}
if (-not (Test-Path -LiteralPath $sourceGuard -PathType Leaf)) {
    throw "Missing deployment source guard: $sourceGuard"
}

. $sourceGuard
Assert-DeploymentSourceIdentity -Workspace $workspace `
    -ToolingRelease ($ToolingRelease.ToLowerInvariant()) `
    -EvidenceDirectory $EvidenceDirectory
$startupScriptHash = Get-DeploymentFileSha256 -LiteralPath $startupScript

function Get-ExactlyOneGcloudValue {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    $output = @(& $Command)
    if ($LASTEXITCODE -ne 0 -or $output.Count -ne 1) {
        throw "Unable to resolve exactly one $Description."
    }
    $value = ([string]$output[0]).Trim()
    if (-not $value) {
        throw "Unable to resolve exactly one $Description."
    }
    return $value
}

$projectNumber = Get-ExactlyOneGcloudValue -Description "Google Cloud project number" -Command {
    gcloud projects describe $Project --format "value(projectNumber)" 2>$null
}
$bucketJson = @(gcloud storage buckets describe "gs://$LockBucket" --project $Project --format json 2>$null)
if ($LASTEXITCODE -ne 0 -or $bucketJson.Count -eq 0) {
    throw "The pre-created provisioning lock bucket is unavailable; no cloud mutations were attempted."
}
try {
    $bucketState = ($bucketJson -join [Environment]::NewLine) | ConvertFrom-Json -ErrorAction Stop
}
catch {
    throw "The provisioning lock bucket returned unreadable JSON."
}
if ([string]$bucketState.projectNumber -ne $projectNumber) {
    throw "The provisioning lock bucket must belong to the explicit Google Cloud project."
}

$lockObject = "maian/provisioning/$Region/$Instance.lock"
$lockUri = "gs://$LockBucket/$lockObject"
$lockTemp = Join-Path ([System.IO.Path]::GetTempPath()) (
    "maian-provision-lock-$([System.Guid]::NewGuid().ToString('N')).json"
)
$lockAcquired = $false
$lockGeneration = $null
$operationException = $null
$randomBytes = [byte[]]::new(32)
$randomNumberGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $randomNumberGenerator.GetBytes($randomBytes)
}
finally {
    $randomNumberGenerator.Dispose()
}
$lockToken = -join @($randomBytes | ForEach-Object { $_.ToString('x2') })
$lockTokenHash = Get-DeploymentTextSha256 -Content $lockToken
$lockPayload = [ordered]@{
    schema_version = 1
    operation = "provision-gcp-staging"
    project = $Project
    region = $Region
    zone = $Zone
    instance = $Instance
    tooling_release = $ToolingRelease.ToLowerInvariant()
    phase = "provisioning"
    owner_host = [System.Environment]::MachineName
    owner_pid = $PID
    acquired_at_utc = [System.DateTime]::UtcNow.ToString("o")
    token_sha256 = $lockTokenHash
} | ConvertTo-Json -Depth 3
$lockFileContent = $lockPayload + [Environment]::NewLine
[System.IO.File]::WriteAllText(
    $lockTemp,
    $lockFileContent,
    [System.Text.UTF8Encoding]::new($false)
)
$lockMd5 = [System.Security.Cryptography.MD5]::Create()
try {
    $lockMd5Base64 = [System.Convert]::ToBase64String(
        $lockMd5.ComputeHash([System.Text.UTF8Encoding]::new($false).GetBytes($lockFileContent))
    )
}
finally {
    $lockMd5.Dispose()
}

try {
    gcloud storage cp $lockTemp $lockUri --project $Project --if-generation-match=0 --quiet 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Provisioning lock acquisition failed. Inspect the existing lock object and recover it by exact generation only after proving its owner is inactive."
    }
    $lockDescriptionOutput = @(
        gcloud storage objects describe $lockUri --project $Project --format json 2>$null
    )
    if ($LASTEXITCODE -ne 0 -or $lockDescriptionOutput.Count -eq 0) {
        throw "Unable to verify the acquired provisioning lock."
    }
    try {
        $lockDescription = ($lockDescriptionOutput -join [Environment]::NewLine) |
            ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "The acquired provisioning lock returned unreadable JSON."
    }
    $lockGeneration = ([string]$lockDescription.generation).Trim()
    if ($lockGeneration -notmatch '^[1-9][0-9]*$') {
        throw "The acquired provisioning lock has an invalid generation."
    }
    if ([string]$lockDescription.md5Hash -ne $lockMd5Base64) {
        throw "The acquired provisioning lock content does not match this operator token."
    }
    $lockAcquired = $true

    $resolvedBootImage = Get-ExactlyOneGcloudValue -Description "Ubuntu 24.04 boot image" -Command {
        gcloud compute images describe-from-family ubuntu-2404-lts-amd64 `
            --project ubuntu-os-cloud --format "value(selfLink)" 2>$null
    }
    if ($resolvedBootImage -notmatch '/projects/ubuntu-os-cloud/global/images/ubuntu-2404-lts-amd64-.+$') {
        throw "Resolved boot image is not from the approved Ubuntu 24.04 LTS image family."
    }

gcloud services enable compute.googleapis.com artifactregistry.googleapis.com iam.googleapis.com iap.googleapis.com storage.googleapis.com --project $Project | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Unable to enable required Google Cloud APIs." }

gcloud artifacts repositories describe $Repository --project $Project --location $Region 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    gcloud artifacts repositories create $Repository --project $Project --repository-format docker --location $Region --immutable-tags --description "Maian immutable release images"
    if ($LASTEXITCODE -ne 0) { throw "Unable to create immutable Artifact Registry repository $Repository." }
}
$immutableTagOutput = @(
    gcloud artifacts repositories describe $Repository --project $Project --location $Region "--format=value(dockerConfig.immutableTags)" --quiet 2>$null
)
if ($LASTEXITCODE -ne 0) {
    throw "Unable to verify immutable tags for Artifact Registry repository $Repository."
}
$immutableTagSettings = @(
    $immutableTagOutput |
        ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } |
        Where-Object { $_ }
)
if ($immutableTagSettings.Count -ne 1 -or $immutableTagSettings[0] -ne "true") {
    throw "Existing Artifact Registry repository $Repository is mutable. Review its tags, then enable --immutable-tags before provisioning."
}

gcloud iam service-accounts describe $serviceAccount --project $Project 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    gcloud iam service-accounts create $serviceAccountName --project $Project --display-name "Maian staging VM"
    if ($LASTEXITCODE -ne 0) { throw "Unable to create staging service account $serviceAccount." }
}
foreach ($role in @("roles/artifactregistry.reader", "roles/logging.logWriter", "roles/monitoring.metricWriter")) {
    gcloud projects add-iam-policy-binding $Project --member "serviceAccount:$serviceAccount" --role $role --condition=None | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Unable to grant $role to $serviceAccount." }
}

gcloud compute networks describe $network --project $Project 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    gcloud compute networks create $network --project $Project --subnet-mode custom
    if ($LASTEXITCODE -ne 0) { throw "Unable to create staging network $network." }
}
gcloud compute networks subnets describe $subnet --project $Project --region $Region 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    gcloud compute networks subnets create $subnet --project $Project --network $network --region $Region --range "10.20.0.0/24"
    if ($LASTEXITCODE -ne 0) { throw "Unable to create staging subnet $subnet." }
}

gcloud compute firewall-rules describe "$network-web" --project $Project 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    gcloud compute firewall-rules create "$network-web" --project $Project --network $network --direction INGRESS --action ALLOW --rules tcp:80,tcp:443 --source-ranges "0.0.0.0/0" --target-service-accounts $serviceAccount
    if ($LASTEXITCODE -ne 0) { throw "Unable to create staging web firewall rule." }
}
gcloud compute firewall-rules describe "$network-iap-ssh" --project $Project 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    gcloud compute firewall-rules create "$network-iap-ssh" --project $Project --network $network --direction INGRESS --action ALLOW --rules tcp:22 --source-ranges "35.235.240.0/20" --target-service-accounts $serviceAccount
    if ($LASTEXITCODE -ne 0) { throw "Unable to create staging IAP SSH firewall rule." }
}

gcloud compute addresses describe $addressName --project $Project --region $Region 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    gcloud compute addresses create $addressName --project $Project --region $Region
    if ($LASTEXITCODE -ne 0) { throw "Unable to reserve staging address $addressName." }
}
$addressOutput = @(gcloud compute addresses describe $addressName --project $Project --region $Region --format "value(address)" 2>$null)
if ($LASTEXITCODE -ne 0 -or $addressOutput.Count -ne 1) {
    throw "Unable to resolve the reserved staging address."
}
$address = ([string]$addressOutput[0]).Trim()
$parsedAddress = $null
if (-not [System.Net.IPAddress]::TryParse($address, [ref]$parsedAddress) -or
    $parsedAddress.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
    throw "Reserved staging address is not one valid IPv4 address."
}

gcloud compute instances describe $Instance --project $Project --zone $Zone 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    $diskSize = "$($DiskGb)GB"
    $registryHost = $Region + '-docker.pkg.dev'
    $instanceMetadata = @(
        "enable-oslogin=TRUE"
        "artifact-registry-host=$registryHost"
        "maian-tooling-release=$($ToolingRelease.ToLowerInvariant())"
        "maian-startup-script-sha256=$startupScriptHash"
        "maian-boot-image=$resolvedBootImage"
        "maian-provisioning-schema=1"
    ) -join ','
    gcloud compute instances create $Instance --project $Project --zone $Zone --machine-type $MachineType --subnet $subnet --address $address --service-account $serviceAccount --scopes cloud-platform --image $resolvedBootImage --boot-disk-size $diskSize --boot-disk-type pd-balanced --shielded-secure-boot --shielded-vtpm --shielded-integrity-monitoring --metadata $instanceMetadata --metadata-from-file "startup-script=$startupScript"
    if ($LASTEXITCODE -ne 0) { throw "Unable to create staging VM $Instance." }
}

$serviceAccountCheck = @(gcloud iam service-accounts describe $serviceAccount --project $Project "--format=value(email)" 2>$null)
if ($LASTEXITCODE -ne 0 -or $serviceAccountCheck.Count -ne 1 -or
    ([string]$serviceAccountCheck[0]).Trim() -ne $serviceAccount) {
    throw "Final staging service-account verification failed."
}

function Assert-FirewallRule {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$SourceRange,
        [Parameter(Mandatory = $true)][string[]]$Ports
    )
    $ruleOutput = @(gcloud compute firewall-rules describe $Name --project $Project --format json 2>$null)
    if ($LASTEXITCODE -ne 0 -or $ruleOutput.Count -eq 0) {
        throw "Unable to verify firewall rule $Name."
    }
    try {
        $rule = ($ruleOutput -join [Environment]::NewLine) | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "Firewall rule $Name returned unreadable JSON."
    }
    $tcpPorts = @(
        $rule.allowed |
            Where-Object { $_.IPProtocol -eq "tcp" } |
            ForEach-Object { $_.ports } |
            ForEach-Object { [string]$_ } |
            Sort-Object -Unique
    )
    $expectedPorts = @($Ports | Sort-Object -Unique)
    if ($rule.direction -ne "INGRESS" -or $rule.disabled -eq $true -or
        -not ([string]$rule.network).EndsWith("/networks/$network") -or
        @($rule.allowed).Count -ne 1 -or (@($rule.allowed)[0]).IPProtocol -ne "tcp" -or
        @($rule.sourceRanges).Count -ne 1 -or @($rule.sourceRanges)[0] -ne $SourceRange -or
        $tcpPorts.Count -ne $expectedPorts.Count -or
        (Compare-Object $tcpPorts $expectedPorts).Count -ne 0 -or
        @($rule.targetServiceAccounts).Count -ne 1 -or
        @($rule.targetServiceAccounts)[0] -ne $serviceAccount) {
        throw "Firewall rule $Name does not match the approved staging policy."
    }
}

Assert-FirewallRule -Name "$network-web" -SourceRange "0.0.0.0/0" -Ports @("80", "443")
Assert-FirewallRule -Name "$network-iap-ssh" -SourceRange "35.235.240.0/20" -Ports @("22")

$networkOutput = @(gcloud compute networks describe $network --project $Project --format json 2>$null)
$subnetOutput = @(gcloud compute networks subnets describe $subnet --project $Project --region $Region --format json 2>$null)
if ($networkOutput.Count -eq 0 -or $subnetOutput.Count -eq 0 -or $LASTEXITCODE -ne 0) {
    throw "Unable to perform final staging network verification."
}
try {
    $networkState = ($networkOutput -join [Environment]::NewLine) | ConvertFrom-Json -ErrorAction Stop
    $subnetState = ($subnetOutput -join [Environment]::NewLine) | ConvertFrom-Json -ErrorAction Stop
}
catch {
    throw "The staging network or subnet returned unreadable JSON."
}
if ($networkState.autoCreateSubnetworks -ne $false -or
    $networkState.routingConfig.routingMode -ne "REGIONAL" -or
    $subnetState.ipCidrRange -ne "10.20.0.0/24" -or
    -not ([string]$subnetState.network).EndsWith("/networks/$network") -or
    -not ([string]$subnetState.region).EndsWith("/regions/$Region")) {
    throw "Existing or created staging network does not match the approved custom subnet policy."
}

$addressJson = @(gcloud compute addresses describe $addressName --project $Project --region $Region --format json 2>$null)
if ($LASTEXITCODE -ne 0 -or $addressJson.Count -eq 0) {
    throw "Unable to perform final staging address verification."
}
try {
    $addressState = ($addressJson -join [Environment]::NewLine) | ConvertFrom-Json -ErrorAction Stop
}
catch {
    throw "The staging address returned unreadable JSON."
}
if ($addressState.address -ne $address -or
    $addressState.addressType -ne "EXTERNAL" -or
    $addressState.networkTier -ne "PREMIUM" -or
    -not ([string]$addressState.region).EndsWith("/regions/$Region")) {
    throw "Existing or created staging address does not match the approved policy."
}

$instanceOutput = @(gcloud compute instances describe $Instance --project $Project --zone $Zone --format json 2>$null)
if ($LASTEXITCODE -ne 0 -or $instanceOutput.Count -eq 0) {
    throw "Unable to perform final staging VM verification."
}
try {
    $instanceState = ($instanceOutput -join [Environment]::NewLine) | ConvertFrom-Json -ErrorAction Stop
}
catch {
    throw "Staging VM returned unreadable JSON."
}
$attachedAccounts = @($instanceState.serviceAccounts | ForEach-Object { [string]$_.email })
$attachedScopes = @(
    $instanceState.serviceAccounts |
        ForEach-Object { $_.scopes } |
        ForEach-Object { [string]$_ }
)
$externalAddresses = @(
    $instanceState.networkInterfaces |
        ForEach-Object { $_.accessConfigs } |
        ForEach-Object { [string]$_.natIP } |
        Where-Object { $_ }
)
$metadata = @{}
foreach ($item in @($instanceState.metadata.items)) {
    if ($item.key) { $metadata[[string]$item.key] = [string]$item.value }
}
$bootDisks = @($instanceState.disks | Where-Object { $_.boot -eq $true })
if ($bootDisks.Count -ne 1) {
    throw "Staging VM must have exactly one boot disk."
}
$bootDiskName = ([string]$bootDisks[0].source).Split('/')[-1]
$diskOutput = @(gcloud compute disks describe $bootDiskName --project $Project --zone $Zone --format json 2>$null)
if ($LASTEXITCODE -ne 0 -or $diskOutput.Count -eq 0) {
    throw "Unable to perform final staging boot disk verification."
}
try {
    $diskState = ($diskOutput -join [Environment]::NewLine) | ConvertFrom-Json -ErrorAction Stop
}
catch {
    throw "The staging boot disk returned unreadable JSON."
}
$remoteStartupScript = [string]$metadata["startup-script"]
$remoteStartupScriptHash = if ($remoteStartupScript) {
    Get-DeploymentTextSha256 -Content $remoteStartupScript
}
else {
    ""
}
$stampedBootImage = [string]$metadata["maian-boot-image"]
if ($instanceState.status -ne "RUNNING" -or
    $attachedAccounts.Count -ne 1 -or $attachedAccounts[0] -ne $serviceAccount -or
    $attachedScopes.Count -ne 1 -or
    $attachedScopes[0] -ne "https://www.googleapis.com/auth/cloud-platform" -or
    @($instanceState.networkInterfaces).Count -ne 1 -or
    $externalAddresses.Count -ne 1 -or $externalAddresses[0] -ne $address -or
    -not ([string]$instanceState.networkInterfaces[0].network).EndsWith("/networks/$network") -or
    -not ([string]$instanceState.networkInterfaces[0].subnetwork).EndsWith("/subnetworks/$subnet") -or
    -not ([string]$instanceState.machineType).EndsWith("/machineTypes/$MachineType") -or
    $instanceState.shieldedInstanceConfig.enableSecureBoot -ne $true -or
    $instanceState.shieldedInstanceConfig.enableVtpm -ne $true -or
    $instanceState.shieldedInstanceConfig.enableIntegrityMonitoring -ne $true -or
    ([string]$metadata["enable-oslogin"]).ToLowerInvariant() -ne "true" -or
    $metadata["artifact-registry-host"] -ne ($Region + "-docker.pkg.dev") -or
    $metadata["maian-tooling-release"] -ne $ToolingRelease.ToLowerInvariant() -or
    $metadata["maian-startup-script-sha256"] -ne $startupScriptHash -or
    $metadata["maian-provisioning-schema"] -ne "1" -or
    $remoteStartupScriptHash -ne $startupScriptHash -or
    $stampedBootImage -notmatch '/projects/ubuntu-os-cloud/global/images/ubuntu-2404-lts-amd64-.+$' -or
    $diskState.sourceImage -ne $stampedBootImage -or
    [int]$diskState.sizeGb -ne $DiskGb -or
    -not ([string]$diskState.type).EndsWith('/diskTypes/pd-balanced')) {
    throw "Existing or created staging VM does not match the approved topology/security policy."
}

}
catch {
    $operationException = $_
    throw
}
finally {
    if ([System.IO.File]::Exists($lockTemp)) {
        [System.IO.File]::Delete($lockTemp)
    }
    $lockToken = $null
    if ($lockAcquired) {
        gcloud storage rm $lockUri --project $Project "--if-generation-match=$lockGeneration" --quiet 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            $releaseMessage = "Provisioning completed or failed, but its exact-generation cloud lock could not be released. Keep subsequent provisioning blocked and inspect the lock object."
            if ($null -eq $operationException) {
                throw $releaseMessage
            }
            Write-Warning $releaseMessage
        }
    }
}

Write-Output "Staging VM provisioned and topology verified; wait for its startup script before deployment."
Write-Output "External IP: $address"
Write-Output "Point the staging DNS A record to this IP, then connect with:"
Write-Output "gcloud compute ssh $Instance --zone $Zone --tunnel-through-iap"
