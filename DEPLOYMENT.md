# ARC Investment Factory - Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the ARC Investment Factory to Digital Ocean. The deployment includes:

- **API Service** - Express.js REST API
- **Web Application** - Next.js frontend
- **Worker Service** - Background job processor (Lane A, Lane B, QA Reports)
- **PostgreSQL** - Primary database
- **Redis** - Job queue and caching
- **Nginx** - Reverse proxy with SSL termination
- **Monitoring Stack** - Prometheus, Grafana, Loki

## Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    Digital Ocean                         │
                    │  ┌─────────────────────────────────────────────────────┐│
                    │  │                     Droplet                          ││
Internet ──────────►│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐         ││
    (HTTPS)         │  │  │  Nginx  │───►│   API   │───►│ Worker  │         ││
                    │  │  │  :443   │    │  :3001  │    │  :9091  │         ││
                    │  │  └────┬────┘    └────┬────┘    └────┬────┘         ││
                    │  │       │              │              │               ││
                    │  │       │         ┌────┴────┐    ┌────┴────┐         ││
                    │  │       │         │   Web   │    │  Redis  │         ││
                    │  │       └────────►│  :3000  │    │  :6379  │         ││
                    │  │                 └─────────┘    └─────────┘         ││
                    │  └─────────────────────────────────────────────────────┘│
                    │                           │                              │
                    │  ┌─────────────────────────────────────────────────────┐│
                    │  │              Managed PostgreSQL                      ││
                    │  │                   :25060                             ││
                    │  └─────────────────────────────────────────────────────┘│
                    └─────────────────────────────────────────────────────────┘
```

## Prerequisites

### Required Accounts & API Keys

| Service | Purpose | Get From |
|---------|---------|----------|
| Digital Ocean | Infrastructure | https://cloud.digitalocean.com |
| OpenAI | LLM (GPT-4) | https://platform.openai.com |
| Anthropic | LLM (Claude) | https://console.anthropic.com |
| FMP | Financial data | https://financialmodelingprep.com |
| Polygon | Market data | https://polygon.io |

### Local Requirements

- Git
- SSH key pair
- Terraform (optional, for IaC)

## Quick Start (Manual Deployment)

### Step 1: Create Droplet

1. Log in to Digital Ocean
2. Create a new Droplet:
   - **Image**: Ubuntu 22.04 LTS
   - **Size**: s-4vcpu-8gb ($48/month) - recommended
   - **Region**: nyc3 (or closest to you)
   - **VPC**: Create new or use existing
   - **SSH Keys**: Add your public key

### Step 2: Initial Server Setup

SSH into your droplet and run the setup script:

```bash
ssh root@YOUR_DROPLET_IP

# Download and run setup script
curl -sSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/scripts/setup-server.sh | sudo bash
```

Or manually:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Set timezone
timedatectl set-timezone America/Sao_Paulo

# Create directories
mkdir -p /opt/arc /var/backups/arc /var/log/arc
chown -R ubuntu:ubuntu /opt/arc /var/backups/arc /var/log/arc
```

### Step 3: Clone Repository

```bash
cd /opt/arc
git clone https://github.com/YOUR_REPO/Prompt_flow.git .
```

### Step 4: Configure Environment

```bash
# Copy example environment file
cp .env.production.example .env.production

# Edit with your values
nano .env.production
```

**Required environment variables:**

```env
# Database
POSTGRES_PASSWORD=your_strong_password_here
DATABASE_URL=postgresql://arc:your_strong_password_here@postgres:5432/arc_investment

# Redis
REDIS_PASSWORD=your_redis_password_here

# Security
JWT_SECRET=your_64_char_random_string_here

# LLM APIs
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Data APIs
FMP_API_KEY=your-fmp-key
POLYGON_API_KEY=your-polygon-key

# Domain
DOMAIN_NAME=your-domain.com
```

### Step 5: Deploy

```bash
# Make scripts executable
chmod +x deploy/scripts/*.sh

# Run initial deployment
sudo ./deploy/scripts/deploy.sh --init
```

