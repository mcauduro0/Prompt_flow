/**
 * ARC Investment Factory - IdeaCard Schema
 * Zod validation schema following Operating Parameters specification exactly
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

// ============================================================================
// NESTED SCHEMAS
// ============================================================================

export const QuickMetricsSchema = z.object({
  market_cap_usd: z.number().nullable(),
  ev_to_ebitda: z.number().nullable(),
  pe: z.number().nullable(),
  fcf_yield: z.number().nullable(),
  revenue_cagr_3y: z.number().nullable(),
  ebit_margin: z.number().nullable(),
  net_debt_to_ebitda: z.number().nullable(),
});

export const CatalystSchema = z.object({
  name: z.string().min(1),
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
  business_quality_prior: z.number().min(0).max(15),
  financial_resilience_prior: z.number().min(0).max(15),
  valuation_tension: z.number().min(0).max(15),
  catalyst_clarity: z.number().min(0).max(10),
  information_availability: z.number().min(0).max(10),
  complexity_penalty: z.number().min(0).max(10),
  disclosure_friction_penalty: z.number().min(0).max(5),
});

export const EvidenceRefSchema = z.object({
  source_type: SourceTypeSchema,
  source_id: z.string(),
  snippet: z.string(),
});

// ============================================================================
// MAIN IDEACARD SCHEMA
// ============================================================================

export const IdeaCardSchema = z.object({
  idea_id: z.string().uuid(),
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  ticker: z.string().min(1).max(10),
  company_name: z.string().min(1),
  region: z.string().min(1),
  currency: z.string().length(3),
  sector: z.string().min(1),
  industry: z.string().min(1),
  style_tag: StyleTagSchema,
  one_sentence_hypothesis: z.string().min(10).max(500),
  mechanism: z.string().min(10),
  time_horizon: z.literal('1_3_years'),
  edge_type: z.array(EdgeTypeSchema).min(1),
  quick_metrics: QuickMetricsSchema,
  catalysts: z.array(CatalystSchema).min(0),
  signposts: z.array(SignpostSchema).min(2), // Minimum 2 signposts required
  gate_results: GateResultsSchema,
  score: ScoreSchema,
  status: IdeaStatusSchema,
  rejection_reason: z.string().nullable(),
  next_action: NextActionSchema,
  evidence_refs: z.array(EvidenceRefSchema).min(0),
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

export type QuickMetrics = z.infer<typeof QuickMetricsSchema>;
export type Catalyst = z.infer<typeof CatalystSchema>;
export type Signpost = z.infer<typeof SignpostSchema>;
export type GateResults = z.infer<typeof GateResultsSchema>;
export type Score = z.infer<typeof ScoreSchema>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export type IdeaCard = z.infer<typeof IdeaCardSchema>;
export type IdeaCardCreate = z.infer<typeof IdeaCardCreateSchema>;
export type IdeaCardUpdate = z.infer<typeof IdeaCardUpdateSchema>;
