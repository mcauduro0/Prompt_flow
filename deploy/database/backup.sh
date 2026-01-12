#!/bin/bash
# =============================================================================
# ARC Investment Factory - Database Backup Script
# =============================================================================
# Creates timestamped backups of the PostgreSQL database
#
# Usage: ./backup.sh [backup_dir]
# =============================================================================

set -e

# Configuration
BACKUP_DIR="${1:-/var/backups/arc}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="arc_investment_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

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
echo "ARC Investment Factory - Database Backup"
echo "=============================================="
echo "Timestamp: $(date)"
echo "Database: ${DB_NAME}"
echo "Backup Directory: ${BACKUP_DIR}"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Perform backup
echo "Creating backup: ${BACKUP_FILE}"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --format=custom \
    --compress=9 \
    --verbose \
    --file="${BACKUP_DIR}/${BACKUP_FILE%.gz}"

# Compress if not using custom format
if [ -f "${BACKUP_DIR}/${BACKUP_FILE%.gz}" ]; then
    gzip -f "${BACKUP_DIR}/${BACKUP_FILE%.gz}"
fi

# Verify backup
if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    echo "Backup created successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    echo "ERROR: Backup file not created!"
    exit 1
fi

# Clean up old backups
echo ""
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "arc_investment_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "arc_investment_*.dump" -type f -mtime +${RETENTION_DAYS} -delete

# List remaining backups
echo ""
echo "Current backups:"
ls -lh "${BACKUP_DIR}"/arc_investment_* 2>/dev/null || echo "No backups found"

echo ""
echo "Backup completed successfully!"
echo "=============================================="
