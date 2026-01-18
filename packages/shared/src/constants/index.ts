/**
 * ARC Investment Factory - Operating Parameters
 * LOCKED PARAMETERS - DO NOT MODIFY WITHOUT APPROVAL
 * 
 * These constants define the operational boundaries of the system.
 * All values are derived from the Operating Parameters specification.
 * 
 * Updated: 2026-01-18 - New limits and daily schedule (Mon-Sun)
 */

// ============================================================================
// CORE LOCKED PARAMETERS
// ============================================================================

/**
 * Asset class and optimization mode - LOCKED
 */
export const ASSET_CLASS = 'global_equities' as const;
export const DEFAULT_OPTIMIZATION = 'novelty_first' as const;
export const HOLDING_HORIZON = '1_3_years' as const;

/**
 * System timezone - America/Sao_Paulo
 */
export const SYSTEM_TIMEZONE = 'America/Sao_Paulo';

// ============================================================================
// LANE 0 PARAMETERS
// ============================================================================

/** Lane 0: Substack + Reddit Ingestion */
export const LANE_0_DAILY_LIMIT = 200;
export const LANE_0_MAX_IDEAS_PER_SOURCE = 100;
export const LANE_0_MAX_IDEAS_TO_LANE_A = 50;

// ============================================================================
// LANE A PARAMETERS - UPDATED
// ============================================================================

/** Daily target for Idea Inbox */
export const LANE_A_DAILY_TARGET = 200;

/** Daily cap - max tickers to enrich */
export const LANE_A_DAILY_CAP = 200;

/** Max tickers for LLM enrichment after novelty shortlist */
export const LANE_A_LLM_ENRICHMENT_CAP = 200;

/** Exploration rate - random selection for diversity */
export const LANE_A_EXPLORATION_RATE = 0.10;

/** Time budget per idea (minutes) */
export const LANE_A_TIME_PER_IDEA_MIN = 2;
export const LANE_A_TIME_PER_IDEA_MAX = 6;

// Backward compatibility
export const LANE_A_DAILY_LIMIT = LANE_A_DAILY_TARGET;

// ============================================================================
// LANE B PARAMETERS - UPDATED
// ============================================================================

/** Daily promotions target: 3-5 */
export const LANE_B_DAILY_PROMOTIONS_TARGET = 10;

/** Daily promotions hard cap: 50 */
export const LANE_B_DAILY_PROMOTIONS_MAX = 50;

/** Weekly deep packets hard cap: 200 */
export const LANE_B_WEEKLY_DEEP_PACKETS = 200;

/** Max concurrent research jobs */
export const LANE_B_MAX_CONCURRENCY = 3;

/** Time budget per name (minutes) */
export const LANE_B_TIME_PER_NAME_MIN = 60;
export const LANE_B_TIME_PER_NAME_MAX = 120;

// Backward compatibility
export const LANE_B_DAILY_LIMIT = LANE_B_DAILY_PROMOTIONS_MAX;
export const LANE_B_WEEKLY_LIMIT = LANE_B_WEEKLY_DEEP_PACKETS;

// ============================================================================
// LANE C PARAMETERS (IC Bundle)
// ============================================================================

/** Lane C: IC Bundle generation */
export const LANE_C_MAX_PACKETS_PER_BUNDLE = 10;
export const LANE_C_MIN_CONVICTION_FOR_BUNDLE = 6;

// ============================================================================
// NOVELTY WINDOWS - LOCKED
// ============================================================================

/** Ticker is "new" if not seen in 90 days */
export const NOVELTY_NEW_TICKER_DAYS = 90;

/** Repetition penalty window: 30 days */
export const NOVELTY_PENALTY_WINDOW_DAYS = 30;

// Backward compatibility
export const NOVELTY_DECAY_DAYS = NOVELTY_NEW_TICKER_DAYS;

// ============================================================================
// SCHEDULE CONFIGURATION - UPDATED (Mon-Sun)
// ============================================================================

export const SCHEDULES = {
  // Lane 0: Substack + Reddit Ingestion - 05:00 Sao Paulo, daily
  LANE_0_CRON: '0 5 * * *',
  LANE_0_HOUR: 5,
  
  // Lane A: Daily Discovery - 06:00 Sao Paulo, daily
  LANE_A_CRON: '0 6 * * *',
  LANE_A_HOUR: 6,
  
  // Lane B: Deep Research - 08:00 Sao Paulo, daily
  LANE_B_CRON: '0 8 * * *',
  LANE_B_HOUR: 8,
  
  // Lane C: IC Bundle - 10:00 Sao Paulo, daily
  LANE_C_CRON: '0 10 * * *',
  LANE_C_HOUR: 10,
  
  // QA Report: 18:00 Sao Paulo, Fridays only
  QA_REPORT_CRON: '0 18 * * 5',
  
  // Monthly Process Audit - 10:00 Sao Paulo, first weekday of month
  MONTHLY_AUDIT_CRON: '0 10 1-7 * 1-5',
} as const;

