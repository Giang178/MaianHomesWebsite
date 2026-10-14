param(
  [switch]$BackendOnly,
  [switch]$FrontendOnly
)

$ErrorActionPreference = 'Stop'

if ($BackendOnly -and $FrontendOnly) {
  throw 'Choose either -BackendOnly or -FrontendOnly, not both.'
}

function Get-ListeningProcessIds {
  param([int]$Port)

  $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
  return @(netstat -ano -p tcp | ForEach-Object {
    if ($_ -match $pattern) { [int]$Matches[1] }
  } | Sort-Object -Unique)
}

function Stop-DevListener {
  param(
    [int]$Port,
    [string]$ServiceName
  )

  $processIds = @(Get-ListeningProcessIds -Port $Port)
  if ($processIds.Count -eq 0) {
    Write-Host "$ServiceName is not listening on port $Port."
    return
  }

  foreach ($processId in $processIds) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($null -eq $process) { continue }
    Write-Host "Stopping $ServiceName on port $Port (PID $processId, $($process.ProcessName))..."
    Stop-Process -Id $processId -Force
  }
}

if (-not $FrontendOnly) {
  Stop-DevListener -Port 8000 -ServiceName 'Backend'
}
if (-not $BackendOnly) {
  Stop-DevListener -Port 3000 -ServiceName 'Frontend'
}