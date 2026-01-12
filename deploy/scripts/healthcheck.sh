#!/bin/bash
# =============================================================================
# ARC Investment Factory - Health Check Script
# =============================================================================
# Comprehensive health check for all services
#
# Usage:
#   ./healthcheck.sh [--json] [--verbose]
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
REDIS_HOST="${REDIS_HOST:-localhost}"

# Parse arguments
JSON_OUTPUT=false
VERBOSE=false
for arg in "$@"; do
    case $arg in
        --json) JSON_OUTPUT=true ;;
        --verbose) VERBOSE=true ;;
    esac
done

# Initialize results
declare -A RESULTS
OVERALL_STATUS="healthy"

# Health check functions
check_api() {
    local status="unhealthy"
    local message=""
    local latency=""
    
    START=$(date +%s%N)
    if response=$(curl -sf -w "\n%{http_code}" "${API_URL}/health" 2>/dev/null); then
        END=$(date +%s%N)
        latency=$(( (END - START) / 1000000 ))
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n-1)
        
        if [ "$http_code" = "200" ]; then
            status="healthy"
            message="API responding (${latency}ms)"
        else
            status="unhealthy"
            message="API returned HTTP ${http_code}"
            OVERALL_STATUS="unhealthy"
        fi
    else
        status="unhealthy"
        message="API not responding"
        OVERALL_STATUS="unhealthy"
    fi
    
    RESULTS["api"]="${status}|${message}|${latency:-0}"
}

check_web() {
    local status="unhealthy"
    local message=""
    local latency=""
    
    START=$(date +%s%N)
    if response=$(curl -sf -w "\n%{http_code}" "${WEB_URL}" 2>/dev/null); then
        END=$(date +%s%N)
        latency=$(( (END - START) / 1000000 ))
        http_code=$(echo "$response" | tail -n1)
        
        if [ "$http_code" = "200" ]; then
            status="healthy"
            message="Web responding (${latency}ms)"
        else
            status="degraded"
            message="Web returned HTTP ${http_code}"
        fi
    else
        status="unhealthy"
        message="Web not responding"
        OVERALL_STATUS="degraded"
    fi
    
    RESULTS["web"]="${status}|${message}|${latency:-0}"
}

check_postgres() {
    local status="unhealthy"
    local message=""
    
    if docker exec arc-postgres-prod pg_isready -U arc > /dev/null 2>&1; then
        status="healthy"
        message="PostgreSQL accepting connections"
    elif docker exec arc-postgres pg_isready -U arc > /dev/null 2>&1; then
        status="healthy"
        message="PostgreSQL accepting connections"
    else
        status="unhealthy"
        message="PostgreSQL not responding"
        OVERALL_STATUS="unhealthy"
    fi
    
    RESULTS["postgres"]="${status}|${message}|0"
}

check_redis() {
    local status="unhealthy"
    local message=""
    
    if docker exec arc-redis-prod redis-cli ping > /dev/null 2>&1; then
        status="healthy"
        message="Redis responding to PING"
    elif docker exec arc-redis redis-cli ping > /dev/null 2>&1; then
        status="healthy"
        message="Redis responding to PING"
    else
        status="unhealthy"
        message="Redis not responding"
        OVERALL_STATUS="degraded"
    fi
    
    RESULTS["redis"]="${status}|${message}|0"
}

check_worker() {
    local status="unhealthy"
    local message=""
    
    if docker ps | grep -q "arc-worker"; then
        # Check if worker container is healthy
        worker_status=$(docker inspect --format='{{.State.Status}}' arc-worker-prod 2>/dev/null || docker inspect --format='{{.State.Status}}' arc-worker 2>/dev/null)
        if [ "$worker_status" = "running" ]; then
            status="healthy"
            message="Worker container running"
        else
            status="degraded"
            message="Worker container status: ${worker_status}"
        fi
    else
        status="unhealthy"
        message="Worker container not found"
        OVERALL_STATUS="degraded"
    fi
    
    RESULTS["worker"]="${status}|${message}|0"
}

check_disk() {
    local status="healthy"
    local message=""
    
    disk_usage=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
    
    if [ "$disk_usage" -gt 95 ]; then
        status="unhealthy"
        message="Disk usage critical: ${disk_usage}%"
        OVERALL_STATUS="unhealthy"
    elif [ "$disk_usage" -gt 85 ]; then
        status="degraded"
        message="Disk usage high: ${disk_usage}%"
    else
        status="healthy"
        message="Disk usage: ${disk_usage}%"
    fi
    
    RESULTS["disk"]="${status}|${message}|${disk_usage}"
}

check_memory() {
    local status="healthy"
    local message=""
    
    mem_usage=$(free | awk '/Mem:/ {printf("%.0f", $3/$2 * 100)}')
    
    if [ "$mem_usage" -gt 95 ]; then
        status="unhealthy"
        message="Memory usage critical: ${mem_usage}%"
        OVERALL_STATUS="unhealthy"
    elif [ "$mem_usage" -gt 85 ]; then
        status="degraded"
        message="Memory usage high: ${mem_usage}%"
    else
        status="healthy"
        message="Memory usage: ${mem_usage}%"
    fi
    
    RESULTS["memory"]="${status}|${message}|${mem_usage}"
}

# Run all checks
check_api
check_web
check_postgres
check_redis
check_worker
check_disk
check_memory

# Output results
if [ "$JSON_OUTPUT" = true ]; then
    echo "{"
    echo "  \"status\": \"${OVERALL_STATUS}\","
    echo "  \"timestamp\": \"$(date -Iseconds)\","
    echo "  \"checks\": {"
    first=true
    for service in "${!RESULTS[@]}"; do
        IFS='|' read -r status message latency <<< "${RESULTS[$service]}"
        [ "$first" = true ] && first=false || echo ","
        echo -n "    \"${service}\": {\"status\": \"${status}\", \"message\": \"${message}\", \"latency_ms\": ${latency}}"
    done
    echo ""
    echo "  }"
    echo "}"
else
    echo "=============================================="
    echo "ARC Investment Factory - Health Check"
    echo "=============================================="
    echo "Timestamp: $(date)"
    echo ""
    
    for service in api web postgres redis worker disk memory; do
        if [ -n "${RESULTS[$service]}" ]; then
            IFS='|' read -r status message latency <<< "${RESULTS[$service]}"
            
            case $status in
                healthy)  icon="${GREEN}✓${NC}" ;;
                degraded) icon="${YELLOW}⚠${NC}" ;;
                unhealthy) icon="${RED}✗${NC}" ;;
            esac
            
            printf "%-12s ${icon} %s\n" "${service}:" "${message}"
        fi
    done
    
    echo ""
    echo "----------------------------------------------"
    case $OVERALL_STATUS in
        healthy)   echo -e "Overall Status: ${GREEN}HEALTHY${NC}" ;;
        degraded)  echo -e "Overall Status: ${YELLOW}DEGRADED${NC}" ;;
        unhealthy) echo -e "Overall Status: ${RED}UNHEALTHY${NC}" ;;
    esac
    echo "=============================================="
fi

# Exit with appropriate code
case $OVERALL_STATUS in
    healthy)   exit 0 ;;
    degraded)  exit 1 ;;
    unhealthy) exit 2 ;;
esac
