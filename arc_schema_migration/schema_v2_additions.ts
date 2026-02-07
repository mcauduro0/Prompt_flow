// ============================================================================
// ARC_IC_MEMO_SCHEMA_V2 - Novos campos para sistema decisório hedge fund
// ============================================================================
// Este arquivo contém as adições ao schema existente de IC Memos
// para implementar o ARC_IC_MEMO_SCHEMA_V1 proposto
// ============================================================================

import { pgTable, uuid, text, integer, numeric, boolean, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// ============================================================================
// NOVOS ENUMS
// ============================================================================

export const thesisPrimaryTypeEnum = pgEnum('thesis_primary_type', [
  'quality_compounder',
  'value',
  'turnaround',
  'contrarian',
  'special_situation',
  'macro_proxy'
]);

export const riskPrimaryCategoryEnum = pgEnum('risk_primary_category', [
  'structural',
  'cyclical',
  'regulatory',
  'financial',
  'execution',
  'macro'
]);

export const capitalEfficiencyEnum = pgEnum('capital_efficiency_classification', [
  'capital_compounder',
  'capital_intensive',
  'capital_fragile'
]);

export const industryStructureEnum = pgEnum('industry_structure', [
  'fragmented',
  'oligopoly',
  'monopoly',
  'disrupted'
]);

export const catalystTypeEnum = pgEnum('catalyst_type', [
  'earnings',
  'regulatory',
  'strategic',
  'macro',
  'technical'
]);

export const catalystStrengthEnum = pgEnum('catalyst_strength', [
  'weak',
  'medium',
  'strong'
]);

export const portfolioRoleEnum = pgEnum('portfolio_role', [
  'core',
  'opportunistic',
  'tactical',
  'monitor_only'
]);

export const postMortemStatusEnum = pgEnum('post_mortem_status', [
  'pending',
  'success',
  'failure',
  'ongoing'
]);

export const modelErrorTypeEnum = pgEnum('model_error_type', [
  'thesis',
  'timing',
  'valuation',
  'risk_underestimation',
  'execution'
]);

export const decisionStatusEnum = pgEnum('decision_status', [
  'approve',
  'reject',
  'monitor',
  'reduce'
]);

// ============================================================================
// NOVOS CAMPOS PARA IC_MEMOS (a serem adicionados via ALTER TABLE)
// ============================================================================

export const icMemosV2Additions = {
  // -------------------------------------------------------------------------
  // Campos de Identidade Adicionais
  // -------------------------------------------------------------------------
  sector: text('sector'),
  subsector: text('subsector'),
  region: text('region'),
  currency: text('currency'),
  schemaVersion: text('schema_version').default('v2.0'),
  
  // -------------------------------------------------------------------------
  // Classificação da Tese
  // -------------------------------------------------------------------------
  thesisPrimaryType: thesisPrimaryTypeEnum('thesis_primary_type'),
  thesisSecondaryType: text('thesis_secondary_type'),
  thesisTimeHorizonMonths: integer('thesis_time_horizon_months'),
  thesisStyleVector: jsonb('thesis_style_vector').$type<{
    quality_exposure: number;      // 0-1
    cyclicality_exposure: number;  // 0-1
    structural_risk_exposure: number; // 0-1
    macro_dependency: number;      // 0-1
    execution_dependency: number;  // 0-1
  }>(),
  
  // -------------------------------------------------------------------------
  // Convicção e Recomendação Expandidos
  // -------------------------------------------------------------------------
  recommendationLabelInferred: text('recommendation_label_inferred'),
  recommendationConflictFlag: boolean('recommendation_conflict_flag').default(false),
  convictionLevel: text('conviction_level'), // low, medium, high
  
  // -------------------------------------------------------------------------
  // Assimetria e Retorno Esperado
  // -------------------------------------------------------------------------
  priceCurrent: numeric('price_current', { precision: 12, scale: 4 }),
  priceAtMemo: numeric('price_at_memo', { precision: 12, scale: 4 }),
  baseCaseUpsidePct: numeric('base_case_upside_pct', { precision: 8, scale: 4 }),
  bullCaseUpsidePct: numeric('bull_case_upside_pct', { precision: 8, scale: 4 }),
  bearCaseDownsidePct: numeric('bear_case_downside_pct', { precision: 8, scale: 4 }),
  expectedReturnBasePct: numeric('expected_return_base_pct', { precision: 8, scale: 4 }),
  expectedReturnProbabilityWeightedPct: numeric('expected_return_probability_weighted_pct', { precision: 8, scale: 4 }),
  asymmetryScore: numeric('asymmetry_score', { precision: 5, scale: 2 }), // 0-100
  leftTailRiskFlag: boolean('left_tail_risk_flag').default(false),
  
  // -------------------------------------------------------------------------
  // Risco Estruturado
  // -------------------------------------------------------------------------
  riskPrimaryCategory: riskPrimaryCategoryEnum('risk_primary_category'),
  riskSecondaryCategories: jsonb('risk_secondary_categories').$type<string[]>(),
  riskConcentrationVector: jsonb('risk_concentration_vector').$type<{
    marketing_efficiency_risk: number;
    platform_dependency_risk: number;
    supplier_power_risk: number;
    regulatory_risk: number;
    macro_demand_risk: number;
  }>(),
  earlyWarningIndicators: jsonb('early_warning_indicators').$type<Array<{
    indicator_name: string;
    indicator_description: string;
    trigger_condition: string;
  }>>(),
  
  // -------------------------------------------------------------------------
  // Business and Moat Scores
  // -------------------------------------------------------------------------
  industryStructure: industryStructureEnum('industry_structure'),
  moatStrengthScore: numeric('moat_strength_score', { precision: 4, scale: 2 }), // 0-10
  moatDurabilityScore: numeric('moat_durability_score', { precision: 4, scale: 2 }), // 0-10
  
  // -------------------------------------------------------------------------
  // Financial Quality Scores
  // -------------------------------------------------------------------------
  revenueQualityScore: numeric('revenue_quality_score', { precision: 4, scale: 2 }), // 0-10
  marginQualityScore: numeric('margin_quality_score', { precision: 4, scale: 2 }), // 0-10
  capitalIntensityScore: numeric('capital_intensity_score', { precision: 4, scale: 2 }), // 0-10
  roicDurabilityScore: numeric('roic_durability_score', { precision: 4, scale: 2 }), // 0-10
  capitalEfficiencyClassification: capitalEfficiencyEnum('capital_efficiency_classification'),
  roicFragilityFlag: boolean('roic_fragility_flag').default(false),
  
  // -------------------------------------------------------------------------
  // Valuation Metrics
  // -------------------------------------------------------------------------
  valuationMultipleCurrent: numeric('valuation_multiple_current', { precision: 8, scale: 2 }),
  valuationMultipleImpliedBase: numeric('valuation_multiple_implied_base', { precision: 8, scale: 2 }),
  valuationMultipleImpliedBear: numeric('valuation_multiple_implied_bear', { precision: 8, scale: 2 }),
  valuationPremiumFlag: boolean('valuation_premium_flag').default(false),
  
  // -------------------------------------------------------------------------
  // Catalyst Metrics
  // -------------------------------------------------------------------------
  catalystType: catalystTypeEnum('catalyst_type'),
  catalystStrength: catalystStrengthEnum('catalyst_strength'),
  catalystClarityScore: numeric('catalyst_clarity_score', { precision: 4, scale: 2 }), // 0-10
  catalystTimeframeMonths: integer('catalyst_timeframe_months'),
  
  // -------------------------------------------------------------------------
  // Portfolio Fit Quantitativo
  // -------------------------------------------------------------------------
  portfolioRole: portfolioRoleEnum('portfolio_role'),
  suggestedPositionSizeMinPct: numeric('suggested_position_size_min_pct', { precision: 5, scale: 2 }),
  suggestedPositionSizeMaxPct: numeric('suggested_position_size_max_pct', { precision: 5, scale: 2 }),
  portfolioRiskContribution: numeric('portfolio_risk_contribution', { precision: 5, scale: 4 }), // 0-1
  riskRedundancyFlag: boolean('risk_redundancy_flag').default(false),
  
  // -------------------------------------------------------------------------
  // Decision Logic and Governance
  // -------------------------------------------------------------------------
  investabilityScoreStandalone: numeric('investability_score_standalone', { precision: 5, scale: 2 }), // 0-100
  investabilityScoreMarginal: numeric('investability_score_marginal', { precision: 5, scale: 2 }), // 0-100
  decisionStatus: decisionStatusEnum('decision_status'),
  decisionRationaleStructured: text('decision_rationale_structured'),
  
  // -------------------------------------------------------------------------
  // Learning and Feedback Loop (Post-Mortem)
  // -------------------------------------------------------------------------
  postMortemStatus: postMortemStatusEnum('post_mortem_status').default('pending'),
  realizedReturnPct: numeric('realized_return_pct', { precision: 8, scale: 4 }),
  holdingPeriodMonths: integer('holding_period_months'),
  exitDate: timestamp('exit_date'),
  exitPrice: numeric('exit_price', { precision: 12, scale: 4 }),
  exitReason: text('exit_reason'),
  modelErrorFlag: boolean('model_error_flag').default(false),
  errorType: modelErrorTypeEnum('error_type'),
  postMortemNotes: text('post_mortem_notes'),
  lessonsLearned: jsonb('lessons_learned').$type<string[]>(),
  
  // -------------------------------------------------------------------------
  // Inference Tracking
  // -------------------------------------------------------------------------
  inferredFields: jsonb('inferred_fields').$type<string[]>(), // Lista de campos que foram inferidos
  inferenceConfidence: jsonb('inference_confidence').$type<Record<string, number>>(), // Confiança por campo
  lastInferenceAt: timestamp('last_inference_at'),
};

// ============================================================================
// SQL MIGRATION SCRIPT
// ============================================================================

export const migrationSQL = `
-- ============================================================================
-- ARC IC MEMOS SCHEMA V2 MIGRATION
-- Adiciona campos para sistema decisório de nível hedge fund
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

-- Adicionar novos campos à tabela ic_memos
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

-- Criar índices para os novos campos
CREATE INDEX IF NOT EXISTS ic_memos_thesis_primary_type_idx ON ic_memos(thesis_primary_type);
CREATE INDEX IF NOT EXISTS ic_memos_portfolio_role_idx ON ic_memos(portfolio_role);
CREATE INDEX IF NOT EXISTS ic_memos_post_mortem_status_idx ON ic_memos(post_mortem_status);
CREATE INDEX IF NOT EXISTS ic_memos_decision_status_idx ON ic_memos(decision_status);
CREATE INDEX IF NOT EXISTS ic_memos_asymmetry_score_idx ON ic_memos(asymmetry_score);
CREATE INDEX IF NOT EXISTS ic_memos_investability_score_standalone_idx ON ic_memos(investability_score_standalone);

-- Comentário de conclusão
COMMENT ON TABLE ic_memos IS 'IC Memos with ARC_IC_MEMO_SCHEMA_V2 - Sistema decisório de nível hedge fund';
`;
