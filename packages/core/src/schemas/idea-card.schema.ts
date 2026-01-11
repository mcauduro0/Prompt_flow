/**
 * ARC Investment Factory - IdeaCard Schema
 * Zod validation schema following Operating Parameters specification exactly
 * 
 * UPDATED: Added rejection_shadow and whats_new_since_last_time fields
 * per Operating Parameters compliance requirements
 */

import { z } from 'zod';

// ============================================================================
// ENUMS AND LITERALS
// ============================================================================

export const StyleTagSchema = z.enum(['quality_compounder', 'garp', 'cigar_butt']);

export const EdgeTypeSchema = z.enum([
  'variant_perception',
  'unit_economics_inflection',
  'mispriced_risk',
  'reinvestment_runway',
  'rerating_catalyst',
  'underfollowed',
]);

export const IdeaStatusSchema = z.enum(['new', 'monitoring', 'promoted', 'rejected']);

export const NextActionSchema = z.enum(['monitor', 'request_data', 'promote_to_lane_b', 'drop']);

export const GateResultSchema = z.enum(['pass', 'fail']);

export const ImpactLevelSchema = z.enum(['low', 'medium', 'high']);

export const FrequencySchema = z.enum(['monthly', 'quarterly', 'event_driven']);

export const DirectionSchema = z.enum(['up', 'down', 'stable']);

export const SourceTypeSchema = z.enum(['filing', 'transcript', 'investor_deck', 'news', 'data']);

/**
 * Rejection reasons that create a "shadow" blocking re-submission
 * Per Operating Parameters: blocking_reasons vs non-blocking
 */
export const RejectionReasonSchema = z.enum([
  // Blocking reasons (cannot re-submit)
  'fraud_concern',
  'regulatory_block',
  'permanent_impairment',
  'governance_failure',
  // Non-blocking reasons (can re-submit with new edge)
  'thesis_invalidated',
  'valuation_no_longer_attractive',
  'catalyst_expired',
  'better_opportunity',
  'insufficient_edge',
  'data_quality_issues',
]);

// ============================================================================
// NESTED SCHEMAS
// ============================================================================

export const QuickMetricsSchema = z.object({
  market_cap_usd: z.number().nullable(),
  ev_to_ebitda: z.number().nullable(),
  pe: z.number().nullable(),
  pe_ratio: z.number().nullable().optional(), // Alias for pe
  fcf_yield: z.number().nullable(),
  revenue_cagr_3y: z.number().nullable(),
  ebit_margin: z.number().nullable(),
  net_debt_to_ebitda: z.number().nullable(),
  current_ratio: z.number().nullable().optional(),
  roic: z.number().nullable().optional(),
  price_to_book: z.number().nullable().optional(),
});

export const CatalystSchema = z.object({
  name: z.string().min(1),
  catalyst: z.string().min(1).optional(), // Alias for name
  window: z.string().min(1),
  probability: z.number().min(0).max(1),
  expected_impact: ImpactLevelSchema,
  how_to_monitor: z.string().min(1),
});

export const SignpostSchema = z.object({
  metric: z.string().min(1),
  direction: DirectionSchema,
  threshold: z.string().min(1),
  frequency: FrequencySchema,
  why_it_matters: z.string().min(1),
});

export const GateResultsSchema = z.object({
  gate_0_data_sufficiency: GateResultSchema,
  gate_1_coherence: GateResultSchema,
  gate_2_edge_claim: GateResultSchema,
  gate_3_downside_shape: GateResultSchema,
  gate_4_style_fit: GateResultSchema,
});

export const ScoreSchema = z.object({
  total: z.number().min(0).max(100),
  edge_clarity: z.number().min(0).max(20),
  edgeClarity: z.number().min(0).max(20).optional(), // Alias
  business_quality_prior: z.number().min(0).max(15),
  businessQualityPrior: z.number().min(0).max(15).optional(), // Alias
  financial_resilience_prior: z.number().min(0).max(15),
  financialResiliencePrior: z.number().min(0).max(15).optional(), // Alias
  valuation_tension: z.number().min(0).max(15),
  valuationTension: z.number().min(0).max(15).optional(), // Alias
  catalyst_clarity: z.number().min(0).max(10),
  catalystClarity: z.number().min(0).max(10).optional(), // Alias
  information_availability: z.number().min(0).max(10),
  informationAvailability: z.number().min(0).max(10).optional(), // Alias
  complexity_penalty: z.number().min(0).max(10),
  complexityPenalty: z.number().min(0).max(10).optional(), // Alias
  disclosure_friction_penalty: z.number().min(0).max(5),
  disclosureFrictionPenalty: z.number().min(0).max(5).optional(), // Alias
});

export const EvidenceRefSchema = z.object({
  source_type: SourceTypeSchema,
  source_id: z.string(),
  snippet: z.string(),
});

/**
 * Rejection Shadow Schema
 * Tracks prior rejections and whether they block re-submission
 */
export const RejectionShadowSchema = z.object({
  rejected_at: z.string().datetime().or(z.date()),
  reason: RejectionReasonSchema,
  is_blocking: z.boolean(),
  prior_idea_id: z.string().uuid().optional(),
  notes: z.string().optional(),
});

/**
 * What's New Since Last Time Schema
 * Tracks changes that justify re-surfacing a previously seen ticker
 */
