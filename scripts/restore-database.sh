#!/bin/bash
# Database restore script for FiskAI
# Usage: ./restore-database.sh <backup_file.sql.gz>

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -la /var/backups/fiskai/fiskai_*.sql.gz 2>/dev/null || echo "  No backups found in /var/backups/fiskai/"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Load environment variables if .env exists
if [ -f "$(dirname "$0")/../.env" ]; then
    export $(grep -v '^#' "$(dirname "$0")/../.env" | xargs)
fi

# Parse DATABASE_URL or use individual vars
if [ -n "${DATABASE_URL:-}" ]; then
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

echo "================================================================"
echo "WARNING: This will OVERWRITE the current database!"
echo "================================================================"
echo ""
echo "Database: $PGDATABASE on $PGHOST:$PGPORT"
echo "Backup:   $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo "[$(date -Iseconds)] Starting database restore..."

# Create a backup of current database before restore
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PRE_RESTORE_BACKUP="/var/backups/fiskai/pre_restore_${TIMESTAMP}.sql.gz"

echo "[$(date -Iseconds)] Creating pre-restore backup: $PRE_RESTORE_BACKUP"
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
    --format=custom --no-owner --no-privileges | gzip > "$PRE_RESTORE_BACKUP"

echo "[$(date -Iseconds)] Restoring from: $BACKUP_FILE"

# Drop and recreate database (or use pg_restore --clean)
# Using pg_restore with --clean flag to drop objects before recreating
gunzip -c "$BACKUP_FILE" | pg_restore -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
    --clean --if-exists --no-owner --no-privileges 2>&1 || true

echo "[$(date -Iseconds)] Restore completed!"
echo ""
echo "Pre-restore backup saved to: $PRE_RESTORE_BACKUP"
echo ""
echo "Verify the restore by checking the application."