### Step 6: Verify Deployment

```bash
# Check service health
./deploy/scripts/healthcheck.sh

# Check container status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 7: Setup SSL (Optional but Recommended)

```bash
# Install certbot
apt install certbot -y

# Get certificates (stop nginx first)
docker-compose -f docker-compose.prod.yml stop nginx
certbot certonly --standalone -d your-domain.com -d www.your-domain.com -d api.your-domain.com

# Copy certificates
cp -r /etc/letsencrypt/live/your-domain.com/* deploy/ssl/

# Restart nginx
docker-compose -f docker-compose.prod.yml up -d nginx
```

## Infrastructure as Code (Terraform)

For automated infrastructure provisioning:

```bash
cd deploy/digitalocean

# Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply changes
terraform apply
```

## CI/CD Pipeline

The repository includes a GitHub Actions workflow for automated deployments:

1. **On Push to `main`**: Runs tests and builds Docker images
2. **On Release**: Deploys to production

### Setup GitHub Secrets

Add these secrets to your GitHub repository:

| Secret | Description |
|--------|-------------|
| `DOCKER_REGISTRY` | ghcr.io |
| `DOCKER_USERNAME` | Your GitHub username |
| `DOCKER_PASSWORD` | GitHub Personal Access Token |
| `SSH_PRIVATE_KEY` | SSH key for droplet access |
| `SSH_HOST` | Droplet IP address |
| `SSH_USER` | ubuntu |

## Monitoring

### Access Grafana

1. Navigate to `http://YOUR_IP:3002`
2. Login with admin/admin (change password immediately)
3. Pre-configured dashboards:
   - System Overview
   - Container Metrics
   - Application Metrics
   - Database Performance

### Access Prometheus

Navigate to `http://YOUR_IP:9090`

### View Logs

```bash
# All logs
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f api

# Using Loki (via Grafana)
# Navigate to Explore → Select Loki → Query logs
```

## Maintenance

### Backup Database

```bash
./deploy/database/backup.sh
```

### Restore Database

```bash
./deploy/database/restore.sh /var/backups/arc/db_backup_TIMESTAMP.sql.gz
```

### Update Deployment

```bash
cd /opt/arc
git pull origin main
sudo ./deploy/scripts/deploy.sh --update
```

### Rollback

```bash
sudo ./deploy/scripts/deploy.sh --rollback
```

### View Scheduled Jobs

```bash
# Check worker logs for scheduled jobs
docker-compose -f docker-compose.prod.yml logs worker | grep -i "scheduled\|cron"
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs SERVICE_NAME

# Check container status
docker inspect SERVICE_NAME

# Restart service
docker-compose -f docker-compose.prod.yml restart SERVICE_NAME
```

### Database Connection Issues

```bash
# Test connection
docker exec arc-postgres-prod psql -U arc -d arc_investment -c "SELECT 1"

# Check connection count
docker exec arc-postgres-prod psql -U arc -d arc_investment -c "SELECT count(*) FROM pg_stat_activity"
```

### High Memory Usage

```bash
# Check memory per container
docker stats

# Clear unused Docker resources
docker system prune -a
```

### SSL Certificate Renewal

```bash
# Renew certificates
certbot renew

# Restart nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

## Cost Estimation

| Resource | Size | Monthly Cost |
|----------|------|--------------|
| Droplet | s-4vcpu-8gb | $48 |
| Managed PostgreSQL | db-s-1vcpu-1gb | $15 |
| Spaces (10GB) | - | $5 |
| Floating IP | - | $4 |
| **Total** | | **~$72/month** |

## Security Checklist

- [ ] Change default passwords
- [ ] Enable UFW firewall
- [ ] Configure fail2ban
- [ ] Enable SSL/TLS
- [ ] Disable root SSH login
- [ ] Use SSH key authentication only
- [ ] Regular security updates
- [ ] Database firewall (VPC only)
- [ ] Rotate API keys periodically

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review logs: `docker-compose logs -f`
3. Open an issue on GitHub

---

**Last Updated**: January 2026
