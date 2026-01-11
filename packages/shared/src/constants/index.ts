/**
 * ARC Investment Factory - Operating Parameters
 * These constants are locked as per the Build Pack specification
 */

// ============================================================================
// CORE OPERATING PARAMETERS (LOCKED)
// ============================================================================

export const OPERATING_PARAMETERS = {
  // Asset class and horizon
  ASSET_CLASS: 'global_equities' as const,
  HOLDING_HORIZON: '1_3_years' as const,
  DEFAULT_OPTIMIZATION: 'novelty' as const,

  // Daily Lane A targets
  LANE_A_DAILY_TARGET: 120,
  LANE_A_DAILY_CAP: 200,

  // Lane B targets
  LANE_B_DAILY_PROMOTIONS_TARGET: 3,
  LANE_B_DAILY_PROMOTIONS_MAX: 4,
  LANE_B_WEEKLY_DEEP_PACKETS: 10,
  LANE_B_MAX_CONCURRENCY: 3,

  // Time budgets (in minutes)
  LANE_A_TIME_PER_IDEA_MIN: 2,
  LANE_A_TIME_PER_IDEA_MAX: 6,
  LANE_B_TIME_PER_NAME_MIN: 60,
  LANE_B_TIME_PER_NAME_MAX: 120,
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
  // Positive novelty factors
  TICKER_NEW_IF_NOT_SEEN_DAYS: 90,
  TICKER_NEW_BONUS: 30,
  NEW_EDGE_TYPE_BONUS: 20,
  STYLE_TAG_CHANGED_BONUS: 10,
  NEW_CATALYST_WINDOW_BONUS: 10,
  NEW_THEME_INTERSECTION_BONUS: 10,
  NOVELTY_SCORE_CAP: 60,

  // Repetition penalties
  SEEN_IN_LAST_30_DAYS_NO_NEW_EDGE_PENALTY: -15,
  SEEN_MORE_THAN_3_TIMES_IN_90_DAYS_PENALTY: -10,

  // Disclosure friction penalties
  MISSING_FILINGS_OR_TRANSCRIPT_PENALTY: -5,
  MISSING_PEER_SET_PENALTY: -3,
} as const;

// ============================================================================
// IDEA INBOX RANKING WEIGHTS
// ============================================================================

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
  HIGH_EDGE_THRESHOLD: 16, // out of 20
  CIGAR_BUTT_DEFAULT_SCORE: 72,
  CIGAR_BUTT_DOWNSIDE_PROTECTION_OVERRIDE_MIN: 13, // out of 15
  WEEKLY_QUOTA_OVERWEIGHT_PP_THRESHOLD: 0.10,
  WEEKLY_QUOTA_THRESHOLD_ADD: 3,
} as const;

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
  COMPLEXITY_PENALTY: { min: 0, max: 10 }, // subtracted
  DISCLOSURE_FRICTION_PENALTY: { min: 0, max: 5 }, // subtracted
} as const;

// ============================================================================
// DECAY HALF-LIVES (in days)
// ============================================================================

export const DECAY_HALF_LIVES = {
  LANE_A_INTERPRETATION: 45,
  LANE_B_THESIS: 120,
} as const;

// ============================================================================
// EDGE TYPES
// ============================================================================

export const EDGE_TYPES = [
  'variant_perception',
  'unit_economics_inflection',
  'mispriced_risk',
  'reinvestment_runway',
  'rerating_catalyst',
  'underfollowed',
] as const;
export type EdgeType = typeof EDGE_TYPES[number];

// ============================================================================
// IDEA STATUS
// ============================================================================

export const IDEA_STATUS = ['new', 'monitoring', 'promoted', 'rejected'] as const;
export type IdeaStatus = typeof IDEA_STATUS[number];

// ============================================================================
// NEXT ACTIONS
// ============================================================================

export const NEXT_ACTIONS = ['monitor', 'request_data', 'promote_to_lane_b', 'drop'] as const;
export type NextAction = typeof NEXT_ACTIONS[number];

// ============================================================================
// GATE RESULTS
// ============================================================================

export const GATE_RESULT = ['pass', 'fail'] as const;
export type GateResult = typeof GATE_RESULT[number];

// ============================================================================
// RELIABILITY GRADES
// ============================================================================

export const RELIABILITY_GRADES = ['A', 'B', 'C'] as const;
export type ReliabilityGrade = typeof RELIABILITY_GRADES[number];

// ============================================================================
// SOURCE TYPES
// ============================================================================

export const SOURCE_TYPES = ['filing', 'transcript', 'investor_deck', 'news', 'dataset'] as const;
export type SourceType = typeof SOURCE_TYPES[number];

// ============================================================================
// CLAIM TYPES
// ============================================================================

export const CLAIM_TYPES = ['numeric', 'qualitative'] as const;
export type ClaimType = typeof CLAIM_TYPES[number];

// ============================================================================
// RECOMMENDATION TYPES
// ============================================================================

export const RECOMMENDATION_TYPES = ['watch', 'deep_dive_more', 'starter_position', 'pass'] as const;
export type RecommendationType = typeof RECOMMENDATION_TYPES[number];

// ============================================================================
// PROBABILITY/IMPACT LEVELS
// ============================================================================

export const PROBABILITY_LEVELS = ['low', 'medium', 'high'] as const;
export type ProbabilityLevel = typeof PROBABILITY_LEVELS[number];

export const IMPACT_LEVELS = ['low', 'medium', 'high'] as const;
export type ImpactLevel = typeof IMPACT_LEVELS[number];

// ============================================================================
// VALUATION METHODS
// ============================================================================

export const VALUATION_METHODS = ['dcf', 'comps', 'sopt', 'precedent'] as const;
export type ValuationMethod = typeof VALUATION_METHODS[number];

// ============================================================================
// FREQUENCY TYPES
// ============================================================================

export const FREQUENCY_TYPES = ['monthly', 'quarterly', 'event_driven'] as const;
export type FrequencyType = typeof FREQUENCY_TYPES[number];

// ============================================================================
// DIRECTION TYPES
// ============================================================================

export const DIRECTION_TYPES = ['up', 'down', 'stable'] as const;
export type DirectionType = typeof DIRECTION_TYPES[number];

// ============================================================================
// OUTCOME FAILURE MODES
// ============================================================================

export const FAILURE_MODES = [
  'thesis_wrong',
  'timing_wrong',
  'valuation_wrong',
  'risk_realized',
  'management_execution',
  'macro_regime',
  'unknown',
] as const;
export type FailureMode = typeof FAILURE_MODES[number];

// ============================================================================
// RUN TYPES
// ============================================================================

export const RUN_TYPES = [
  'daily_discovery',
  'daily_lane_b',
  'monitoring_trigger',
  'weekly_ic_bundle',
  'monthly_process_audit',
] as const;
export type RunType = typeof RUN_TYPES[number];
