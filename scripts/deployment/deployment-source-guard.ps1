Set-StrictMode -Version Latest

function Get-NormalizedDeploymentPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $pathRoot = [System.IO.Path]::GetPathRoot($fullPath)
    if ($fullPath.Length -gt $pathRoot.Length) {
        $fullPath = $fullPath.TrimEnd(
            [char[]]@(
                [System.IO.Path]::DirectorySeparatorChar,
                [System.IO.Path]::AltDirectorySeparatorChar
            )
        )
    }
    return $fullPath
}

function Test-DeploymentPathEqual {
    param(
        [Parameter(Mandatory = $true)][string]$Left,
        [Parameter(Mandatory = $true)][string]$Right
    )

    $comparison = if (
        [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
    ) {
        [System.StringComparison]::OrdinalIgnoreCase
    }
    else {
        [System.StringComparison]::Ordinal
    }
    return [string]::Equals(
        (Get-NormalizedDeploymentPath -Path $Left),
        (Get-NormalizedDeploymentPath -Path $Right),
        $comparison
    )
}

function Get-DeploymentCriticalRelativePaths {
    return @(
        '.gitattributes'
        'backend/Dockerfile'
        'backend/scripts/validate_runtime_settings.py'
        'backend/scripts/verify_worker_heartbeats.py'
        'backend/app/core/runtime_clients.py'
        'backend/app/core/upload_security.py'
        'backend/app/modules/content/company_knowledge/api.py'
        'backend/app/modules/content/company_knowledge/schemas.py'
        'backend/app/modules/content/company_knowledge/service.py'
        'backend/scripts/migrations/seed_company_knowledge_draft.py'
        'docker-compose.yml'
        'docker-compose.production.yml'
        'docker-compose.staging.yml'
        'frontend/Dockerfile'
        'infrastructure/gcp/bootstrap-vm.sh'
        'infrastructure/gcp/deploy-staging.sh'
        'infrastructure/gcp/switch-ollama-model.sh'
        'infrastructure/nginx.production.conf'
        'infrastructure/switch-nginx-upstream.sh'
        'infrastructure/upstreams/blue.conf'
        'infrastructure/upstreams/green.conf'
        'infrastructure/watch-nginx-certificates.sh'
        'scripts/deployment/deployment-lock.ps1'
        'scripts/deployment/deployment-source-guard.ps1'
        'scripts/deployment/assert-deployment-source.ps1'
        'scripts/deployment/deploy-workers.ps1'
        'scripts/deployment/provision-gcp-staging.ps1'
        'scripts/deployment/promote-green-to-blue.ps1'
        'scripts/deployment/publish-gcp-images.ps1'
        'scripts/deployment/rollback-blue-green.ps1'
        'scripts/deployment/rollout-blue-green.ps1'
        'scripts/deployment/switch-blue-green.ps1'
    )
}

function Get-DeploymentFileSha256 {
    param([Parameter(Mandatory = $true)][string]$LiteralPath)

    $stream = $null
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $stream = [System.IO.File]::Open(
            $LiteralPath,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            [System.IO.FileShare]::Read
        )
        return ([System.BitConverter]::ToString(
            $sha256.ComputeHash($stream)
        )).Replace('-', '').ToLowerInvariant()
    }
    finally {
        if ($null -ne $stream) { $stream.Dispose() }
        $sha256.Dispose()
    }
}

function Get-DeploymentTextSha256 {
    param([Parameter(Mandatory = $true)][string]$Content)

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($Content)
        return ([System.BitConverter]::ToString(
            $sha256.ComputeHash($bytes)
        )).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
    }
}

