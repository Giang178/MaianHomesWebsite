param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern("^[A-Za-z0-9_]+$")]
    [string]$Database,
    [string]$EnvFile = ".env.production",
    [string]$BackupRoot = ".release-artifacts\backups",
    [switch]$KeepRestoreDatabase
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$backupBase = [IO.Path]::GetFullPath((Join-Path $workspace $BackupRoot))
if (-not $backupBase.StartsWith($workspace + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "BackupRoot must remain inside the workspace."
}
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$backupDir = Join-Path $backupBase $stamp
$mongoArchive = Join-Path $backupDir "mongo.archive.gz"
$minioBackup = Join-Path $backupDir "minio"
$restoreDatabase = "${Database}_restore_verify_${stamp}"
$containerArchive = "/tmp/maian-release-${stamp}.archive.gz"
$minioContainer = "maian-minio-restore-${stamp}"
$composeFiles = @(
    "-f", (Join-Path $workspace "docker-compose.yml"),
    "-f", (Join-Path $workspace "docker-compose.production.yml")
)
$envPath = (Resolve-Path (Join-Path $workspace $EnvFile)).Path

New-Item -ItemType Directory -Force -Path $backupDir, $minioBackup | Out-Null
Push-Location $workspace
try {
    docker compose @composeFiles --env-file $envPath exec -T mongo1 mongodump --db $Database --archive=$containerArchive --gzip
    if ($LASTEXITCODE -ne 0) { throw "MongoDB backup failed." }
    docker compose @composeFiles --env-file $envPath cp "mongo1:$containerArchive" $mongoArchive
    if ($LASTEXITCODE -ne 0) { throw "MongoDB archive copy failed." }
    docker compose @composeFiles --env-file $envPath exec -T mongo1 rm -f $containerArchive

    docker compose @composeFiles --env-file $envPath cp "minio:/data/." $minioBackup
    if ($LASTEXITCODE -ne 0) { throw "MinIO backup copy failed." }

    docker compose @composeFiles --env-file $envPath cp $mongoArchive "mongo1:$containerArchive"
    docker compose @composeFiles --env-file $envPath exec -T mongo1 mongorestore --archive=$containerArchive --gzip --drop --nsFrom "$Database.*" --nsTo "$restoreDatabase.*"
    if ($LASTEXITCODE -ne 0) { throw "MongoDB restore drill failed." }
    docker compose @composeFiles --env-file $envPath exec -T mongo1 mongosh --quiet --eval "if (db.getSiblingDB('$restoreDatabase').getCollectionNames().length === 0) { quit(2) }"
    if ($LASTEXITCODE -ne 0) { throw "Restored MongoDB has no collections." }

    docker run --detach --name $minioContainer --mount "type=bind,source=$minioBackup,target=/data" minio/minio:RELEASE.2025-09-07T16-13-09Z server /data | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Temporary MinIO restore container failed to start." }
    docker exec $minioContainer curl --fail http://127.0.0.1:9000/minio/health/live | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Restored MinIO data did not pass the health check." }

    Write-Output "Backup and restore drill passed: $backupDir"
    Write-Output "Temporary MongoDB restore database: $restoreDatabase"
}
finally {
    docker compose @composeFiles --env-file $envPath exec -T mongo1 rm -f $containerArchive 2>$null
    docker rm --force $minioContainer 2>$null | Out-Null
    if (-not $KeepRestoreDatabase) {
        docker compose @composeFiles --env-file $envPath exec -T mongo1 mongosh --quiet --eval "db.getSiblingDB('$restoreDatabase').dropDatabase()" 2>$null | Out-Null
    }
    Pop-Location
}
