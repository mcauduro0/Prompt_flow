-- =============================================================================
-- ARC Investment Factory - Database Initialization Script
-- =============================================================================
-- This script initializes the production database with:
-- 1. Extensions
-- 2. Schema creation
-- 3. All tables from migrations
-- 4. Indexes and constraints
-- 5. Initial seed data
--
-- Usage: psql -h localhost -U arc -d arc_investment -f init.sql
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE style_tag AS ENUM ('quality_compounder', 'garp', 'cigar_butt');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE idea_status AS ENUM ('new', 'monitoring', 'promoted', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE claim_type AS ENUM ('numeric', 'qualitative');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE source_type AS ENUM ('filing', 'transcript', 'investor_deck', 'news', 'dataset');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reliability_grade AS ENUM ('A', 'B', 'C');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE recommendation AS ENUM ('watch', 'deep_dive_more', 'starter_position', 'pass');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- SECURITY MASTER
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_master (
    security_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    exchange TEXT,
    region TEXT,
    country TEXT,
    currency TEXT,
    sector TEXT,
    industry TEXT,
    market_cap_usd NUMERIC(20,2),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS security_master_ticker_idx ON security_master(ticker);
CREATE INDEX IF NOT EXISTS security_master_region_idx ON security_master(region);
CREATE INDEX IF NOT EXISTS security_master_sector_idx ON security_master(sector);

-- ============================================================================
-- IDEAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ideas (
    idea_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    security_id UUID REFERENCES security_master(security_id),
    ticker TEXT NOT NULL,
    as_of DATE NOT NULL,
    style_tag style_tag NOT NULL,
    one_sentence_hypothesis TEXT NOT NULL,
    mechanism TEXT NOT NULL,
    time_horizon TEXT DEFAULT '1_3_years' NOT NULL,
    edge_type JSONB NOT NULL,
    quick_metrics JSONB,
    catalysts JSONB,
    signposts JSONB,
    gate_results JSONB,
    score JSONB,
    novelty_score NUMERIC(5,2),
    repetition_penalty NUMERIC(5,2),
    disclosure_friction_penalty NUMERIC(5,2),
    rank_score NUMERIC(10,6),
    status idea_status DEFAULT 'new' NOT NULL,
    rejection_reason TEXT,
    rejection_shadow JSONB,
    whats_new_since_last_time TEXT,
    next_action TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS ideas_ticker_as_of_idx ON ideas(ticker, as_of);
CREATE INDEX IF NOT EXISTS ideas_status_as_of_idx ON ideas(status, as_of);
CREATE INDEX IF NOT EXISTS ideas_rank_score_idx ON ideas(rank_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS ideas_created_at_idx ON ideas(created_at);

-- ============================================================================
-- EVIDENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS evidence (
    evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id UUID NOT NULL REFERENCES ideas(idea_id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    claim TEXT NOT NULL,
    claim_type claim_type NOT NULL,
    source_type source_type NOT NULL,
    source_id TEXT,
    source_locator TEXT,
    doc_id TEXT,
    chunk_id TEXT,
    snippet TEXT,
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    reliability_grade reliability_grade DEFAULT 'B' NOT NULL
);

CREATE INDEX IF NOT EXISTS evidence_idea_id_idx ON evidence(idea_id);
CREATE INDEX IF NOT EXISTS evidence_ticker_idx ON evidence(ticker);
CREATE INDEX IF NOT EXISTS evidence_doc_id_idx ON evidence(doc_id);

-- ============================================================================
-- RESEARCH PACKETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS research_packets (
    packet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id UUID NOT NULL REFERENCES ideas(idea_id),
    ticker TEXT NOT NULL,
    as_of DATE NOT NULL,
    style_tag style_tag NOT NULL,
    packet JSONB NOT NULL,
    decision_brief JSONB,
    monitoring_plan JSONB,
    variant_perception TEXT,
    historical_parallels JSONB,
    pre_mortem JSONB,
    thesis_version INTEGER DEFAULT 1 NOT NULL,
    is_complete BOOLEAN DEFAULT FALSE NOT NULL,
    completion_score NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS research_packets_ticker_idx ON research_packets(ticker);
CREATE INDEX IF NOT EXISTS research_packets_idea_id_idx ON research_packets(idea_id);
CREATE INDEX IF NOT EXISTS research_packets_created_at_idx ON research_packets(created_at);
CREATE INDEX IF NOT EXISTS research_packets_is_complete_idx ON research_packets(is_complete);

-- ============================================================================
-- DECISIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id UUID NOT NULL REFERENCES ideas(idea_id),
    ticker TEXT NOT NULL,
    as_of DATE NOT NULL,
    decision_brief JSONB NOT NULL,
    recommendation recommendation,
    user_override BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS decisions_as_of_idx ON decisions(as_of);
CREATE INDEX IF NOT EXISTS decisions_idea_id_idx ON decisions(idea_id);

-- ============================================================================
-- RUNS (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type TEXT NOT NULL,
    run_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    payload JSONB,
    status TEXT DEFAULT 'running' NOT NULL,
    error_message TEXT,
    metrics JSONB,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS runs_run_type_idx ON runs(run_type);
CREATE INDEX IF NOT EXISTS runs_run_date_idx ON runs(run_date);
CREATE INDEX IF NOT EXISTS runs_status_idx ON runs(status);

-- ============================================================================
-- NOVELTY STATE
-- ============================================================================

CREATE TABLE IF NOT EXISTS novelty_state (
    ticker TEXT PRIMARY KEY,
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    last_edge_types JSONB,
    last_style_tag TEXT,
    seen_count INTEGER DEFAULT 1 NOT NULL,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    rejection_count INTEGER DEFAULT 0 NOT NULL,
    last_rejection_reason TEXT,
    last_rejection_date TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS novelty_state_last_seen_idx ON novelty_state(last_seen);
CREATE INDEX IF NOT EXISTS novelty_state_first_seen_idx ON novelty_state(first_seen);

-- ============================================================================
-- STYLE MIX STATE
-- ============================================================================

CREATE TABLE IF NOT EXISTS style_mix_state (
    week_start DATE PRIMARY KEY,
    quality_compounder_count INTEGER DEFAULT 0 NOT NULL,
    garp_count INTEGER DEFAULT 0 NOT NULL,
    cigar_butt_count INTEGER DEFAULT 0 NOT NULL,
    total_promoted INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- OUTCOMES
-- ============================================================================

CREATE TABLE IF NOT EXISTS outcomes (
    outcome_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES decisions(decision_id),
    ticker TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    subsequent_return NUMERIC(10,4),
    max_drawdown NUMERIC(10,4),
    thesis_break_reason TEXT,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS outcomes_decision_id_idx ON outcomes(decision_id);
CREATE INDEX IF NOT EXISTS outcomes_ticker_idx ON outcomes(ticker);

-- ============================================================================
-- DOCUMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT,
    doc_type TEXT NOT NULL,
    title TEXT,
    source_url TEXT,
    storage_key TEXT NOT NULL,
    document_date DATE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS documents_ticker_idx ON documents(ticker);
CREATE INDEX IF NOT EXISTS documents_doc_type_idx ON documents(doc_type);

-- ============================================================================
-- DOCUMENT CHUNKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_chunks (
    chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    ticker TEXT,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    heading TEXT,
    embedding_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS document_chunks_ticker_idx ON document_chunks(ticker);

-- ============================================================================
-- PROMPT TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompt_templates (
    prompt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    version INTEGER DEFAULT 1 NOT NULL,
    template TEXT NOT NULL,
    description TEXT,
    input_schema JSONB,
    output_schema JSONB,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS prompt_templates_name_idx ON prompt_templates(name);

-- ============================================================================
-- WATCHLIST
-- ============================================================================

CREATE TABLE IF NOT EXISTS watchlist (
    watchlist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL,
    added_by TEXT,
    reason TEXT,
    priority INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS watchlist_ticker_idx ON watchlist(ticker);
CREATE INDEX IF NOT EXISTS watchlist_is_active_idx ON watchlist(is_active);

-- ============================================================================
-- QA REPORTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS qa_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    as_of TIMESTAMP WITH TIME ZONE NOT NULL,
    window_start DATE NOT NULL,
    window_end DATE NOT NULL,
    overall_status TEXT NOT NULL,
    overall_score INTEGER NOT NULL,
    sections JSONB NOT NULL,
    drift_alarms JSONB NOT NULL,
    key_metrics JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS qa_reports_as_of_idx ON qa_reports(as_of);
CREATE INDEX IF NOT EXISTS qa_reports_window_end_idx ON qa_reports(window_end);

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_ideas_updated_at ON ideas;
CREATE TRIGGER update_ideas_updated_at
    BEFORE UPDATE ON ideas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_research_packets_updated_at ON research_packets;
CREATE TRIGGER update_research_packets_updated_at
    BEFORE UPDATE ON research_packets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prompt_templates_updated_at ON prompt_templates;
CREATE TRIGGER update_prompt_templates_updated_at
    BEFORE UPDATE ON prompt_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE security_master IS 'Master list of securities with basic metadata';
COMMENT ON TABLE ideas IS 'Lane A IdeaCards with scoring, gates, and novelty metrics';
COMMENT ON TABLE evidence IS 'Atomic evidence claims linked to ideas';
COMMENT ON TABLE research_packets IS 'Lane B deep research packets with immutable thesis versions';
COMMENT ON TABLE decisions IS 'DecisionBriefs generated from research packets';
COMMENT ON TABLE runs IS 'Audit trail for all orchestration runs';
COMMENT ON TABLE novelty_state IS 'Tracks ticker novelty for ranking';
COMMENT ON TABLE style_mix_state IS 'Weekly style mix quota tracking';
COMMENT ON TABLE outcomes IS 'Post-decision outcome tracking for process audit';
COMMENT ON TABLE documents IS 'Ingested documents metadata';
COMMENT ON TABLE document_chunks IS 'Document chunks for vector embedding';
COMMENT ON TABLE prompt_templates IS 'LLM prompt templates with versioning';
COMMENT ON TABLE watchlist IS 'User-managed watchlist for priority tickers';
COMMENT ON TABLE qa_reports IS 'Weekly QA governance reports';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant all privileges to the application user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO arc;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO arc;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO arc;

-- ============================================================================
-- INITIAL SEED DATA
-- ============================================================================

-- Insert initial style mix state for current week
INSERT INTO style_mix_state (week_start, quality_compounder_count, garp_count, cigar_butt_count, total_promoted)
VALUES (date_trunc('week', CURRENT_DATE)::date, 0, 0, 0, 0)
ON CONFLICT (week_start) DO NOTHING;

-- Insert system run record
INSERT INTO runs (run_type, payload, status, completed_at)
VALUES ('system_init', '{"version": "1.0.0", "initialized_at": "' || NOW() || '"}', 'completed', NOW());

SELECT 'Database initialization completed successfully' AS status;
