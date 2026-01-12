# =============================================================================
# ARC Investment Factory - Digital Ocean Infrastructure (Terraform)
# =============================================================================
# Infrastructure as Code for Digital Ocean deployment
#
# Resources:
# - Droplet (4 vCPU, 8GB RAM)
# - Managed PostgreSQL Database
# - Managed Redis (optional)
# - Spaces (S3-compatible storage)
# - Firewall
# - Domain/DNS
# - Load Balancer (optional)
#
# Usage:
#   terraform init
#   terraform plan -var="do_token=YOUR_TOKEN"
#   terraform apply -var="do_token=YOUR_TOKEN"
# =============================================================================

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }

  # Optional: Remote state storage
  # backend "s3" {
  #   endpoint                    = "nyc3.digitaloceanspaces.com"
  #   key                         = "terraform/arc-investment/terraform.tfstate"
  #   bucket                      = "arc-terraform-state"
  #   region                      = "us-east-1"
  #   skip_credentials_validation = true
  #   skip_metadata_api_check     = true
  # }
}

# =============================================================================
# Variables
# =============================================================================

variable "do_token" {
  description = "Digital Ocean API Token"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "Digital Ocean region"
  type        = string
  default     = "nyc3"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "arc-investment.com"
}

variable "droplet_size" {
  description = "Droplet size slug"
  type        = string
  default     = "s-4vcpu-8gb"  # 4 vCPU, 8GB RAM, $48/month
}

variable "db_size" {
  description = "Database cluster size"
  type        = string
  default     = "db-s-1vcpu-1gb"  # Smallest managed DB, $15/month
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "ssh_keys" {
  description = "List of SSH key fingerprints"
  type        = list(string)
  default     = []
}

# =============================================================================
# Provider
# =============================================================================

provider "digitalocean" {
  token = var.do_token
}

# =============================================================================
# SSH Key
# =============================================================================

resource "digitalocean_ssh_key" "arc_key" {
  name       = "arc-${var.environment}-key"
  public_key = file("~/.ssh/id_rsa.pub")
  
  lifecycle {
    ignore_changes = [public_key]
  }
}

# =============================================================================
# VPC
# =============================================================================

resource "digitalocean_vpc" "arc_vpc" {
  name     = "arc-${var.environment}-vpc"
  region   = var.region
  ip_range = "10.10.10.0/24"
}

# =============================================================================
# Droplet (Main Application Server)
# =============================================================================

resource "digitalocean_droplet" "arc_server" {
  name     = "arc-${var.environment}-server"
  region   = var.region
  size     = var.droplet_size
  image    = "ubuntu-22-04-x64"
  vpc_uuid = digitalocean_vpc.arc_vpc.id
  
  ssh_keys = [digitalocean_ssh_key.arc_key.fingerprint]
  
  tags = [
    "arc",
    var.environment,
    "web",
    "api",
    "worker"
  ]

  user_data = <<-EOF
    #!/bin/bash
    set -e
    
    # Update system
    apt-get update && apt-get upgrade -y
    
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker root
    
    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Install additional tools
    apt-get install -y git htop vim curl wget unzip jq
    
    # Create app directory
    mkdir -p /opt/arc
    
    # Set timezone
    timedatectl set-timezone America/Sao_Paulo
    
    # Configure firewall
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    
    # Create swap file (4GB)
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    
    echo "Server initialization complete!"
  EOF

  lifecycle {
    create_before_destroy = true
  }
}

# =============================================================================
# Managed PostgreSQL Database
# =============================================================================

resource "digitalocean_database_cluster" "arc_postgres" {
  name       = "arc-${var.environment}-postgres"
  engine     = "pg"
  version    = "15"
  size       = var.db_size
  region     = var.region
  node_count = 1
  
  private_network_uuid = digitalocean_vpc.arc_vpc.id

  tags = [
    "arc",
    var.environment,
    "database"
  ]

  maintenance_window {
    day  = "sunday"
    hour = "04:00:00"
  }
}

# Database
resource "digitalocean_database_db" "arc_db" {
  cluster_id = digitalocean_database_cluster.arc_postgres.id
  name       = "arc_investment"
}

# Database User
resource "digitalocean_database_user" "arc_user" {
  cluster_id = digitalocean_database_cluster.arc_postgres.id
  name       = "arc"
}

# Database Firewall (only allow droplet)
resource "digitalocean_database_firewall" "arc_db_firewall" {
  cluster_id = digitalocean_database_cluster.arc_postgres.id

  rule {
    type  = "droplet"
    value = digitalocean_droplet.arc_server.id
  }
}

# =============================================================================
# Managed Redis (Optional - can use container instead)
# =============================================================================

# resource "digitalocean_database_cluster" "arc_redis" {
#   name       = "arc-${var.environment}-redis"
#   engine     = "redis"
#   version    = "7"
#   size       = "db-s-1vcpu-1gb"
#   region     = var.region
#   node_count = 1
#   
#   private_network_uuid = digitalocean_vpc.arc_vpc.id
#   
#   tags = [
#     "arc",
#     var.environment,
#     "cache"
#   ]
# }

# =============================================================================
# Spaces (S3-compatible Object Storage)
# =============================================================================

resource "digitalocean_spaces_bucket" "arc_storage" {
  name   = "arc-${var.environment}-storage"
  region = var.region
  acl    = "private"

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["https://${var.domain_name}"]
    max_age_seconds = 3000
  }

  lifecycle_rule {
    id      = "cleanup-old-backups"
    enabled = true
    prefix  = "backups/"

    expiration {
      days = 90
    }
  }
}

