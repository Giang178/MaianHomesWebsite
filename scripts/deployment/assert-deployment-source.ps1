param(
    [Parameter(Mandatory = $true)][string]$Workspace,
    [Parameter(Mandatory = $true)][string]$ToolingRelease,
    [Parameter(Mandatory = $true)][string]$EvidenceDirectory
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'deployment-source-guard.ps1')

Assert-DeploymentSourceIdentity -Workspace $Workspace `
    -ToolingRelease $ToolingRelease -EvidenceDirectory $EvidenceDirectory
Write-Output "Deployment source identity verified at $ToolingRelease."
