-- Migration: 005_add_qa_telemetry_tables.sql
-- Created: 2026-01-17
-- Purpose: Add telemetry tables for QA Framework v2.0

-- ============================================================================
-- Tabela genérica de telemetria
-- ============================================================================
CREATE TABLE IF NOT EXISTS telemetry (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    lane VARCHAR(16) NOT NULL,
    component VARCHAR(64),
    metric_name VARCHAR(128) NOT NULL,
    metric_value DECIMAL(15, 4),
    metric_text TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telemetry_lane ON telemetry(lane);
CREATE INDEX IF NOT EXISTS idx_telemetry_event_type ON telemetry(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON telemetry(created_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_component ON telemetry(component);

-- ============================================================================
-- Saúde das fontes de dados (Polygon, FMP, FRED, SEC Edgar)
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_source_health (
    id SERIAL PRIMARY KEY,
    source_name VARCHAR(64) NOT NULL,
    endpoint VARCHAR(255),
    success BOOLEAN NOT NULL,
    latency_ms INT,
    error_message TEXT,
    rate_limited BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dsh_source ON data_source_health(source_name);
CREATE INDEX IF NOT EXISTS idx_dsh_created_at ON data_source_health(created_at);
CREATE INDEX IF NOT EXISTS idx_dsh_success ON data_source_health(success);

-- ============================================================================
-- Chamadas LLM (Anthropic, OpenAI, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS llm_calls (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    model VARCHAR(64) NOT NULL,
    lane VARCHAR(16),
    component VARCHAR(64),
    prompt_type VARCHAR(64),
    success BOOLEAN NOT NULL,
    latency_ms INT,
    input_tokens INT,
    output_tokens INT,
    total_tokens INT,
    error_message TEXT,
    fallback_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_llm_provider ON llm_calls(provider);
CREATE INDEX IF NOT EXISTS idx_llm_model ON llm_calls(model);
CREATE INDEX IF NOT EXISTS idx_llm_created_at ON llm_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_llm_lane ON llm_calls(lane);
CREATE INDEX IF NOT EXISTS idx_llm_success ON llm_calls(success);

-- ============================================================================
-- Resultados de gates (Lane A - 8 gates de validação)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gate_results (
    id SERIAL PRIMARY KEY,
    idea_id VARCHAR(64) NOT NULL,
    ticker VARCHAR(16) NOT NULL,
    gate_id INT NOT NULL,
    gate_name VARCHAR(64) NOT NULL,
    passed BOOLEAN NOT NULL,
    score DECIMAL(5, 2),
    failure_reason TEXT,
    failure_reasons JSONB,
    binary_override VARCHAR(32),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gr_idea_id ON gate_results(idea_id);
CREATE INDEX IF NOT EXISTS idx_gr_ticker ON gate_results(ticker);
CREATE INDEX IF NOT EXISTS idx_gr_gate_id ON gate_results(gate_id);
CREATE INDEX IF NOT EXISTS idx_gr_passed ON gate_results(passed);
CREATE INDEX IF NOT EXISTS idx_gr_created_at ON gate_results(created_at);

-- ============================================================================
-- Performance de agentes (Lane B - 7 agentes especializados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_performance (
    id SERIAL PRIMARY KEY,
    packet_id VARCHAR(64) NOT NULL,
    ticker VARCHAR(16) NOT NULL,
    agent_name VARCHAR(64) NOT NULL,
    success BOOLEAN NOT NULL,
    latency_ms INT,
    quality_score DECIMAL(5, 2),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ap_packet_id ON agent_performance(packet_id);
CREATE INDEX IF NOT EXISTS idx_ap_ticker ON agent_performance(ticker);
CREATE INDEX IF NOT EXISTS idx_ap_agent_name ON agent_performance(agent_name);
CREATE INDEX IF NOT EXISTS idx_ap_success ON agent_performance(success);
CREATE INDEX IF NOT EXISTS idx_ap_created_at ON agent_performance(created_at);

-- ============================================================================
-- Resultados de prompts de suporte (Lane C - 7 prompts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS supporting_prompt_results (
    id SERIAL PRIMARY KEY,
    memo_id VARCHAR(64) NOT NULL,
    ticker VARCHAR(16) NOT NULL,
    prompt_name VARCHAR(64) NOT NULL,
    success BOOLEAN NOT NULL,
    latency_ms INT,
    confidence DECIMAL(5, 2),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_spr_memo_id ON supporting_prompt_results(memo_id);
CREATE INDEX IF NOT EXISTS idx_spr_ticker ON supporting_prompt_results(ticker);
CREATE INDEX IF NOT EXISTS idx_spr_prompt_name ON supporting_prompt_results(prompt_name);
CREATE INDEX IF NOT EXISTS idx_spr_success ON supporting_prompt_results(success);
CREATE INDEX IF NOT EXISTS idx_spr_created_at ON supporting_prompt_results(created_at);

-- ============================================================================
-- Estatísticas de ingestão Lane 0 (Substack, Reddit, FMP Screener)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lane0_ingestion_stats (
    id SERIAL PRIMARY KEY,
    source VARCHAR(64) NOT NULL,
    total_count INT DEFAULT 0,
    is_duplicate BOOLEAN DEFAULT false,
    processing_time_ms INT,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_l0_source ON lane0_ingestion_stats(source);
CREATE INDEX IF NOT EXISTS idx_l0_created_at ON lane0_ingestion_stats(created_at);
CREATE INDEX IF NOT EXISTS idx_l0_duplicate ON lane0_ingestion_stats(is_duplicate);

-- ============================================================================
-- Comentários para documentação
-- ============================================================================
COMMENT ON TABLE telemetry IS 'Generic telemetry events for all lanes and components';
COMMENT ON TABLE data_source_health IS 'Health metrics for external data sources (Polygon, FMP, FRED, SEC)';
COMMENT ON TABLE llm_calls IS 'LLM API call metrics (Anthropic, OpenAI)';
COMMENT ON TABLE gate_results IS 'Lane A gate validation results (8 gates)';
COMMENT ON TABLE agent_performance IS 'Lane B agent execution metrics (7 agents)';
COMMENT ON TABLE supporting_prompt_results IS 'Lane C supporting prompt results (7 prompts)';
COMMENT ON TABLE lane0_ingestion_stats IS 'Lane 0 idea ingestion statistics';