// ============================================================================
// OPERATING PARAMETERS (AGGREGATED)
// ============================================================================

export const OPERATING_PARAMETERS = {
  ASSET_CLASS,
  HOLDING_HORIZON,
  DEFAULT_OPTIMIZATION,
  LANE_0_DAILY_LIMIT,
  LANE_0_MAX_IDEAS_PER_SOURCE,
  LANE_0_MAX_IDEAS_TO_LANE_A,
  LANE_A_DAILY_TARGET,
  LANE_A_DAILY_CAP,
  LANE_A_LLM_ENRICHMENT_CAP,
  LANE_A_EXPLORATION_RATE,
  LANE_B_DAILY_PROMOTIONS_TARGET,
  LANE_B_DAILY_PROMOTIONS_MAX,
  LANE_B_WEEKLY_DEEP_PACKETS,
  LANE_B_MAX_CONCURRENCY,
  LANE_C_MAX_PACKETS_PER_BUNDLE,
  LANE_C_MIN_CONVICTION_FOR_BUNDLE,
  LANE_A_TIME_PER_IDEA_MIN,
  LANE_A_TIME_PER_IDEA_MAX,
  LANE_B_TIME_PER_NAME_MIN,
  LANE_B_TIME_PER_NAME_MAX,
} as const;

// ============================================================================
// STYLE MIX TARGETS (WEEKLY)
// ============================================================================

export const STYLE_MIX_TARGETS = {
  QUALITY_COMPOUNDER: 0.40,
  GARP: 0.40,
  CIGAR_BUTT: 0.20,
} as const;

export const STYLE_TAGS = ['quality_compounder', 'garp', 'cigar_butt'] as const;
export type StyleTag = typeof STYLE_TAGS[number];

// ============================================================================
// NOVELTY SCORING PARAMETERS
// ============================================================================

export const NOVELTY_SCORING = {
  TICKER_NEW_IF_NOT_SEEN_DAYS: NOVELTY_NEW_TICKER_DAYS,
  TICKER_NEW_BONUS: 30,
  REPETITION_PENALTY_WINDOW_DAYS: NOVELTY_PENALTY_WINDOW_DAYS,
  NEW_EDGE_TYPE_BONUS: 20,
  STYLE_TAG_CHANGED_BONUS: 10,
  NEW_CATALYST_WINDOW_BONUS: 10,
  NEW_THEME_INTERSECTION_BONUS: 10,
  NOVELTY_SCORE_CAP: 60,
  SEEN_IN_LAST_30_DAYS_NO_NEW_EDGE_PENALTY: -15,
  SEEN_MORE_THAN_3_TIMES_IN_90_DAYS_PENALTY: -10,
  REPETITION_PENALTY_PER_APPEARANCE: 0.15,
  MAX_REPETITION_PENALTY: 0.45,
  MIN_NOVELTY_SCORE: 0.10,
  MISSING_FILINGS_OR_TRANSCRIPT_PENALTY: -5,
  MISSING_PEER_SET_PENALTY: -3,
} as const;

// ============================================================================
// IDEA INBOX RANKING WEIGHTS
// ============================================================================

/**
 * Ranking weights for Idea Inbox display
 * Uses WEIGHTED SUM (additive), NOT multiplicative
 */
export const RANKING_WEIGHTS = {
  NOVELTY_SCORE: 0.45,
  EDGE_CLARITY: 0.15,
  VALUATION_TENSION: 0.10,
  CATALYST_TIMING: 0.10,
  BUSINESS_QUALITY_PRIOR: 0.10,
  REPETITION_PENALTY: -0.07,
  DISCLOSURE_FRICTION_PENALTY: -0.03,
} as const;

// ============================================================================
// PROMOTION THRESHOLDS
// ============================================================================

export const PROMOTION_THRESHOLDS = {
  DEFAULT_TOTAL_SCORE: 70,
  QUALITY_OR_GARP_HIGH_EDGE_SCORE: 68,
  HIGH_EDGE_THRESHOLD: 16,
  CIGAR_BUTT_DEFAULT_SCORE: 72,
  CIGAR_BUTT_DOWNSIDE_PROTECTION_OVERRIDE_MIN: 13,
  WEEKLY_QUOTA_OVERWEIGHT_PP_THRESHOLD: 0.10,
  WEEKLY_QUOTA_THRESHOLD_ADD: 3,
} as const;

