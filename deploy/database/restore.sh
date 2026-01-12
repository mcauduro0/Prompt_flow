#!/bin/bash
# =============================================================================
# ARC Investment Factory - Database Restore Script
# =============================================================================
# Restores the PostgreSQL database from a backup file
#
# Usage: ./restore.sh <backup_file>
# =============================================================================

set -e

# Check arguments
if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh /var/backups/arc/arc_investment_* 2>/dev/null || echo "No backups found in /var/backups/arc/"
    exit 1
fi

BACKUP_FILE="$1"

# Verify backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Load environment variables
if [ -f /opt/arc/.env.production ]; then
    source /opt/arc/.env.production
fi

# Database connection
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-arc_investment}"
DB_USER="${POSTGRES_USER:-arc}"

echo "=============================================="
echo "ARC Investment Factory - Database Restore"
echo "=============================================="
echo "Timestamp: $(date)"
echo "Backup File: ${BACKUP_FILE}"
echo "Target Database: ${DB_NAME}"
echo ""

# Confirm restore
read -p "WARNING: This will overwrite the current database. Continue? (yes/no): " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Create a backup of current state before restore
echo ""
echo "Creating pre-restore backup..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PRE_RESTORE_BACKUP="/var/backups/arc/pre_restore_${TIMESTAMP}.dump"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --format=custom \
    --file="${PRE_RESTORE_BACKUP}" 2>/dev/null || true

echo "Pre-restore backup created: ${PRE_RESTORE_BACKUP}"

# Decompress if needed
RESTORE_FILE="${BACKUP_FILE}"
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    echo "Decompressing backup..."
    gunzip -c "${BACKUP_FILE}" > "/tmp/restore_temp.dump"
    RESTORE_FILE="/tmp/restore_temp.dump"
fi

# Drop and recreate database
echo ""
echo "Dropping existing database..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" 2>/dev/null || true

PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d postgres \
    -c "DROP DATABASE IF EXISTS ${DB_NAME};"

PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d postgres \
    -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

# Restore from backup
echo ""
echo "Restoring from backup..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --verbose \
    --no-owner \
    --no-privileges \
    "${RESTORE_FILE}"

# Clean up temp file
if [ -f "/tmp/restore_temp.dump" ]; then
    rm -f "/tmp/restore_temp.dump"
fi

# Verify restore
echo ""
echo "Verifying restore..."
TABLE_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -t \
    -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

echo "Tables restored: ${TABLE_COUNT}"

echo ""
echo "Restore completed successfully!"
echo "=============================================="
