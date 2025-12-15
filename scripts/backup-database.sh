#!/bin/bash
# Database backup script for FiskAI
# Run via cron: 0 2 * * * /path/to/backup-database.sh >> /var/log/fiskai-backup.log 2>&1

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/fiskai}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="fiskai_${TIMESTAMP}.sql.gz"

# Load environment variables if .env exists
if [ -f "$(dirname "$0")/../.env" ]; then
    export $(grep -v '^#' "$(dirname "$0")/../.env" | xargs)
fi

# Parse DATABASE_URL or use individual vars
if [ -n "${DATABASE_URL:-}" ]; then
    # Parse postgresql://user:pass@host:port/db
    PGUSER=$(echo "$DATABASE_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
    PGPASSWORD=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
    PGHOST=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^@]+@([^:]+):.*|\1|')
    PGPORT=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^@]+@[^:]+:([0-9]+)/.*|\1|')
    PGDATABASE=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^/]+/([^?]+).*|\1|')
else
    PGUSER="${POSTGRES_USER:-fiskai}"
    PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"
    PGHOST="${POSTGRES_HOST:-localhost}"
    PGPORT="${POSTGRES_PORT:-5432}"
    PGDATABASE="${POSTGRES_DB:-fiskai}"
fi

export PGPASSWORD

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Starting backup of database $PGDATABASE"

# Create backup
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
    --format=custom \
    --no-owner \
    --no-privileges \
    | gzip > "$BACKUP_DIR/$BACKUP_FILE"

# Verify backup was created
if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo "[$(date -Iseconds)] Backup completed: $BACKUP_FILE ($SIZE)"
else
    echo "[$(date -Iseconds)] ERROR: Backup file was not created"
    exit 1
fi

# Clean up old backups
echo "[$(date -Iseconds)] Cleaning up backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name "fiskai_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# List remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "fiskai_*.sql.gz" -type f | wc -l)
echo "[$(date -Iseconds)] Backup complete. $BACKUP_COUNT backups retained."

# Optional: Upload to remote storage (S3, R2, etc.)
# Uncomment and configure as needed:
# if [ -n "${R2_BUCKET_NAME:-}" ]; then
#     aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "s3://$R2_BUCKET_NAME/backups/$BACKUP_FILE" \
#         --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
#     echo "[$(date -Iseconds)] Backup uploaded to R2: $BACKUP_FILE"
# fi