export const WhatsNewSinceLastTimeSchema = z.array(z.object({
  category: z.enum([
    'new_edge_type',
    'style_tag_change',
    'catalyst_emerged',
    'valuation_improved',
    'fundamentals_changed',
    'management_change',
    'regulatory_change',
    'market_conditions',
    'first_time_in_universe',
    'not_seen_in_90_days',
  ]),
  description: z.string().min(10),
  evidence: z.string().optional(),
  detected_at: z.string().datetime().or(z.date()).optional(),
}));

// ============================================================================
// MAIN IDEACARD SCHEMA
// ============================================================================

export const IdeaCardSchema = z.object({
  // Core identifiers
  idea_id: z.string().uuid(),
  ideaId: z.string().uuid().optional(), // Alias
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  
  // Company info
  ticker: z.string().min(1).max(10),
  company_name: z.string().min(1),
  companyName: z.string().min(1).optional(), // Alias
  region: z.string().min(1),
  currency: z.string().length(3),
  sector: z.string().min(1),
  industry: z.string().min(1),
  
  // Classification
  style_tag: StyleTagSchema,
  styleTag: StyleTagSchema.optional(), // Alias
  
  // Thesis
  one_sentence_hypothesis: z.string().min(10).max(500),
  oneSentenceHypothesis: z.string().min(10).max(500).optional(), // Alias
  mechanism: z.string().min(10),
  time_horizon: z.literal('1_3_years'),
  edge_type: z.array(EdgeTypeSchema).min(1),
  edgeType: z.array(EdgeTypeSchema).min(1).optional(), // Alias
  
  // Metrics and analysis
  quick_metrics: QuickMetricsSchema,
  quickMetrics: QuickMetricsSchema.optional(), // Alias
  catalysts: z.array(CatalystSchema).min(0),
  signposts: z.array(SignpostSchema).min(2),
  
  // Gate results
  gate_results: GateResultsSchema,
  gateResults: GateResultsSchema.optional(), // Alias
  
  // Scoring
  score: ScoreSchema,
  novelty_score: z.string().optional(),
  noveltyScore: z.string().or(z.number()).optional(), // Alias
  repetition_penalty: z.string().optional(),
  rank_score: z.string().optional(),
  rankScore: z.string().or(z.number()).optional(), // Alias
  
  // Status
  status: IdeaStatusSchema,
  rejection_reason: z.string().nullable(),
  rejectionReason: z.string().nullable().optional(), // Alias
  next_action: NextActionSchema,
  nextAction: NextActionSchema.optional(), // Alias
  
  // Evidence
  evidence_refs: z.array(EvidenceRefSchema).min(0),
  evidenceRefs: z.array(EvidenceRefSchema).min(0).optional(), // Alias
  
  // NEW: Rejection Shadow
  // Tracks prior rejections and whether they block re-submission
  rejection_shadow: RejectionShadowSchema.nullable().optional(),
  rejectionShadow: RejectionShadowSchema.nullable().optional(), // Alias
  
  // NEW: What's New Since Last Time
  // Tracks changes that justify re-surfacing a previously seen ticker
  whats_new_since_last_time: WhatsNewSinceLastTimeSchema.optional(),
  whatsNewSinceLastTime: WhatsNewSinceLastTimeSchema.optional(), // Alias
  
  // Versioning (immutable versions)
  version: z.number().int().positive().optional(),
  
  // Novelty tracking
  is_new_ticker: z.boolean().optional(),
  isNewTicker: z.boolean().optional(), // Alias
  is_exploration: z.boolean().optional(),
  isExploration: z.boolean().optional(), // Alias
  
  // Rank (for display)
  rank: z.number().int().positive().optional(),
});

// ============================================================================
// PARTIAL SCHEMAS FOR CREATION/UPDATE
// ============================================================================

export const IdeaCardCreateSchema = IdeaCardSchema.omit({
  idea_id: true,
  gate_results: true,
  score: true,
  status: true,
  rejection_reason: true,
  next_action: true,
}).extend({
  idea_id: z.string().uuid().optional(),
  ideaId: z.string().uuid().optional(),
});

export const IdeaCardUpdateSchema = IdeaCardSchema.partial().required({
  idea_id: true,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type StyleTag = z.infer<typeof StyleTagSchema>;
export type EdgeType = z.infer<typeof EdgeTypeSchema>;
export type IdeaStatus = z.infer<typeof IdeaStatusSchema>;
export type NextAction = z.infer<typeof NextActionSchema>;
export type GateResult = z.infer<typeof GateResultSchema>;
export type ImpactLevel = z.infer<typeof ImpactLevelSchema>;
export type Frequency = z.infer<typeof FrequencySchema>;
export type Direction = z.infer<typeof DirectionSchema>;
export type SourceType = z.infer<typeof SourceTypeSchema>;
export type RejectionReason = z.infer<typeof RejectionReasonSchema>;

export type QuickMetrics = z.infer<typeof QuickMetricsSchema>;
export type Catalyst = z.infer<typeof CatalystSchema>;
export type Signpost = z.infer<typeof SignpostSchema>;
export type GateResults = z.infer<typeof GateResultsSchema>;
export type Score = z.infer<typeof ScoreSchema>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type RejectionShadow = z.infer<typeof RejectionShadowSchema>;
export type WhatsNewSinceLastTime = z.infer<typeof WhatsNewSinceLastTimeSchema>;

export type IdeaCard = z.infer<typeof IdeaCardSchema>;
export type IdeaCardCreate = z.infer<typeof IdeaCardCreateSchema>;
export type IdeaCardUpdate = z.infer<typeof IdeaCardUpdateSchema>;
