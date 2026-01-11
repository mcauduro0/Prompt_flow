/**
 * ARC Investment Factory - ResearchPacket Schema
 * Zod validation schema following Operating Parameters specification exactly
 */

import { z } from 'zod';
import { StyleTagSchema, ImpactLevelSchema, FrequencySchema } from './idea-card.schema.js';

// ============================================================================
// ENUMS
// ============================================================================

export const RecommendationSchema = z.enum(['watch', 'deep_dive_more', 'starter_position', 'pass']);

export const ValuationMethodSchema = z.enum(['dcf', 'comps', 'sopt', 'precedent']);

export const ProbabilityLevelSchema = z.enum(['low', 'medium', 'high']);

// ============================================================================
// EXECUTIVE VIEW
// ============================================================================

export const ExecutiveViewSchema = z.object({
  recommendation: RecommendationSchema,
  conviction_0_10: z.number().min(0).max(10),
  one_sentence_thesis: z.string().min(10),
  variant_perception: z.string().min(10),
  what_must_be_true: z.array(z.string()).min(1),
  what_would_change_my_mind: z.array(z.string()).min(1),
});

// ============================================================================
// MODULE SCHEMAS
// ============================================================================

export const UnitEconomicsSchema = z.object({
  ltv_cac: z.number().nullable(),
  gross_margin: z.number().nullable(),
  contribution_margin: z.number().nullable(),
  retention: z.number().nullable(),
});

export const BusinessModuleSchema = z.object({
  summary: z.string().min(10),
  unit_economics: UnitEconomicsSchema,
  key_questions: z.array(z.string()),
  evidence: z.array(z.string()), // evidence_ids
});

export const IndustryMoatModuleSchema = z.object({
  summary: z.string().min(10),
  competitive_position: z.string().min(10),
  moat_claims: z.array(z.string()),
  peer_set: z.array(z.string()),
  evidence: z.array(z.string()),
});

export const FinancialForensicsModuleSchema = z.object({
  summary: z.string().min(10),
  earnings_quality_score_1_10: z.number().min(1).max(10),
  cash_conversion_notes: z.string(),
  balance_sheet_risks: z.array(z.string()),
  evidence: z.array(z.string()),
});

export const CapitalAllocationModuleSchema = z.object({
  summary: z.string().min(10),
  track_record: z.string(),
  mna_notes: z.string(),
  evidence: z.array(z.string()),
});

export const ManagementQualityModuleSchema = z.object({
  summary: z.string().min(10),
  score_1_10: z.number().min(1).max(10),
  red_flags: z.array(z.string()),
  evidence: z.array(z.string()),
});

export const FairValueRangeSchema = z.object({
  low: z.number(),
  base: z.number(),
  high: z.number(),
});

export const ValuationModuleSchema = z.object({
  summary: z.string().min(10),
  methods_used: z.array(ValuationMethodSchema).min(1),
  fair_value_range: FairValueRangeSchema,
  key_drivers: z.array(z.string()),
  margin_of_safety_notes: z.string(),
  evidence: z.array(z.string()),
});

export const RiskItemSchema = z.object({
  risk: z.string().min(1),
  probability: ProbabilityLevelSchema,
  impact: ProbabilityLevelSchema,
  mitigants: z.string(),
  early_indicators: z.string(),
});

export const RiskStressModuleSchema = z.object({
  summary: z.string().min(10),
  top_risks: z.array(RiskItemSchema).min(1),
  stress_test_results: z.string(),
  evidence: z.array(z.string()),
});

export const ModulesSchema = z.object({
  business_model: BusinessModuleSchema,
  industry_and_moat: IndustryMoatModuleSchema,
  financial_forensics: FinancialForensicsModuleSchema,
  capital_allocation: CapitalAllocationModuleSchema,
  management_quality: ManagementQualityModuleSchema,
  valuation: ValuationModuleSchema,
  risk_and_stress: RiskStressModuleSchema,
});

// ============================================================================
// SCENARIOS
// ============================================================================

export const ScenarioSchema = z.object({
  probability: z.number().min(0).max(1),
  key_assumptions: z.array(z.string()).min(1),
  price_target: z.number(),
});

export const ScenariosSchema = z.object({
  bull: ScenarioSchema,
  base: ScenarioSchema,
  bear: ScenarioSchema,
  expected_value_price: z.number(),
});

