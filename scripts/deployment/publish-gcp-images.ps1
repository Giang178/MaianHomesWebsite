param(
    [Parameter(Mandatory = $true)]
    [string]$Project,
    [string]$Region = "asia-southeast1",
    [string]$Repository = "maian",
    [string]$Release = "",
    [switch]$BreakGlassReuseExistingImmutableShaTag,
    [switch]$InitialProvisioning
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
foreach ($command in @("git", "docker", "gcloud")) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "$command is required."
    }
}

function Assert-RepositoryUsesImmutableTags {
    $settingOutput = @(
        & gcloud artifacts repositories describe $Repository --project $Project --location $Region "--format=value(dockerConfig.immutableTags)" --quiet 2>$null
    )
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to verify immutable tags for Artifact Registry repository $Repository. No image was pushed."
    }
    $settings = @(
        $settingOutput |
            ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } |
            Where-Object { $_ }
    )
    if (
        $settings.Count -ne 1 -or
        $settings[0] -notin @("true", "false")
    ) {
        throw "Artifact Registry returned an unreadable immutable-tag setting for repository $Repository. No image was pushed."
    }
    if ($settings[0] -eq "true") {
        return
    }

    throw "Artifact Registry repository $Repository must have dockerConfig.immutableTags=true. Refusing a race-prone publish."
}

function Test-RemoteShaTagExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ImageName,
        [Parameter(Mandatory = $true)]
        [string]$Tag
    )

    $taggedImage = "{0}:{1}" -f $ImageName, $Tag
    $repositoryPath = "{0}-docker.pkg.dev/{1}/{2}" -f $Region, $Project, $Repository
    $tagOutput = @(
        & gcloud artifacts docker tags list $repositoryPath "--format=value(image,tag)" --quiet 2>$null
    )
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to verify whether remote SHA tag exists for $ImageName. No image was pushed."
    }

    $remoteTagRows = @(
        $tagOutput |
            ForEach-Object { ([string]$_).Trim() } |
            Where-Object { $_ }
    )
    foreach ($row in $remoteTagRows) {
        $fields = @(([string]$row).Split([char]9))
        if ($fields.Count -ne 2) {
            throw "Artifact Registry returned an unreadable image/tag row. No image was pushed."
        }
        $remoteImage = $fields[0].Trim()
        $remoteTag = $fields[1].Trim()
        if (
            $remoteImage -eq $ImageName -and
            (
                $remoteTag -eq $taggedImage -or
                $remoteTag -eq $Tag
            )
        ) {
            return $true
        }
    }
    return $false
}

function Get-RemoteShaTagReuseDecision {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ImageName,
        [Parameter(Mandatory = $true)]
        [string]$Tag,
        [Parameter(Mandatory = $true)]
        [string]$Phase
    )

    $tagExists = Test-RemoteShaTagExists -ImageName $ImageName -Tag $Tag
    if (-not $tagExists) {
        return $false
    }

    $taggedImage = "{0}:{1}" -f $ImageName, $Tag
    if (-not $BreakGlassReuseExistingImmutableShaTag) {
        throw "Remote SHA tag already exists at $taggedImage. Refusing to overwrite or silently reuse immutable release identity during $Phase."
    }

    Write-Warning "BREAK GLASS: reusing existing immutable SHA tag $taggedImage during $Phase. This script will not push or move that tag; re-review the resolved digest."
    return $true
}

function Resolve-PushedDigestReference {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ImageName,
        [Parameter(Mandatory = $true)]
        [string]$Tag
    )

    $taggedImage = "{0}:{1}" -f $ImageName, $Tag
    $digestOutput = @(
        & gcloud artifacts docker images describe $taggedImage "--format=value(image_summary.digest)" --quiet 2>$null
    )
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to resolve the pushed digest for $taggedImage."
    }

    $digests = @(
        $digestOutput |
            ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } |
            Where-Object { $_ }
    )
    if ($digests.Count -ne 1 -or $digests[0] -notmatch "^sha256:[0-9a-f]{64}$") {
        throw "Artifact Registry did not return one valid sha256 digest for $taggedImage."
    }
    return "{0}@{1}" -f $ImageName, $digests[0]
}