# =============================================================================
# Firewall
# =============================================================================

resource "digitalocean_firewall" "arc_firewall" {
  name = "arc-${var.environment}-firewall"

  droplet_ids = [digitalocean_droplet.arc_server.id]

  # SSH
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTP
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTPS
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # All outbound traffic
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# =============================================================================
# Domain & DNS
# =============================================================================

resource "digitalocean_domain" "arc_domain" {
  name = var.domain_name
}

resource "digitalocean_record" "arc_a_record" {
  domain = digitalocean_domain.arc_domain.id
  type   = "A"
  name   = "@"
  value  = digitalocean_droplet.arc_server.ipv4_address
  ttl    = 300
}

resource "digitalocean_record" "arc_www_record" {
  domain = digitalocean_domain.arc_domain.id
  type   = "A"
  name   = "www"
  value  = digitalocean_droplet.arc_server.ipv4_address
  ttl    = 300
}

resource "digitalocean_record" "arc_api_record" {
  domain = digitalocean_domain.arc_domain.id
  type   = "A"
  name   = "api"
  value  = digitalocean_droplet.arc_server.ipv4_address
  ttl    = 300
}

# =============================================================================
# Floating IP (Optional - for high availability)
# =============================================================================

resource "digitalocean_floating_ip" "arc_ip" {
  region = var.region
}

resource "digitalocean_floating_ip_assignment" "arc_ip_assignment" {
  ip_address = digitalocean_floating_ip.arc_ip.ip_address
  droplet_id = digitalocean_droplet.arc_server.id
}

# =============================================================================
# Outputs
# =============================================================================

output "droplet_ip" {
  description = "Droplet public IP address"
  value       = digitalocean_droplet.arc_server.ipv4_address
}

output "droplet_private_ip" {
  description = "Droplet private IP address"
  value       = digitalocean_droplet.arc_server.ipv4_address_private
}

output "floating_ip" {
  description = "Floating IP address"
  value       = digitalocean_floating_ip.arc_ip.ip_address
}

output "database_host" {
  description = "PostgreSQL database host"
  value       = digitalocean_database_cluster.arc_postgres.private_host
  sensitive   = true
}

output "database_port" {
  description = "PostgreSQL database port"
  value       = digitalocean_database_cluster.arc_postgres.port
}

output "database_uri" {
  description = "PostgreSQL connection URI"
  value       = digitalocean_database_cluster.arc_postgres.private_uri
  sensitive   = true
}

output "spaces_endpoint" {
  description = "Spaces endpoint URL"
  value       = digitalocean_spaces_bucket.arc_storage.bucket_domain_name
}

output "domain_name" {
  description = "Domain name"
  value       = digitalocean_domain.arc_domain.name
}
