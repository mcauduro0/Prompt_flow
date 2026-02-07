-- ============================================================================
-- ARC IC MEMOS SCHEMA V2 MIGRATION
-- Adiciona campos para sistema decisório de nível hedge fund
-- Execute este script no banco de dados PostgreSQL
-- ============================================================================

-- Criar novos enums
DO $$ BEGIN
  CREATE TYPE thesis_primary_type AS ENUM (
    'quality_compounder', 'value', 'turnaround', 'contrarian', 'special_situation', 'macro_proxy'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE risk_primary_category AS ENUM (
    'structural', 'cyclical', 'regulatory', 'financial', 'execution', 'macro'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE capital_efficiency_classification AS ENUM (
    'capital_compounder', 'capital_intensive', 'capital_fragile'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE industry_structure AS ENUM (
    'fragmented', 'oligopoly', 'monopoly', 'disrupted'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE catalyst_type AS ENUM (
    'earnings', 'regulatory', 'strategic', 'macro', 'technical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE catalyst_strength AS ENUM (
    'weak', 'medium', 'strong'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE portfolio_role AS ENUM (
    'core', 'opportunistic', 'tactical', 'monitor_only'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE post_mortem_status AS ENUM (
    'pending', 'success', 'failure', 'ongoing'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE model_error_type AS ENUM (
    'thesis', 'timing', 'valuation', 'risk_underestimation', 'execution'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE decision_status AS ENUM (
    'approve', 'reject', 'monitor', 'reduce'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- ADICIONAR NOVOS CAMPOS À TABELA IC_MEMOS
-- ============================================================================

-- Campos de Identidade Adicionais
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS subsector TEXT;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS schema_version TEXT DEFAULT 'v2.0';

-- Classificação da Tese
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS thesis_primary_type thesis_primary_type;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS thesis_secondary_type TEXT;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS thesis_time_horizon_months INTEGER;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS thesis_style_vector JSONB;

-- Convicção Expandida
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS recommendation_label_inferred TEXT;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS recommendation_conflict_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS conviction_level TEXT;

-- Assimetria e Retorno Esperado
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS price_current NUMERIC(12, 4);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS price_at_memo NUMERIC(12, 4);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS base_case_upside_pct NUMERIC(8, 4);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS bull_case_upside_pct NUMERIC(8, 4);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS bear_case_downside_pct NUMERIC(8, 4);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS expected_return_base_pct NUMERIC(8, 4);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS expected_return_probability_weighted_pct NUMERIC(8, 4);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS asymmetry_score NUMERIC(5, 2);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS left_tail_risk_flag BOOLEAN DEFAULT FALSE;

-- Risco Estruturado
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS risk_primary_category risk_primary_category;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS risk_secondary_categories JSONB;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS risk_concentration_vector JSONB;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS early_warning_indicators JSONB;

-- Business and Moat Scores
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS industry_structure industry_structure;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS moat_strength_score NUMERIC(4, 2);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS moat_durability_score NUMERIC(4, 2);

-- Financial Quality Scores
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS revenue_quality_score NUMERIC(4, 2);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS margin_quality_score NUMERIC(4, 2);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS capital_intensity_score NUMERIC(4, 2);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS roic_durability_score NUMERIC(4, 2);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS capital_efficiency_classification capital_efficiency_classification;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS roic_fragility_flag BOOLEAN DEFAULT FALSE;

-- Valuation Metrics
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS valuation_multiple_current NUMERIC(8, 2);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS valuation_multiple_implied_base NUMERIC(8, 2);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS valuation_multiple_implied_bear NUMERIC(8, 2);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS valuation_premium_flag BOOLEAN DEFAULT FALSE;

-- Catalyst Metrics
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS catalyst_type catalyst_type;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS catalyst_strength catalyst_strength;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS catalyst_clarity_score NUMERIC(4, 2);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS catalyst_timeframe_months INTEGER;

-- Portfolio Fit Quantitativo
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS portfolio_role portfolio_role;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS suggested_position_size_min_pct NUMERIC(5, 2);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS suggested_position_size_max_pct NUMERIC(5, 2);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS portfolio_risk_contribution NUMERIC(5, 4);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS risk_redundancy_flag BOOLEAN DEFAULT FALSE;

-- Decision Logic and Governance
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS investability_score_standalone NUMERIC(5, 2);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS investability_score_marginal NUMERIC(5, 2);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS decision_status decision_status;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS decision_rationale_structured TEXT;

-- Learning and Feedback Loop (Post-Mortem)
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS post_mortem_status post_mortem_status DEFAULT 'pending';
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS realized_return_pct NUMERIC(8, 4);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS holding_period_months INTEGER;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS exit_date TIMESTAMP;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS exit_price NUMERIC(12, 4);
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS exit_reason TEXT;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS model_error_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS error_type model_error_type;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS post_mortem_notes TEXT;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS lessons_learned JSONB;

-- Inference Tracking
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS inferred_fields JSONB;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS inference_confidence JSONB;
ALTER TABLE ic_memos ADD COLUMN IF NOT EXISTS last_inference_at TIMESTAMP;

-- ============================================================================
-- CRIAR ÍNDICES PARA OS NOVOS CAMPOS
-- ============================================================================

CREATE INDEX IF NOT EXISTS ic_memos_thesis_primary_type_idx ON ic_memos(thesis_primary_type);
CREATE INDEX IF NOT EXISTS ic_memos_portfolio_role_idx ON ic_memos(portfolio_role);
CREATE INDEX IF NOT EXISTS ic_memos_post_mortem_status_idx ON ic_memos(post_mortem_status);
CREATE INDEX IF NOT EXISTS ic_memos_decision_status_idx ON ic_memos(decision_status);
CREATE INDEX IF NOT EXISTS ic_memos_asymmetry_score_idx ON ic_memos(asymmetry_score);
CREATE INDEX IF NOT EXISTS ic_memos_investability_score_standalone_idx ON ic_memos(investability_score_standalone);
CREATE INDEX IF NOT EXISTS ic_memos_sector_idx ON ic_memos(sector);
CREATE INDEX IF NOT EXISTS ic_memos_region_idx ON ic_memos(region);

-- ============================================================================
-- COMENTÁRIO DE CONCLUSÃO
-- ============================================================================

COMMENT ON TABLE ic_memos IS 'IC Memos with ARC_IC_MEMO_SCHEMA_V2 - Sistema decisório de nível hedge fund';

-- Verificar migração
SELECT 
  'Migration complete!' as status,
  COUNT(*) as total_memos,
  COUNT(thesis_primary_type) as with_thesis_type,
  COUNT(asymmetry_score) as with_asymmetry,
  COUNT(investability_score_standalone) as with_investability
FROM ic_memos;
