#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required}"
: "${BACKUP_REMOTE:?BACKUP_REMOTE is required}"
: "${BACKUP_MINIO_SOURCE:?BACKUP_MINIO_SOURCE rclone remote is required}"

case "$BACKUP_DIR" in
  /|/home|/root|"") echo "Unsafe BACKUP_DIR" >&2; exit 1 ;;
esac

cd "$(dirname "$0")/.."

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR/mongo"

docker compose exec -T mongo1 sh -c 'mongodump --quiet --archive --gzip --oplog ${MONGO_USER:+--username "$MONGO_USER"} ${MONGO_PASSWORD:+--password "$MONGO_PASSWORD"}' \
  | age -r "$BACKUP_AGE_RECIPIENT" -o "$BACKUP_DIR/mongo/mongo-$timestamp.archive.gz.age"

rclone copy "$BACKUP_DIR/mongo/mongo-$timestamp.archive.gz.age" "$BACKUP_REMOTE/mongo/"

# Prune local backups older than 7 days to prevent disk space exhaustion
find "$BACKUP_DIR/mongo" -type f -name "*.archive.gz.age" -mtime +7 -delete

# MinIO data is copied incrementally to external storage; source files are never removed.
rclone copy "$BACKUP_MINIO_SOURCE" "$BACKUP_REMOTE/minio/" --checksum
