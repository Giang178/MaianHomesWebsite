param(
    [string]$Release = "",
    [string]$PublicBaseUrl = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not (Test-Path (Join-Path $workspace ".git"))) {
    throw "Workspace root could not be resolved."
}
if (-not $Release) {
    $Release = (Get-Date -Format "yyyyMMdd-HHmmss")
}
$output = Join-Path $workspace ".release-artifacts\baseline-$Release"
New-Item -ItemType Directory -Force -Path $output | Out-Null

Push-Location $workspace
try {
    git rev-parse HEAD | Set-Content -Encoding utf8 (Join-Path $output "commit.txt")
    git branch --show-current | Set-Content -Encoding utf8 (Join-Path $output "branch.txt")
    git status --porcelain=v1 | Set-Content -Encoding utf8 (Join-Path $output "worktree.txt")
    git diff --stat HEAD | Set-Content -Encoding utf8 (Join-Path $output "diff-stat.txt")
    git ls-files | Sort-Object | Set-Content -Encoding utf8 (Join-Path $output "tracked-files.txt")

    Push-Location (Join-Path $workspace "backend")
    try {
        python -m scripts.export_openapi --output (Join-Path $output "openapi.json")
        if ($LASTEXITCODE -ne 0) { throw "OpenAPI export failed." }
    }
    finally {
        Pop-Location
    }

    if ($PublicBaseUrl) {
        Push-Location (Join-Path $workspace "frontend")
        try {
            $env:CAPTURE_PUBLIC_BASELINE = "1"
            $env:PUBLIC_BASELINE_OUTPUT = (Join-Path $output "public-ui")
            $env:PLAYWRIGHT_BASE_URL = $PublicBaseUrl
            npx playwright test e2e/capture-public-baseline.spec.ts
            if ($LASTEXITCODE -ne 0) { throw "Public UI baseline capture failed." }
        }
        finally {
            Remove-Item Env:CAPTURE_PUBLIC_BASELINE -ErrorAction SilentlyContinue
            Remove-Item Env:PUBLIC_BASELINE_OUTPUT -ErrorAction SilentlyContinue
            Remove-Item Env:PLAYWRIGHT_BASE_URL -ErrorAction SilentlyContinue
            Pop-Location
        }
    }
    Write-Output $output
}
finally {
    Pop-Location
}
