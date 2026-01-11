-- ARC Investment Factory - Initial Database Schema
-- Migration 001: Create all tables following Build Pack specification
-- Run with: psql -d arc_investment_factory -f 001_initial_schema.sql

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE style_tag AS ENUM ('quality_compounder', 'garp', 'cigar_butt');
CREATE TYPE idea_status AS ENUM ('new', 'monitoring', 'promoted', 'rejected');
CREATE TYPE claim_type AS ENUM ('numeric', 'qualitative');
CREATE TYPE source_type AS ENUM ('filing', 'transcript', 'investor_deck', 'news', 'dataset');
CREATE TYPE reliability_grade AS ENUM ('A', 'B', 'C');
CREATE TYPE recommendation AS ENUM ('watch', 'deep_dive_more', 'starter_position', 'pass');

-- ============================================================================
-- SECURITY MASTER
-- ============================================================================

CREATE TABLE security_master (
    security_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    exchange TEXT,
    region TEXT,
    country TEXT,
    currency TEXT,
    sector TEXT,
    industry TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX security_master_ticker_idx ON security_master(ticker);

-- ============================================================================
-- IDEAS
-- ============================================================================

CREATE TABLE ideas (
    idea_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    security_id UUID REFERENCES security_master(security_id),
    ticker TEXT NOT NULL,
    as_of DATE NOT NULL,
    style_tag style_tag NOT NULL,
    one_sentence_hypothesis TEXT NOT NULL,
    mechanism TEXT NOT NULL,
    time_horizon TEXT DEFAULT '1_3_years' NOT NULL,
    edge_type JSONB NOT NULL, -- Array of edge types
    quick_metrics JSONB, -- market_cap_usd, ev_to_ebitda, pe, fcf_yield, etc.
    catalysts JSONB, -- Array of catalyst objects
    signposts JSONB, -- Array of signpost objects
    gate_results JSONB, -- gate_0 through gate_4 results
    score JSONB, -- total, edge_clarity, business_quality_prior, etc.
    novelty_score NUMERIC(5,2),
    repetition_penalty NUMERIC(5,2),
    disclosure_friction_penalty NUMERIC(5,2),
    rank_score NUMERIC(10,6),
    status idea_status DEFAULT 'new' NOT NULL,
    rejection_reason TEXT,
    next_action TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX ideas_ticker_as_of_idx ON ideas(ticker, as_of);
CREATE INDEX ideas_status_as_of_idx ON ideas(status, as_of);
CREATE INDEX ideas_rank_score_idx ON ideas(rank_score DESC NULLS LAST);

-- ============================================================================
-- EVIDENCE
-- ============================================================================

CREATE TABLE evidence (
    evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id UUID NOT NULL REFERENCES ideas(idea_id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    claim TEXT NOT NULL,
    claim_type claim_type NOT NULL,
    source_type source_type NOT NULL,
    source_id TEXT,
    source_locator TEXT,
    snippet TEXT,
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    reliability_grade reliability_grade DEFAULT 'B' NOT NULL
);

CREATE INDEX evidence_idea_id_idx ON evidence(idea_id);
CREATE INDEX evidence_ticker_idx ON evidence(ticker);

-- ============================================================================
-- RESEARCH PACKETS
-- ============================================================================

CREATE TABLE research_packets (
    packet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id UUID NOT NULL REFERENCES ideas(idea_id),
    ticker TEXT NOT NULL,
    as_of DATE NOT NULL,
    style_tag style_tag NOT NULL,
    packet JSONB NOT NULL, -- Full ResearchPacket JSON
    decision_brief JSONB,
    monitoring_plan JSONB,
    thesis_version INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX research_packets_ticker_idx ON research_packets(ticker);
CREATE INDEX research_packets_idea_id_idx ON research_packets(idea_id);

-- ============================================================================
-- DECISIONS
-- ============================================================================

CREATE TABLE decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id UUID NOT NULL REFERENCES ideas(idea_id),
    ticker TEXT NOT NULL,
    as_of DATE NOT NULL,
    decision_brief JSONB NOT NULL,
    user_override BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX decisions_as_of_idx ON decisions(as_of);
CREATE INDEX decisions_idea_id_idx ON decisions(idea_id);

-- ============================================================================
-- RUNS (Audit Trail)
-- ============================================================================

CREATE TABLE runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type TEXT NOT NULL, -- daily_discovery, daily_lane_b, monitoring_trigger, weekly_ic_bundle, monthly_process_audit
    run_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    payload JSONB,
    status TEXT DEFAULT 'running' NOT NULL, -- running, completed, failed
    error_message TEXT,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX runs_run_type_idx ON runs(run_type);
CREATE INDEX runs_run_date_idx ON runs(run_date);

-- ============================================================================
-- NOVELTY STATE
-- ============================================================================

CREATE TABLE novelty_state (
    ticker TEXT PRIMARY KEY,
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    last_edge_types JSONB, -- Array of edge types
    last_style_tag TEXT,
    seen_count INTEGER DEFAULT 1 NOT NULL,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX novelty_state_last_seen_idx ON novelty_state(last_seen);

-- ============================================================================
-- STYLE MIX STATE
-- ============================================================================

CREATE TABLE style_mix_state (
    week_start DATE PRIMARY KEY,
    quality_compounder_count INTEGER DEFAULT 0 NOT NULL,
    garp_count INTEGER DEFAULT 0 NOT NULL,
    cigar_butt_count INTEGER DEFAULT 0 NOT NULL,
    total_promoted INTEGER DEFAULT 0 NOT NULL
);

-- ============================================================================
-- OUTCOMES (v2 but create now)
-- ============================================================================

CREATE TABLE outcomes (
    outcome_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES decisions(decision_id),
    ticker TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    subsequent_return NUMERIC(10,4),
    max_drawdown NUMERIC(10,4),
    thesis_break_reason TEXT,
    notes TEXT
);

CREATE INDEX outcomes_decision_id_idx ON outcomes(decision_id);
CREATE INDEX outcomes_ticker_idx ON outcomes(ticker);

-- ============================================================================
-- DOCUMENTS (for ingestion pipeline)
-- ============================================================================

CREATE TABLE documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT,
    doc_type TEXT NOT NULL, -- filing, transcript, investor_deck, news
    title TEXT,
    source_url TEXT,
    storage_key TEXT NOT NULL, -- S3 key
    document_date DATE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX documents_ticker_idx ON documents(ticker);
CREATE INDEX documents_doc_type_idx ON documents(doc_type);

-- ============================================================================
-- DOCUMENT CHUNKS (for vector embeddings)
-- ============================================================================

CREATE TABLE document_chunks (
    chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    ticker TEXT,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    heading TEXT,
    embedding_id TEXT, -- Pinecone vector ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX document_chunks_document_id_idx ON document_chunks(document_id);
CREATE INDEX document_chunks_ticker_idx ON document_chunks(ticker);

-- ============================================================================
-- PROMPT TEMPLATES
-- ============================================================================

CREATE TABLE prompt_templates (
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

CREATE UNIQUE INDEX prompt_templates_name_idx ON prompt_templates(name);

-- ============================================================================
-- WATCHLIST
-- ============================================================================

CREATE TABLE watchlist (
    watchlist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL,
    added_by TEXT,
    reason TEXT,
    priority INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX watchlist_ticker_idx ON watchlist(ticker);
CREATE INDEX watchlist_is_active_idx ON watchlist(is_active);

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

CREATE TRIGGER update_ideas_updated_at
    BEFORE UPDATE ON ideas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_research_packets_updated_at
    BEFORE UPDATE ON research_packets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

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