// ============================================================================
// HISTORICAL PARALLELS
// ============================================================================

export const HistoricalParallelSchema = z.object({
  case: z.string().min(1),
  dates: z.string(),
  what_happened: z.string().min(10),
  base_rate_implication: z.string(),
  key_difference_today: z.string(),
});

// ============================================================================
// PRE-MORTEM
// ============================================================================

export const PreMortemSchema = z.object({
  failure_story: z.string().min(20),
  top_failure_modes: z.array(z.string()).min(3),
  early_warnings: z.array(z.string()).min(1),
});

// ============================================================================
// MONITORING PLAN
// ============================================================================

export const KPISchema = z.object({
  metric: z.string().min(1),
  source: z.string(),
  frequency: FrequencySchema,
  good: z.string(),
  bad: z.string(),
});

export const MonitoringPlanSchema = z.object({
  kpis: z.array(KPISchema).min(1),
  invalidation_triggers: z.array(z.string()).min(1),
  review_schedule_days: z.number().min(1),
});

// ============================================================================
// OPEN QUESTIONS
// ============================================================================

export const OpenQuestionSchema = z.object({
  question: z.string().min(1),
  why_it_matters: z.string(),
  how_to_answer: z.string(),
});

// ============================================================================
// AUDIT TRAIL
// ============================================================================

export const AuditTrailSchema = z.object({
  agents_run: z.array(z.string()),
  data_as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confidence_notes: z.string(),
});

// ============================================================================
// MAIN RESEARCH PACKET SCHEMA
// ============================================================================

export const ResearchPacketSchema = z.object({
  packet_id: z.string().uuid(),
  idea_id: z.string().uuid(),
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ticker: z.string().min(1).max(10),
  style_tag: StyleTagSchema,
  executive_view: ExecutiveViewSchema,
  modules: ModulesSchema,
  scenarios: ScenariosSchema,
  historical_parallels: z.array(HistoricalParallelSchema).min(1),
  pre_mortem: PreMortemSchema,
  monitoring_plan: MonitoringPlanSchema,
  open_questions: z.array(OpenQuestionSchema),
  audit_trail: AuditTrailSchema,
});

// ============================================================================
// PARTIAL SCHEMAS
// ============================================================================

export const ResearchPacketCreateSchema = ResearchPacketSchema.omit({
  packet_id: true,
}).extend({
  packet_id: z.string().uuid().optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Recommendation = z.infer<typeof RecommendationSchema>;
export type ValuationMethod = z.infer<typeof ValuationMethodSchema>;
export type ProbabilityLevel = z.infer<typeof ProbabilityLevelSchema>;

export type ExecutiveView = z.infer<typeof ExecutiveViewSchema>;
export type UnitEconomics = z.infer<typeof UnitEconomicsSchema>;
export type BusinessModule = z.infer<typeof BusinessModuleSchema>;
export type IndustryMoatModule = z.infer<typeof IndustryMoatModuleSchema>;
export type FinancialForensicsModule = z.infer<typeof FinancialForensicsModuleSchema>;
export type CapitalAllocationModule = z.infer<typeof CapitalAllocationModuleSchema>;
export type ManagementQualityModule = z.infer<typeof ManagementQualityModuleSchema>;
export type FairValueRange = z.infer<typeof FairValueRangeSchema>;
export type ValuationModule = z.infer<typeof ValuationModuleSchema>;
export type RiskItem = z.infer<typeof RiskItemSchema>;
export type RiskStressModule = z.infer<typeof RiskStressModuleSchema>;
export type Modules = z.infer<typeof ModulesSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type Scenarios = z.infer<typeof ScenariosSchema>;
export type HistoricalParallel = z.infer<typeof HistoricalParallelSchema>;
export type PreMortem = z.infer<typeof PreMortemSchema>;
export type KPI = z.infer<typeof KPISchema>;
export type MonitoringPlan = z.infer<typeof MonitoringPlanSchema>;
export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;
export type AuditTrail = z.infer<typeof AuditTrailSchema>;

export type ResearchPacket = z.infer<typeof ResearchPacketSchema>;
export type ResearchPacketCreate = z.infer<typeof ResearchPacketCreateSchema>;