export function getPromotionThreshold(
  styleTag: StyleTag,
  edgeClarity: number,
  downsideProtection: number,
  styleOverweightPp: number
): number {
  let threshold: number;
  
  switch (styleTag) {
    case 'quality_compounder':
    case 'garp':
      threshold = edgeClarity >= PROMOTION_THRESHOLDS.HIGH_EDGE_THRESHOLD
        ? PROMOTION_THRESHOLDS.QUALITY_OR_GARP_HIGH_EDGE_SCORE
        : PROMOTION_THRESHOLDS.DEFAULT_TOTAL_SCORE;
      break;
    case 'cigar_butt':
      threshold = downsideProtection >= PROMOTION_THRESHOLDS.CIGAR_BUTT_DOWNSIDE_PROTECTION_OVERRIDE_MIN
        ? PROMOTION_THRESHOLDS.DEFAULT_TOTAL_SCORE
        : PROMOTION_THRESHOLDS.CIGAR_BUTT_DEFAULT_SCORE;
      break;
    default:
      threshold = PROMOTION_THRESHOLDS.DEFAULT_TOTAL_SCORE;
  }
  
  if (styleOverweightPp > PROMOTION_THRESHOLDS.WEEKLY_QUOTA_OVERWEIGHT_PP_THRESHOLD) {
    threshold += PROMOTION_THRESHOLDS.WEEKLY_QUOTA_THRESHOLD_ADD;
  }
  
  return threshold;
}

// ============================================================================
// LANE A SCORE COMPONENTS (0-100 additive)
// ============================================================================

export const LANE_A_SCORE_RANGES = {
  EDGE_CLARITY: { min: 0, max: 20 },
  BUSINESS_QUALITY_PRIOR: { min: 0, max: 15 },
  FINANCIAL_RESILIENCE_PRIOR: { min: 0, max: 15 },
  VALUATION_TENSION: { min: 0, max: 15 },
  CATALYST_CLARITY: { min: 0, max: 10 },
  INFORMATION_AVAILABILITY: { min: 0, max: 10 },
  COMPLEXITY_PENALTY: { min: 0, max: 10 },
  DISCLOSURE_FRICTION_PENALTY: { min: 0, max: 5 },
} as const;

export const SCORING_WEIGHTS = LANE_A_SCORE_RANGES;

// ============================================================================
// DECAY HALF-LIVES (in days)
// ============================================================================

export const DECAY_HALF_LIVES = {
  LANE_A_INTERPRETATION: 45,
  LANE_B_THESIS: 120,
} as const;

// ============================================================================
// RESEARCH PACKET COMPLETION CRITERIA
// ============================================================================

export const RESEARCH_PACKET_REQUIRED_FIELDS = [
  'bull_base_bear',
  'variant_perception',
  'historical_parallels',
  'pre_mortem',
  'monitoring_plan',
] as const;

export const SCENARIO_REQUIREMENTS = {
  required_scenarios: ['bull', 'base', 'bear'] as const,
  probability_sum: 1.0,
  probability_tolerance: 0.01,
} as const;

// ============================================================================
// REJECTION SHADOW
// ============================================================================

export const REJECTION_SHADOW = {
  retention_days: 365,
  blocking_reasons: ['fundamental_flaw', 'thesis_invalidated', 'permanent_impairment'] as const,
  soft_reasons: ['timing', 'valuation', 'position_sizing', 'style_quota'] as const,
} as const;

// ============================================================================
// WHAT IS NEW SINCE LAST TIME
// ============================================================================

export const WHATS_NEW_CONFIG = {
  tracked_fields: ['edge_type', 'catalysts', 'signposts', 'quick_metrics', 'one_sentence_hypothesis'] as const,
  numeric_change_threshold: 0.05,
  text_change_threshold: 0.20,
} as const;

// ============================================================================
// EVIDENCE AND TRACEABILITY
// ============================================================================

export const EVIDENCE_REQUIREMENTS = {
  require_source_locator: true,
  source_locator_pattern: /^[a-zA-Z0-9_-]+:(page|table|section):\d+$/,
  max_snippet_length: 500,
  min_evidence_per_module: 3,
  numeric_claim_requires_evidence: true,
  estimate_label: 'estimate',
} as const;

// ============================================================================
// THESIS VERSION IMMUTABILITY
// ============================================================================

export const THESIS_VERSIONING = {
  immutable: true,
  max_versions_per_ticker: 50,
  diff_fields: ['one_sentence_hypothesis', 'mechanism', 'edge_type', 'catalysts', 'signposts', 'quick_metrics', 'score'] as const,
} as const;

// ============================================================================
// GATES CONFIGURATION
// ============================================================================