function Assert-ReusedBackendRevision {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DigestImage,
        [Parameter(Mandatory = $true)]
        [string]$ExpectedRelease
    )

    docker pull $DigestImage
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to pull reused backend digest for revision verification."
    }
    $revisionOutput = @(
        docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' $DigestImage 2>$null
    )
    if ($LASTEXITCODE -ne 0 -or $revisionOutput.Count -ne 1) {
        throw "Unable to inspect the reused backend digest revision."
    }
    $revision = ([string]$revisionOutput[0]).Trim().ToLowerInvariant()
    if ($revision -ne $ExpectedRelease) {
        throw "Reused backend digest revision does not match current Git HEAD."
    }
}

$snapshotPath = $null
Push-Location $workspace
try {
    $headOutput = @(git rev-parse --verify HEAD 2>$null)
    if ($LASTEXITCODE -ne 0 -or $headOutput.Count -ne 1) {
        throw "Unable to resolve the current Git HEAD."
    }
    $headSha = ([string]$headOutput[0]).Trim().ToLowerInvariant()
    if ($headSha -notmatch "^[0-9a-f]{40}$") {
        throw "Current Git HEAD is not a full immutable commit SHA."
    }

    if ($Release) {
        if ($Release -notmatch "^[0-9a-fA-F]{7,40}$") {
            throw "Release must be an immutable Git SHA."
        }
        $requestedOutput = @(git rev-parse --verify ("{0}^{{commit}}" -f $Release) 2>$null)
        if ($LASTEXITCODE -ne 0 -or $requestedOutput.Count -ne 1) {
            throw "Release does not resolve to a commit in the current repository."
        }
        $requestedCommit = ([string]$requestedOutput[0]).Trim().ToLowerInvariant()
        if ($requestedCommit -ne $headSha) {
            throw "Release must resolve to the current Git HEAD. Requested=$requestedCommit HEAD=$headSha"
        }
    }
    $Release = $headSha
    if ($Release -notmatch "^[0-9a-f]{40}$") {
        throw "Release must be an immutable Git SHA."
    }
    $worktreeStatus = @(git status --porcelain=v1 --untracked-files=all 2>$null)
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to verify the Git worktree state."
    }
    if ($worktreeStatus.Count -gt 0) {
        throw "Worktree is dirty. Commit and review changes before publishing images."
    }
    $snapshotPath = Join-Path ([System.IO.Path]::GetTempPath()) (
        "maian-publish-{0}-{1}" -f $Release, [Guid]::NewGuid().ToString("N")
    )
    git worktree add --detach $snapshotPath $Release 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to create an isolated Git snapshot for the release build."
    }
    $snapshotHead = @(git -C $snapshotPath rev-parse --verify HEAD 2>$null)
    $snapshotStatus = @(git -C $snapshotPath status --porcelain=v1 --untracked-files=all 2>$null)
    if (
        $LASTEXITCODE -ne 0 -or
        $snapshotHead.Count -ne 1 -or
        ([string]$snapshotHead[0]).Trim().ToLowerInvariant() -ne $Release -or
        $snapshotStatus.Count -ne 0
    ) {
        throw "Isolated build snapshot is not the exact clean release commit."
    }

    $registry = "$Region-docker.pkg.dev"
    $prefix = "$registry/$Project/$Repository"
    $backendImageName = "$prefix/maian-backend"
    $frontendImageName = "$prefix/maian-frontend"
    $backendTaggedImage = "{0}:{1}" -f $backendImageName, $Release
    $frontendTaggedImage = "{0}:{1}" -f $frontendImageName, $Release

    gcloud auth configure-docker $registry --quiet
    if ($LASTEXITCODE -ne 0) { throw "Artifact Registry authentication failed." }

    Assert-RepositoryUsesImmutableTags
    $reuseBackendTag = Get-RemoteShaTagReuseDecision -ImageName $backendImageName -Tag $Release -Phase "pre-build"
    $reuseFrontendTag = Get-RemoteShaTagReuseDecision -ImageName $frontendImageName -Tag $Release -Phase "pre-build"
    if (
        $BreakGlassReuseExistingImmutableShaTag -and
        -not $reuseBackendTag -and
        -not $reuseFrontendTag
    ) {
        throw "Break-glass reuse was requested, but neither immutable SHA tag exists. Re-run without the break-glass switch."
    }
    $backendDigestImage = $null
    $frontendDigestImage = $null
    if ($reuseBackendTag) {
        $backendDigestImage = Resolve-PushedDigestReference -ImageName $backendImageName -Tag $Release
        Assert-ReusedBackendRevision -DigestImage $backendDigestImage -ExpectedRelease $Release
    }
    if ($reuseFrontendTag) {
        $frontendDigestImage = Resolve-PushedDigestReference -ImageName $frontendImageName -Tag $Release
    }

    if (-not $reuseBackendTag) {
        docker build --pull --build-arg "APP_RELEASE=$Release" --tag $backendTaggedImage (Join-Path $snapshotPath "backend")
        if ($LASTEXITCODE -ne 0) { throw "Backend image build failed." }
    }
    if (-not $reuseFrontendTag) {
        docker build --pull --tag $frontendTaggedImage (Join-Path $snapshotPath "frontend")
        if ($LASTEXITCODE -ne 0) { throw "Frontend image build failed." }
    }

    if (-not $reuseBackendTag) {
        Assert-RepositoryUsesImmutableTags
        $reuseBackendTag = Get-RemoteShaTagReuseDecision -ImageName $backendImageName -Tag $Release -Phase "pre-push"
        if (-not $reuseBackendTag) {
            docker push $backendTaggedImage
            if ($LASTEXITCODE -ne 0) { throw "Backend image push failed." }
        }
        $backendDigestImage = Resolve-PushedDigestReference -ImageName $backendImageName -Tag $Release
        if ($reuseBackendTag) {
            Assert-ReusedBackendRevision -DigestImage $backendDigestImage -ExpectedRelease $Release
        }
    }
    if (-not $reuseFrontendTag) {
        Assert-RepositoryUsesImmutableTags
        $reuseFrontendTag = Get-RemoteShaTagReuseDecision -ImageName $frontendImageName -Tag $Release -Phase "pre-push"
        if (-not $reuseFrontendTag) {
            docker push $frontendTaggedImage
            if ($LASTEXITCODE -ne 0) { throw "Frontend image push failed." }
        }
        $frontendDigestImage = Resolve-PushedDigestReference -ImageName $frontendImageName -Tag $Release
    }

    if (-not $backendDigestImage -or -not $frontendDigestImage) {
        throw "Both backend and frontend digest-qualified references are required before publishing environment values."
    }

    Write-Output "APP_RELEASE=$Release"
    Write-Output "BACKEND_RELEASE_ID=$Release"
    Write-Output "BACKEND_GREEN_RELEASE=$Release"
    Write-Output "BACKEND_WORKER_GREEN_RELEASE=$Release"
    Write-Output "BACKEND_PUBLISHED_TAG=$backendTaggedImage"
    Write-Output "FRONTEND_PUBLISHED_TAG=$frontendTaggedImage"
    Write-Output "BACKEND_RELEASE_IMAGE=$backendDigestImage"
    Write-Output "BACKEND_GREEN_IMAGE=$backendDigestImage"
    Write-Output "BACKEND_WORKER_GREEN_IMAGE=$backendDigestImage"
    Write-Output "FRONTEND_GREEN_IMAGE=$frontendDigestImage"
    if ($InitialProvisioning) {
        Write-Output "BACKEND_BLUE_RELEASE=$Release"
        Write-Output "BACKEND_WORKER_RELEASE=$Release"
        Write-Output "BACKEND_WORKER_BLUE_RELEASE=$Release"
        Write-Output "BACKEND_BLUE_IMAGE=$backendDigestImage"
        Write-Output "BACKEND_WORKER_IMAGE=$backendDigestImage"
        Write-Output "BACKEND_WORKER_BLUE_IMAGE=$backendDigestImage"
        Write-Output "FRONTEND_BLUE_IMAGE=$frontendDigestImage"
    } else {
        Write-Warning 'Candidate values intentionally exclude blue/current-worker pointers. Retain the proven rollback image and release; do not overwrite them during a green release.'
    }
}
finally {
    if ($snapshotPath) {
        git worktree remove --force $snapshotPath 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Unable to remove isolated release snapshot $snapshotPath; remove it manually after verifying the path."
        }
    }
    Pop-Location
}