function Write-ImmutableDeploymentEvidence {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $encoding = [System.Text.UTF8Encoding]::new($false)
    $expectedBytes = $encoding.GetBytes($Content)
    if ([System.IO.File]::Exists($LiteralPath)) {
        $existingBytes = [System.IO.File]::ReadAllBytes($LiteralPath)
        if (
            [System.Convert]::ToBase64String($existingBytes) -ne
            [System.Convert]::ToBase64String($expectedBytes)
        ) {
            throw "Deployment evidence already exists with different content: $LiteralPath"
        }
        return
    }

    $stream = $null
    try {
        $stream = [System.IO.File]::Open(
            $LiteralPath,
            [System.IO.FileMode]::CreateNew,
            [System.IO.FileAccess]::Write,
            [System.IO.FileShare]::None
        )
        $stream.Write($expectedBytes, 0, $expectedBytes.Length)
        $stream.Flush($true)
    }
    finally {
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function Get-VerifiedDeploymentGitState {
    param(
        [Parameter(Mandatory = $true)][string]$GitExecutable,
        [Parameter(Mandatory = $true)][string]$Workspace,
        [Parameter(Mandatory = $true)][string]$ToolingRelease
    )

    $headOutput = @(& $GitExecutable -C $Workspace rev-parse HEAD 2>$null)
    $headExitCode = $LASTEXITCODE
    if (
        $headExitCode -ne 0 -or
        $headOutput.Count -ne 1 -or
        "$($headOutput[0])".Trim() -notmatch '^[0-9a-fA-F]{40}$'
    ) {
        throw 'Unable to resolve exactly one full Git HEAD revision for deployment tooling.'
    }
    $headRevision = "$($headOutput[0])".Trim().ToLowerInvariant()
    if (-not [string]::Equals(
        $headRevision,
        $ToolingRelease,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw 'Deployment tooling checkout does not match the explicit ToolingRelease.'
    }

    $worktreeStatus = @(
        & $GitExecutable -C $Workspace status --porcelain=v1 --untracked-files=all 2>$null
    )
    $statusExitCode = $LASTEXITCODE
    if ($statusExitCode -ne 0) {
        throw 'Unable to prove the deployment tooling worktree state.'
    }
    if ($worktreeStatus.Count -ne 0) {
        throw 'Deployment tooling worktree is dirty; refuse to execute unreviewed scripts.'
    }
    return $headRevision
}

function Assert-DeploymentSourceIdentity {
    param(
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$Workspace,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ToolingRelease,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$EvidenceDirectory
    )

    if ($ToolingRelease -notmatch '^[0-9a-fA-F]{40}$') {
        throw 'ToolingRelease must be the full 40-character reviewed Git revision.'
    }
    $ToolingRelease = $ToolingRelease.ToLowerInvariant()

    try {
        $resolvedWorkspace = (
            Resolve-Path -LiteralPath $Workspace -ErrorAction Stop
        ).Path
    }
    catch {
        throw 'Deployment tooling workspace does not exist or cannot be resolved.'
    }
    if (-not (Test-Path -LiteralPath $resolvedWorkspace -PathType Container)) {
        throw 'Deployment tooling workspace must be an existing directory.'
    }
    try {
        $resolvedEvidenceDirectory = (
            Resolve-Path -LiteralPath $EvidenceDirectory -ErrorAction Stop
        ).Path
    }
    catch {
        throw 'EvidenceDirectory must already exist; the source guard will not create it.'
    }
    if (-not (Test-Path -LiteralPath $resolvedEvidenceDirectory -PathType Container)) {
        throw 'EvidenceDirectory must be an existing directory.'
    }

    try {
        $gitExecutable = (Get-Command git -CommandType Application -ErrorAction Stop).Source
    }
    catch {
        throw 'A Git application executable is required to verify deployment tooling.'
    }
    $gitRootOutput = @(
        & $gitExecutable -C $resolvedWorkspace rev-parse --show-toplevel 2>$null
    )
    $gitRootExitCode = $LASTEXITCODE
    if ($gitRootExitCode -ne 0 -or $gitRootOutput.Count -ne 1) {
        throw 'Unable to resolve exactly one Git repository root for deployment tooling.'
    }
    $gitRoot = "$($gitRootOutput[0])".Trim()
    if (-not (Test-DeploymentPathEqual -Left $resolvedWorkspace -Right $gitRoot)) {
        throw 'Workspace must be the exact Git repository root, not a parent or subdirectory.'
    }

    $headRevision = Get-VerifiedDeploymentGitState -GitExecutable $gitExecutable -Workspace $resolvedWorkspace -ToolingRelease $ToolingRelease
    $manifestLines = @()
    foreach ($relativePath in (Get-DeploymentCriticalRelativePaths)) {
        $platformRelativePath = $relativePath.Replace(
            '/',
            [System.IO.Path]::DirectorySeparatorChar
        )
        $literalPath = [System.IO.Path]::GetFullPath(
            (Join-Path $resolvedWorkspace $platformRelativePath)
        )
        $workspacePrefix = (Get-NormalizedDeploymentPath -Path $resolvedWorkspace) +
            [System.IO.Path]::DirectorySeparatorChar
        if (-not $literalPath.StartsWith(
            $workspacePrefix,
            $(if ([System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT) {
                [System.StringComparison]::OrdinalIgnoreCase
            } else {
                [System.StringComparison]::Ordinal
            })
        )) {
            throw "Deployment-critical path escaped the exact workspace: $relativePath"
        }
        if (-not (Test-Path -LiteralPath $literalPath -PathType Leaf)) {
            throw "Required deployment-critical file is missing: $relativePath"
        }
        $trackedOutput = @(
            & $gitExecutable -C $resolvedWorkspace ls-files --error-unmatch -- $relativePath 2>$null
        )
        if ($LASTEXITCODE -ne 0 -or $trackedOutput.Count -ne 1) {
            throw "Deployment-critical file is not exactly one tracked file: $relativePath"
        }
        $fileHash = Get-DeploymentFileSha256 -LiteralPath $literalPath
        $manifestLines += "$fileHash  $relativePath"
    }

    $verifiedAgain = Get-VerifiedDeploymentGitState -GitExecutable $gitExecutable -Workspace $resolvedWorkspace -ToolingRelease $ToolingRelease
    if ($verifiedAgain -ne $headRevision) {
        throw 'Deployment tooling Git HEAD changed while source evidence was generated.'
    }

    $lineFeed = [string][char]10
    $manifestContent = ($manifestLines -join $lineFeed) + $lineFeed
    $manifestHash = Get-DeploymentTextSha256 -Content $manifestContent
    $identityContent = @(
        'schema_version=1'
        "tooling_release=$ToolingRelease"
        "head_revision=$headRevision"
        'worktree_clean=true'
        "critical_file_count=$($manifestLines.Count)"
        'critical_manifest=deployment-source-manifest.sha256'
        "critical_manifest_sha256=$manifestHash"
    ) -join $lineFeed
    $identityContent += $lineFeed

    Write-ImmutableDeploymentEvidence -LiteralPath (
        Join-Path $resolvedEvidenceDirectory 'deployment-source-manifest.sha256'
    ) -Content $manifestContent
    Write-ImmutableDeploymentEvidence -LiteralPath (
        Join-Path $resolvedEvidenceDirectory 'deployment-source-identity.txt'
    ) -Content $identityContent
}

function Assert-NginxUpstreamTemplate {
    param(
        [Parameter(Mandatory = $true)][string]$Workspace,
        [Parameter(Mandatory = $true)]
        [ValidateSet('blue', 'green')]
        [string]$Color,
        [Parameter(Mandatory = $true)][string]$EvidenceDirectory
    )

    $templatePath = Join-Path $Workspace "infrastructure/upstreams/$Color.conf"
    if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
        throw "The $Color Nginx upstream template is missing."
    }
    $content = Get-Content -LiteralPath $templatePath -Raw
    $blockMatches = [regex]::Matches(
        $content,
        '(?ms)^[\t ]*upstream[\t ]+(?<name>[A-Za-z0-9_-]+)[\t ]*\{(?<body>.*?)^[\t ]*\}[\t ]*$'
    )
    if ($blockMatches.Count -ne 2) {
        throw "The $Color Nginx template must contain exactly two upstream blocks."
    }

    $expectedByBlock = if ($Color -eq 'blue') {
        @{ frontend = 'frontend1:3000'; backend = 'api1:8000' }
    }
    else {
        @{ frontend = 'frontend2:3000'; backend = 'api2:8000' }
    }
    $actualByBlock = @{}
    foreach ($blockMatch in $blockMatches) {
        $blockName = $blockMatch.Groups['name'].Value
        if (-not $expectedByBlock.ContainsKey($blockName)) {
            throw "The $Color Nginx template contains unexpected upstream $blockName."
        }
        if ($actualByBlock.ContainsKey($blockName)) {
            throw "The $Color Nginx template contains duplicate upstream $blockName."
        }
        $serverMatches = [regex]::Matches(
            $blockMatch.Groups['body'].Value,
            '(?m)^[\t ]*server[\t ]+([^;\s]+)[\t ]*;[\t ]*$'
        )
        if ($serverMatches.Count -ne 1) {
            throw "The $Color Nginx upstream $blockName must contain exactly one server directive."
        }
        $actualByBlock[$blockName] = $serverMatches[0].Groups[1].Value
    }
    foreach ($blockName in @('frontend', 'backend')) {
        if (
            -not $actualByBlock.ContainsKey($blockName) -or
            $actualByBlock[$blockName] -ne $expectedByBlock[$blockName]
        ) {
            throw "The $Color Nginx upstream $blockName does not target $($expectedByBlock[$blockName])."
        }
    }
    $allServerMatches = [regex]::Matches(
        $content,
        '(?m)^[\t ]*server[\t ]+([^;\s]+)[\t ]*;[\t ]*$'
    )
    if ($allServerMatches.Count -ne 2) {
        throw "The $Color Nginx template must contain exactly two server directives in total."
    }

    $templateHash = Get-DeploymentFileSha256 -LiteralPath $templatePath
    $lineFeed = [string][char]10
    $templateEvidence = @(
        "color=$Color"
        "template_path=infrastructure/upstreams/$Color.conf"
        "template_sha256=$templateHash"
        'upstream_count=2'
        "frontend_target=$($actualByBlock['frontend'])"
        "backend_target=$($actualByBlock['backend'])"
    ) -join $lineFeed
    $templateEvidence += $lineFeed
    Write-ImmutableDeploymentEvidence -LiteralPath (
        Join-Path $EvidenceDirectory "nginx-$Color-template.txt"
    ) -Content $templateEvidence
    return $templateHash
}
