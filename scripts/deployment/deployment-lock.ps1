Set-StrictMode -Version Latest

$script:DeploymentLockVolume = 'maian_global_deployment_lock'
$script:DeploymentLockSchema = '3'

function Get-DeploymentTokenHash {
    param([Parameter(Mandatory = $true)][string]$Token)

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $tokenBytes = [System.Text.Encoding]::UTF8.GetBytes($Token)
        return ([System.BitConverter]::ToString(
            $sha256.ComputeHash($tokenBytes)
        )).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
    }
}

function Get-DeploymentLockLabel {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $value = @(docker volume inspect --format `
        "{{ index .Labels `"$Label`" }}" $Name 2>$null)
    if ($LASTEXITCODE -ne 0 -or $value.Count -ne 1) {
        throw 'The Docker-daemon-global deployment lock is unavailable or unreadable.'
    }
    return "$($value[0])".Trim()
}

function Assert-DeploymentLockIdentity {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$TokenHash,
        [Parameter(Mandatory = $true)][string]$DeploymentTier,
        [Parameter(Mandatory = $true)][string]$ProjectName
    )

    $schema = Get-DeploymentLockLabel -Name $Name `
        -Label 'com.maianhomes.deployment-lock.schema'
    $actualTokenHash = Get-DeploymentLockLabel -Name $Name `
        -Label 'com.maianhomes.deployment-lock.token-sha256'
    $actualTier = Get-DeploymentLockLabel -Name $Name `
        -Label 'com.maianhomes.deployment-lock.tier'
    $actualProject = Get-DeploymentLockLabel -Name $Name `
        -Label 'com.maianhomes.deployment-lock.project'
    if ($schema -ne $script:DeploymentLockSchema -or
        $actualTokenHash -ne $TokenHash -or
        $actualTier -ne $DeploymentTier -or
        $actualProject -ne $ProjectName) {
        throw 'The supplied deployment-lock token does not own the Docker-daemon-global lock for this exact project and tier.'
    }
}

function Enter-DeploymentLock {
    param(
        [Parameter(Mandatory = $true)][string]$Workspace,
        [Parameter(Mandatory = $true)][ValidateSet('production', 'staging')]
        [string]$DeploymentTier,
        [Parameter(Mandatory = $true)][string]$ProjectName,
        [string]$ExistingToken = '',
        [string]$EvidenceDirectory = ''
    )

    if ($ProjectName -cnotmatch '^[a-z0-9][a-z0-9_-]*$') {
        throw 'ProjectName must already be the normalized lowercase Compose project name.'
    }
    $volumeName = $script:DeploymentLockVolume
    if ($ExistingToken) {
        $token = $ExistingToken
        $tokenHash = Get-DeploymentTokenHash -Token $token
        Assert-DeploymentLockIdentity -Name $volumeName -TokenHash $tokenHash `
            -DeploymentTier $DeploymentTier -ProjectName $ProjectName
        $owned = $false
    }
    else {
        $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            $tokenBytes = New-Object byte[] 32
            $random.GetBytes($tokenBytes)
        }
        finally {
            $random.Dispose()
        }
        $token = ([System.BitConverter]::ToString($tokenBytes)).Replace(
            '-', ''
        ).ToLowerInvariant()
        $tokenHash = Get-DeploymentTokenHash -Token $token
        $created = @(docker volume create `
            --label "com.maianhomes.deployment-lock.schema=$($script:DeploymentLockSchema)" `
            --label "com.maianhomes.deployment-lock.token-sha256=$tokenHash" `
            --label "com.maianhomes.deployment-lock.tier=$DeploymentTier" `
            --label "com.maianhomes.deployment-lock.project=$ProjectName" `
            --label "com.maianhomes.deployment-lock.acquired-at-utc=$([DateTime]::UtcNow.ToString('o'))" `
            $volumeName 2>&1)
        if ($LASTEXITCODE -ne 0 -or $created.Count -ne 1 -or
            "$($created[0])".Trim() -ne $volumeName) {
            throw 'Unable to atomically acquire the Docker-daemon-global deployment lock.'
        }
        try {
            Assert-DeploymentLockIdentity -Name $volumeName -TokenHash $tokenHash `
                -DeploymentTier $DeploymentTier -ProjectName $ProjectName
        }
        catch {
            throw "Deployment lock is already held on this Docker daemon. Do not remove $volumeName as stale until the exact active stack state has been reviewed and recovered."
        }
        $owned = $true
    }

    $handle = [pscustomobject]@{
        VolumeName = $volumeName
        Token = $token
        Owned = $owned
        TokenHash = $tokenHash
        DeploymentTier = $DeploymentTier
        ProjectName = $ProjectName
    }
    if ($EvidenceDirectory) {
        @(
            "lock_resource=docker-volume:$volumeName"
            'lock_scope=docker-daemon-global'
            "lock_scope_project=$ProjectName"
            "lock_scope_tier=$DeploymentTier"
            "lock_mode=$(if ($owned) { 'owner' } else { 'verified-reentrant' })"
            "lock_token_sha256=$tokenHash"
        ) | Set-Content -Encoding utf8 (
            Join-Path $EvidenceDirectory 'deployment-lock.txt'
        )
    }
    return $handle
}

function Exit-DeploymentLock {
    param([Parameter(Mandatory = $true)]$Handle)

    if (-not $Handle.Owned) { return }
    Assert-DeploymentLockIdentity -Name $Handle.VolumeName `
        -TokenHash $Handle.TokenHash -DeploymentTier $Handle.DeploymentTier `
        -ProjectName $Handle.ProjectName
    $removed = @(docker volume rm $Handle.VolumeName 2>&1)
    if ($LASTEXITCODE -ne 0 -or $removed.Count -ne 1 -or
        "$($removed[0])".Trim() -ne $Handle.VolumeName) {
        throw 'Unable to release the owned Docker-daemon-global deployment lock; review it manually before another deployment.'
    }
}
