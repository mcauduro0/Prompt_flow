-- Migration: Add telemetry and budget alert tables
-- Created: 2026-01-12

-- Prompt Telemetry Table
-- Stores execution metrics for all prompt runs
CREATE TABLE IF NOT EXISTS prompt_telemetry (
    id VARCHAR(64) PRIMARY KEY,
    run_id VARCHAR(64),
    prompt_id VARCHAR(128) NOT NULL,
    execution_type ENUM('llm', 'code', 'hybrid') NOT NULL,
    provider VARCHAR(32),
    model VARCHAR(64),
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    latency_ms INT DEFAULT 0,
    cost_usd DECIMAL(10, 6) DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_telemetry_run_id (run_id),
    INDEX idx_telemetry_prompt_id (prompt_id),
    INDEX idx_telemetry_created_at (created_at),
    INDEX idx_telemetry_provider (provider),
    INDEX idx_telemetry_success (success)
);

-- Budget Alerts Table
-- Stores budget and performance alerts
CREATE TABLE IF NOT EXISTS budget_alerts (
    id VARCHAR(64) PRIMARY KEY,
    type ENUM('warning', 'critical') NOT NULL,
    category ENUM('daily_budget', 'monthly_budget', 'token_limit', 'latency', 'error_rate') NOT NULL,
    message TEXT NOT NULL,
    value DECIMAL(15, 4) NOT NULL,
    threshold DECIMAL(15, 4) NOT NULL,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP NULL,
    acknowledged_by VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_alerts_type (type),
    INDEX idx_alerts_category (category),
    INDEX idx_alerts_acknowledged (acknowledged),
    INDEX idx_alerts_created_at (created_at)
);

-- Quarantine Table
-- Stores invalid outputs for review
CREATE TABLE IF NOT EXISTS prompt_quarantine (
    id VARCHAR(64) PRIMARY KEY,
    run_id VARCHAR(64),
    prompt_id VARCHAR(128) NOT NULL,
    raw_output TEXT,
    validation_errors JSON,
    context JSON,
    reviewed BOOLEAN DEFAULT false,
    reviewed_at TIMESTAMP NULL,
    reviewed_by VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_quarantine_run_id (run_id),
    INDEX idx_quarantine_prompt_id (prompt_id),
    INDEX idx_quarantine_reviewed (reviewed),
    INDEX idx_quarantine_created_at (created_at)
);

-- Data Source Cache Table
-- Caches API responses to reduce costs and latency
CREATE TABLE IF NOT EXISTS data_source_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    source VARCHAR(32) NOT NULL,
    data JSON NOT NULL,
    ttl_seconds INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    INDEX idx_cache_source (source),
    INDEX idx_cache_expires_at (expires_at)
);

-- Budget Usage Summary Table
-- Daily aggregated budget usage for reporting
CREATE TABLE IF NOT EXISTS budget_usage_daily (
    date DATE PRIMARY KEY,
    total_executions INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    total_cost_usd DECIMAL(10, 4) DEFAULT 0,
    success_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    avg_latency_ms INT DEFAULT 0,
    by_provider JSON,
    by_prompt JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