export const GATES = {
  gate_0_data_sufficiency: {
    min_hypothesis_length: 50,
    min_mechanism_length: 100,
    min_signposts: 2,
    min_catalysts: 1,
    required_metrics: ['market_cap_usd', 'ev_to_ebitda'],
  },
  gate_1_coherence: {
    mechanism_hypothesis_ratio: 2.0,
  },
  gate_2_edge_claim: {
    valid_edge_types: ['variant_perception', 'unit_economics_inflection', 'mispriced_risk', 'reinvestment_runway', 'rerating_catalyst', 'underfollowed'] as const,
    min_edge_types: 1,
  },
  gate_3_downside_shape: {
    max_net_debt_to_ebitda: 5.0,
    cigar_butt_max_net_debt_to_ebitda: 7.0,
    min_current_ratio: 0.8,
    require_positive_fcf_or_explanation: true,
  },
  gate_4_style_fit: {
    quality_compounder: { min_ebit_margin: 0.10, min_roic: 0.12 },
    garp: { max_pe: 50, max_ev_to_ebitda: 25 },
    cigar_butt: { max_ev_to_ebitda: 15, max_price_to_book: 2.0 },
  },
} as const;

// ============================================================================
// NOTIFICATION CONFIGURATION
// ============================================================================

export const NOTIFICATIONS = {
  email: {
    enabled: true,
    daily_inbox_subject: 'ARC Daily Inbox - {{date}}',
    weekly_bundle_subject: 'ARC Weekly IC Bundle - Week {{week}}',
  },
  whatsapp: {
    enabled: false,
    webhook_url: process.env.WHATSAPP_WEBHOOK_URL,
  },
} as const;

// ============================================================================
// ENUMS AND TYPES
// ============================================================================

export const EDGE_TYPES = ['variant_perception', 'unit_economics_inflection', 'mispriced_risk', 'reinvestment_runway', 'rerating_catalyst', 'underfollowed'] as const;
export type EdgeType = typeof EDGE_TYPES[number];

export const IDEA_STATUS = ['new', 'monitoring', 'promoted', 'rejected'] as const;
export type IdeaStatus = typeof IDEA_STATUS[number];

export const NEXT_ACTIONS = ['monitor', 'request_data', 'promote_to_lane_b', 'drop'] as const;
export type NextAction = typeof NEXT_ACTIONS[number];

export const GATE_RESULT = ['pass', 'fail'] as const;
export type GateResult = typeof GATE_RESULT[number];

export const RELIABILITY_GRADES = ['A', 'B', 'C'] as const;
export type ReliabilityGrade = typeof RELIABILITY_GRADES[number];

export const SOURCE_TYPES = ['filing', 'transcript', 'investor_deck', 'news', 'dataset'] as const;
export type SourceType = typeof SOURCE_TYPES[number];

export const CLAIM_TYPES = ['numeric', 'qualitative'] as const;
export type ClaimType = typeof CLAIM_TYPES[number];

export const RECOMMENDATION_TYPES = ['watch', 'deep_dive_more', 'starter_position', 'pass'] as const;
export type RecommendationType = typeof RECOMMENDATION_TYPES[number];

export const PROBABILITY_LEVELS = ['low', 'medium', 'high'] as const;
export type ProbabilityLevel = typeof PROBABILITY_LEVELS[number];

export const IMPACT_LEVELS = ['low', 'medium', 'high'] as const;
export type ImpactLevel = typeof IMPACT_LEVELS[number];

export const VALUATION_METHODS = ['dcf', 'comps', 'sopt', 'precedent'] as const;
export type ValuationMethod = typeof VALUATION_METHODS[number];

export const FREQUENCY_TYPES = ['monthly', 'quarterly', 'event_driven'] as const;
export type FrequencyType = typeof FREQUENCY_TYPES[number];

export const DIRECTION_TYPES = ['up', 'down', 'stable'] as const;
export type DirectionType = typeof DIRECTION_TYPES[number];

export const FAILURE_MODES = ['thesis_wrong', 'timing_wrong', 'valuation_wrong', 'risk_realized', 'management_execution', 'macro_regime', 'unknown'] as const;
export type FailureMode = typeof FAILURE_MODES[number];

export const RUN_TYPES = ['daily_discovery', 'daily_lane_b', 'monitoring_trigger', 'weekly_ic_bundle', 'monthly_process_audit'] as const;
export type RunType = typeof RUN_TYPES[number];

// ============================================================================
// UNIVERSE CONFIGURATION
// ============================================================================

export const UNIVERSE_CONFIG = {
  regions: ['US', 'EU', 'UK', 'JP', 'HK', 'AU', 'CA', 'BR', 'IN', 'KR', 'TW', 'SG'] as const,
  min_market_cap_usd: 500_000_000,
  max_market_cap_usd: 500_000_000_000,
  min_avg_volume_usd: 1_000_000,
  exclude_sectors: ['Financials', 'Utilities'] as const,
  static_universe_file: 'universe.json',
} as const;

export type UniverseRegion = typeof UNIVERSE_CONFIG.regions[number];
