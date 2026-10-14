param(
  [int]$BackendTimeoutSeconds = 90,
  [int]$FrontendTimeoutSeconds = 90
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $repoRoot 'backend'
$frontendRoot = Join-Path $repoRoot 'frontend'
$pythonPath = Join-Path $backendRoot 'venv\Scripts\python.exe'
$logRoot = Join-Path $repoRoot '.dev-logs'

function Test-TcpPort {
  param([int]$Port)

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connection = $client.ConnectAsync('127.0.0.1', $Port)
    return $connection.Wait(1000) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Get-ListeningProcessIds {
  param([int]$Port)

  $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
  return @(netstat -ano -p tcp | ForEach-Object {
    if ($_ -match $pattern) { [int]$Matches[1] }
  } | Sort-Object -Unique)
}

function Test-HttpEndpoint {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Wait-HttpEndpoint {
  param(
    [string]$Url,
    [int]$TimeoutSeconds,
    [string]$ServiceName
  )

  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (Test-HttpEndpoint -Url $Url) { return }
    Start-Sleep -Seconds 1
  }

  throw "$ServiceName did not become ready within $TimeoutSeconds seconds. Check logs in $logRoot."
}

if (-not (Test-TcpPort -Port 27017)) {
  throw 'MongoDB is not running at 127.0.0.1:27017. Start MongoDB first.'
}

if (-not (Test-Path -LiteralPath $pythonPath)) {
  throw "Python virtual environment was not found: $pythonPath"
}

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

$backendReadyUrl = 'http://127.0.0.1:8000/health/ready'
$backendListeners = @(Get-ListeningProcessIds -Port 8000)
if ($backendListeners.Count -gt 1) {
  throw "Multiple backend processes are listening on port 8000: $($backendListeners -join ', '). Run scripts/stop-dev.ps1, then start again."
}
if (-not (Test-HttpEndpoint -Url $backendReadyUrl)) {
  if (Test-TcpPort -Port 8000) {
    throw 'Port 8000 is in use but backend readiness fails. Stop the unresponsive backend process before retrying.'
  }

  $backendStart = @{
    FilePath = $pythonPath
    ArgumentList = @('-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000', '--reload')
    WorkingDirectory = $backendRoot
    WindowStyle = 'Hidden'
    RedirectStandardOutput = (Join-Path $logRoot 'backend.out.log')
    RedirectStandardError = (Join-Path $logRoot 'backend.err.log')
    PassThru = $true
  }
  $backendProcess = Start-Process @backendStart
  Write-Host "Backend started (PID $($backendProcess.Id)); waiting for readiness..."
  Wait-HttpEndpoint -Url $backendReadyUrl -TimeoutSeconds $BackendTimeoutSeconds -ServiceName 'Backend'
} else {
  Write-Host 'Backend is ready.'
}

$frontendListeners = @(Get-ListeningProcessIds -Port 3000)
if ($frontendListeners.Count -gt 1) {
  throw "Multiple frontend processes are listening on port 3000: $($frontendListeners -join ', '). Run scripts/stop-dev.ps1, then start again."
}

if (-not (Test-TcpPort -Port 3000)) {
  $npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
  $frontendStart = @{
    FilePath = $npmPath
    ArgumentList = @('run', 'dev')
    WorkingDirectory = $frontendRoot
    WindowStyle = 'Hidden'
    RedirectStandardOutput = (Join-Path $logRoot 'frontend.out.log')
    RedirectStandardError = (Join-Path $logRoot 'frontend.err.log')
    PassThru = $true
  }
  $frontendProcess = Start-Process @frontendStart
  Write-Host "Frontend started (PID $($frontendProcess.Id)); waiting for a response..."
  Wait-HttpEndpoint -Url 'http://127.0.0.1:3000' -TimeoutSeconds $FrontendTimeoutSeconds -ServiceName 'Frontend'
} else {
  Write-Host 'Frontend is already running on port 3000.'
}

Write-Host 'Development system is ready at http://127.0.0.1:3000'
