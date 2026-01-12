#!/bin/bash
# =============================================================================
# ARC Investment Factory - Server Setup Script
# =============================================================================
# Run this script on a fresh Digital Ocean droplet to set up the environment
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/scripts/setup-server.sh | sudo bash
#   OR
#   sudo ./setup-server.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (sudo)"
    exit 1
fi

echo "=============================================="
echo "ARC Investment Factory - Server Setup"
echo "=============================================="
echo ""

# -----------------------------------------------------------------------------
# System Update
# -----------------------------------------------------------------------------
log_info "Updating system packages..."
apt-get update
apt-get upgrade -y
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    htop \
    vim \
    wget \
    unzip \
    jq \
    fail2ban \
    ufw

log_success "System packages updated"

# -----------------------------------------------------------------------------
# Set Timezone
# -----------------------------------------------------------------------------
log_info "Setting timezone to America/Sao_Paulo..."
timedatectl set-timezone America/Sao_Paulo
log_success "Timezone set"

# -----------------------------------------------------------------------------
# Install Docker
# -----------------------------------------------------------------------------
log_info "Installing Docker..."

# Remove old versions
apt-get remove -y docker docker-engine docker.io containerd runc || true

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Add current user to docker group
usermod -aG docker ubuntu || true

log_success "Docker installed"

# -----------------------------------------------------------------------------
# Install Docker Compose (standalone)
# -----------------------------------------------------------------------------
log_info "Installing Docker Compose..."

COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | jq -r '.tag_name')
curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

log_success "Docker Compose installed: $(docker-compose --version)"

# -----------------------------------------------------------------------------
# Configure Firewall
# -----------------------------------------------------------------------------
log_info "Configuring firewall..."

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

log_success "Firewall configured"

# -----------------------------------------------------------------------------
# Configure Fail2Ban
# -----------------------------------------------------------------------------
log_info "Configuring Fail2Ban..."

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF

systemctl restart fail2ban
systemctl enable fail2ban

log_success "Fail2Ban configured"

# -----------------------------------------------------------------------------
# Create Swap File
# -----------------------------------------------------------------------------
log_info "Creating swap file..."

if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    
    # Optimize swap settings
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
    sysctl -p
    
    log_success "Swap file created (4GB)"
else
    log_info "Swap file already exists"
fi

# -----------------------------------------------------------------------------
# Create Application Directory
# -----------------------------------------------------------------------------
log_info "Creating application directories..."

mkdir -p /opt/arc
mkdir -p /var/backups/arc
mkdir -p /var/log/arc

chown -R ubuntu:ubuntu /opt/arc
chown -R ubuntu:ubuntu /var/backups/arc
chown -R ubuntu:ubuntu /var/log/arc

log_success "Directories created"

# -----------------------------------------------------------------------------
# Configure Log Rotation
# -----------------------------------------------------------------------------
log_info "Configuring log rotation..."

cat > /etc/logrotate.d/arc << 'EOF'
/var/log/arc/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 ubuntu ubuntu
    sharedscripts
    postrotate
        docker-compose -f /opt/arc/docker-compose.prod.yml restart nginx > /dev/null 2>&1 || true
    endscript
}
EOF

log_success "Log rotation configured"

# -----------------------------------------------------------------------------
# Install Node.js (for local development/debugging)
# -----------------------------------------------------------------------------
log_info "Installing Node.js..."

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

log_success "Node.js installed: $(node --version)"

# -----------------------------------------------------------------------------
# Configure SSH Security
# -----------------------------------------------------------------------------
log_info "Hardening SSH configuration..."

# Backup original config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Apply security settings
sed -i 's/#PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#MaxAuthTries 6/MaxAuthTries 3/' /etc/ssh/sshd_config

systemctl restart sshd

log_success "SSH hardened"

# -----------------------------------------------------------------------------
# Install Certbot for SSL
# -----------------------------------------------------------------------------
log_info "Installing Certbot..."

apt-get install -y certbot

log_success "Certbot installed"

# -----------------------------------------------------------------------------
# System Optimization
# -----------------------------------------------------------------------------
log_info "Applying system optimizations..."

cat >> /etc/sysctl.conf << 'EOF'

# Network optimizations
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# File descriptor limits
fs.file-max = 2097152
EOF

sysctl -p

# Increase file descriptor limits
cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
EOF

log_success "System optimizations applied"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "=============================================="
echo "Server Setup Complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo "1. Clone your repository:"
echo "   cd /opt/arc"
echo "   git clone https://github.com/YOUR_REPO/Prompt_flow.git ."
echo ""
echo "2. Copy and configure environment file:"
echo "   cp .env.production.example .env.production"
echo "   vim .env.production"
echo ""
echo "3. Run the deployment:"
echo "   sudo ./deploy/scripts/deploy.sh --init"
echo ""
echo "4. (Optional) Set up SSL:"
echo "   sudo certbot certonly --standalone -d your-domain.com"
echo ""
echo "=============================================="
