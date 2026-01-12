#!/bin/bash
# =============================================================================
# ARC Investment Factory - Production Deployment Script
# =============================================================================
# Complete deployment script for Digital Ocean
#
# Usage:
#   ./deploy.sh [--init|--update|--rollback]
#
# Options:
#   --init      First-time deployment (full setup)
#   --update    Update existing deployment
#   --rollback  Rollback to previous version
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/arc"
BACKUP_DIR="/var/backups/arc"
LOG_DIR="/var/log/arc"
COMPOSE_FILE="docker-compose.prod.yml"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."
    
    # Check if running as root or with sudo
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run as root or with sudo"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if .env.production exists
    if [ ! -f "${APP_DIR}/.env.production" ]; then
        log_error ".env.production file not found in ${APP_DIR}"
        log_info "Please copy .env.example to .env.production and configure it"
        exit 1
    fi
    
    log_success "All requirements met"
}

create_directories() {
    log_info "Creating directories..."
    
    mkdir -p "${APP_DIR}"
    mkdir -p "${BACKUP_DIR}"
    mkdir -p "${LOG_DIR}"
    mkdir -p "${APP_DIR}/deploy/ssl"
    
    log_success "Directories created"
}

backup_current() {
    log_info "Creating backup of current deployment..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="${BACKUP_DIR}/pre_deploy_${TIMESTAMP}"
    
    mkdir -p "${BACKUP_PATH}"
    
    # Backup docker-compose file
    if [ -f "${APP_DIR}/${COMPOSE_FILE}" ]; then
        cp "${APP_DIR}/${COMPOSE_FILE}" "${BACKUP_PATH}/"
    fi
    
    # Backup environment file
    if [ -f "${APP_DIR}/.env.production" ]; then
        cp "${APP_DIR}/.env.production" "${BACKUP_PATH}/"
    fi
    
    # Backup database
    if docker ps | grep -q arc-postgres; then
        log_info "Backing up database..."
        docker exec arc-postgres-prod pg_dump -U arc arc_investment | gzip > "${BACKUP_PATH}/database.sql.gz" || true
    fi
    
    # Save current image tags
    docker images --format "{{.Repository}}:{{.Tag}}" | grep "arc" > "${BACKUP_PATH}/images.txt" || true
    
    log_success "Backup created at ${BACKUP_PATH}"
    echo "${BACKUP_PATH}" > "${BACKUP_DIR}/latest_backup"
}

pull_latest_code() {
    log_info "Pulling latest code from repository..."
    
    cd "${APP_DIR}"
    
    # Stash any local changes
    git stash || true
    
    # Pull latest
    git fetch origin main
    git reset --hard origin/main
    
    log_success "Code updated"
}

build_images() {
    log_info "Building Docker images..."
    
    cd "${APP_DIR}"
    
    # Build all images
    docker-compose -f "${COMPOSE_FILE}" build --no-cache
    
    log_success "Images built"
}

pull_images() {
    log_info "Pulling Docker images..."
    
    cd "${APP_DIR}"
    
    # Pull all images
    docker-compose -f "${COMPOSE_FILE}" pull
    
    log_success "Images pulled"
}

run_migrations() {
    log_info "Running database migrations..."
    
    cd "${APP_DIR}"
    
    # Wait for database to be ready
    log_info "Waiting for database..."
    sleep 10
    
    # Run migrations
    docker-compose -f "${COMPOSE_FILE}" exec -T api node packages/database/dist/migrations/run.js || {
        log_warning "Migration script not found, running SQL directly..."
        docker-compose -f "${COMPOSE_FILE}" exec -T postgres psql -U arc -d arc_investment -f /docker-entrypoint-initdb.d/001_initial_schema.sql || true
    }
    
    log_success "Migrations completed"
}

deploy_services() {
    log_info "Deploying services..."
    
    cd "${APP_DIR}"
    
    # Stop existing services
    docker-compose -f "${COMPOSE_FILE}" down --remove-orphans || true
    
    # Start services
    docker-compose -f "${COMPOSE_FILE}" up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30
    
    # Check health
    check_health
    
    log_success "Services deployed"
}

check_health() {
    log_info "Checking service health..."
    
    # Check API health
    if curl -sf http://localhost:3001/health > /dev/null; then
        log_success "API is healthy"
    else
        log_error "API health check failed"
        return 1
    fi
    
    # Check Web health
    if curl -sf http://localhost:3000 > /dev/null; then
        log_success "Web is healthy"
    else
        log_warning "Web health check failed (may still be starting)"
    fi
    
    # Check database connection
    if docker-compose -f "${COMPOSE_FILE}" exec -T postgres pg_isready -U arc > /dev/null 2>&1; then
        log_success "Database is healthy"
    else
        log_error "Database health check failed"
        return 1
    fi
    
    return 0
}

setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    cd "${APP_DIR}"
    
    # Check if domain is configured
    if [ -z "${DOMAIN_NAME}" ]; then
        log_warning "DOMAIN_NAME not set, skipping SSL setup"
        return
    fi
    
    # Check if certificates already exist
    if [ -f "${APP_DIR}/deploy/ssl/live/${DOMAIN_NAME}/fullchain.pem" ]; then
        log_info "SSL certificates already exist"
        return
    fi
    
    # Request certificates using certbot
    docker run --rm \
        -v "${APP_DIR}/deploy/ssl:/etc/letsencrypt" \
        -v "/var/www/certbot:/var/www/certbot" \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "${ADMIN_EMAIL:-admin@${DOMAIN_NAME}}" \
        --agree-tos \
        --no-eff-email \
        -d "${DOMAIN_NAME}" \
        -d "www.${DOMAIN_NAME}" \
        -d "api.${DOMAIN_NAME}"
    
    log_success "SSL certificates obtained"
}

cleanup() {
    log_info "Cleaning up..."
    
    # Remove old images
    docker image prune -f
    
    # Remove old backups (keep last 5)
    cd "${BACKUP_DIR}"
    ls -dt pre_deploy_* 2>/dev/null | tail -n +6 | xargs rm -rf || true
    
    log_success "Cleanup completed"
}

rollback() {
    log_info "Rolling back to previous version..."
    
    # Get latest backup path
    if [ ! -f "${BACKUP_DIR}/latest_backup" ]; then
        log_error "No backup found to rollback to"
        exit 1
    fi
    
    BACKUP_PATH=$(cat "${BACKUP_DIR}/latest_backup")
    
    if [ ! -d "${BACKUP_PATH}" ]; then
        log_error "Backup directory not found: ${BACKUP_PATH}"
        exit 1
    fi
    
    # Restore docker-compose file
    if [ -f "${BACKUP_PATH}/${COMPOSE_FILE}" ]; then
        cp "${BACKUP_PATH}/${COMPOSE_FILE}" "${APP_DIR}/"
    fi
    
    # Restore environment file
    if [ -f "${BACKUP_PATH}/.env.production" ]; then
        cp "${BACKUP_PATH}/.env.production" "${APP_DIR}/"
    fi
    
    # Restore database
    if [ -f "${BACKUP_PATH}/database.sql.gz" ]; then
        log_info "Restoring database..."
        gunzip -c "${BACKUP_PATH}/database.sql.gz" | docker exec -i arc-postgres-prod psql -U arc arc_investment
    fi
    
    # Restart services
    cd "${APP_DIR}"
    docker-compose -f "${COMPOSE_FILE}" down
    docker-compose -f "${COMPOSE_FILE}" up -d
    
    log_success "Rollback completed"
}

init_deployment() {
    log_info "Starting initial deployment..."
    
    check_requirements
    create_directories
    pull_latest_code
    build_images
    deploy_services
    run_migrations
    setup_ssl
    cleanup
    
    log_success "Initial deployment completed!"
    log_info "Application is available at: http://$(hostname -I | awk '{print $1}')"
}

update_deployment() {
    log_info "Starting update deployment..."
    
    check_requirements
    backup_current
    pull_latest_code
    pull_images
    deploy_services
    run_migrations
    cleanup
    
    log_success "Update deployment completed!"
}

# Main
main() {
    echo "=============================================="
    echo "ARC Investment Factory - Deployment"
    echo "=============================================="
    echo ""
    
    case "${1:-update}" in
        --init)
            init_deployment
            ;;
        --update)
            update_deployment
            ;;
        --rollback)
            rollback
            ;;
        --health)
            check_health
            ;;
        *)
            echo "Usage: $0 [--init|--update|--rollback|--health]"
            exit 1
            ;;
    esac
}

main "$@"
