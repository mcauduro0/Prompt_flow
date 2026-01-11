/**
 * ARC Investment Factory - ResearchPacket Completion Criteria
 * 
 * IC-GRADE MANDATORY SECTIONS (from Operating Parameters):
 * 
 * 1. All 7 research modules completed
 * 2. Bull/Base/Bear scenarios with probabilities summing to 1.0
 * 3. Decision brief with verdict and conviction
 * 4. Variant perception statement (non-trivial)
 * 5. Historical parallels (at least 2) with base rate implications and key differences
 * 6. Pre-mortem with early warnings (at least 3)
 * 7. Monitoring plan with KPIs (at least 5) and invalidation triggers (at least 3)
 * 8. Evidence grounding spot check flag
 * 
 * A packet CANNOT appear in the weekly IC bundle unless ALL above are satisfied.
 */

import { z } from 'zod';

// ============================================================================
// IC-GRADE MANDATORY SECTION SCHEMAS
// ============================================================================

/**
 * Variant Perception Schema (MANDATORY)
 * Must be non-trivial - cannot agree with consensus
 */
export const VariantPerceptionSchema = z.object({
  consensus_view: z.string().min(20, 'Consensus view must be at least 20 characters'),
  our_view: z.string().min(20, 'Our view must be at least 20 characters'),
  why_we_differ: z.string().min(30, 'Why we differ must be at least 30 characters'),
  evidence_supporting_variant: z.array(z.string()).min(2, 'Need at least 2 pieces of evidence'),
  what_would_change_our_mind: z.string().min(20, 'What would change our mind must be at least 20 characters'),
});

export type VariantPerception = z.infer<typeof VariantPerceptionSchema>;

/**
 * Historical Parallel Schema (MANDATORY: at least 2)
 * Each must have base_rate_implication and key_differences
 */
export const HistoricalParallelSchema = z.object({
  company_or_situation: z.string().min(1),
  time_period: z.string().min(1),
  similarity_description: z.string().min(20),
  base_rate_implication: z.string().min(20, 'Base rate implication is MANDATORY'),
  key_differences: z.array(z.string()).min(1, 'Key differences are MANDATORY'),
  outcome: z.string().min(10),
  relevance_score: z.number().min(0).max(1).optional(),
});

export type HistoricalParallel = z.infer<typeof HistoricalParallelSchema>;

/**
 * Pre-Mortem Schema (MANDATORY)
 * Must have at least 3 early warnings
 */
export const PreMortemSchema = z.object({
  failure_scenario: z.string().min(20, 'Failure scenario must be at least 20 characters'),
  root_causes: z.array(z.string()).min(1, 'Need at least 1 root cause'),
  early_warnings: z.array(z.string()).min(3, 'MANDATORY: Need at least 3 early warnings'),
  probability_estimate: z.number().min(0).max(1),
  timeline_to_failure: z.string().optional(),
});

export type PreMortem = z.infer<typeof PreMortemSchema>;

/**
 * KPI Schema for Monitoring Plan
 */
export const KPISchema = z.object({
  name: z.string().min(1),
  current_value: z.union([z.string(), z.number()]),
  target_value: z.union([z.string(), z.number()]),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  source: z.string().min(1),
  alert_threshold: z.union([z.string(), z.number()]).optional(),
});

/**
 * Invalidation Trigger Schema
 */
export const InvalidationTriggerSchema = z.object({
  trigger: z.string().min(10, 'Trigger description must be at least 10 characters'),
  action: z.string().min(10, 'Action must be at least 10 characters'),
  severity: z.enum(['exit_immediately', 'reduce_position', 'review_thesis']).optional(),
});

/**
 * Monitoring Plan Schema (MANDATORY)
 * Must have at least 5 KPIs and 3 invalidation triggers
 */
export const MonitoringPlanSchema = z.object({
  kpis: z.array(KPISchema).min(5, 'MANDATORY: Need at least 5 KPIs'),
  signposts: z.array(
    z.object({
      description: z.string().min(10),
      bullish_signal: z.string().min(10),
      bearish_signal: z.string().min(10),
    })
  ).min(2, 'Need at least 2 signposts'),
  invalidation_triggers: z.array(InvalidationTriggerSchema).min(3, 'MANDATORY: Need at least 3 invalidation triggers'),
  review_schedule: z.object({
    frequency: z.enum(['weekly', 'bi-weekly', 'monthly']),
    next_review_date: z.string(),
    key_questions: z.array(z.string()).min(3, 'Need at least 3 key questions'),
  }),
});

export type MonitoringPlan = z.infer<typeof MonitoringPlanSchema>;

/**
 * Bull/Base/Bear Scenario Schema
 */
export const ScenarioSchema = z.object({
  probability: z.number().min(0).max(1),
  target_price: z.number().positive(),
  description: z.string().min(20),
  key_assumptions: z.array(z.string()).min(2),
  timeline: z.string().min(5),
});

export const BullBaseBearSchema = z.object({
  bull: ScenarioSchema,
  base: ScenarioSchema,
  bear: ScenarioSchema,
}).refine(
  (data) => {
    const sum = data.bull.probability + data.base.probability + data.bear.probability;
    return Math.abs(sum - 1.0) < 0.01;
  },
  { message: 'Bull + Base + Bear probabilities must sum to 1.0' }
);

export type BullBaseBear = z.infer<typeof BullBaseBearSchema>;

/**
 * Decision Brief Schema
 */
export const DecisionBriefSchema = z.object({
  verdict: z.enum(['strong_buy', 'buy', 'hold', 'sell', 'strong_sell']),
  conviction: z.number().min(1).max(5),
  thesis_summary: z.string().min(50),
  expected_return: z.number(),
  time_horizon: z.string().min(5),
  position_sizing_recommendation: z.string().min(10),
});

export type DecisionBrief = z.infer<typeof DecisionBriefSchema>;

/**
 * Evidence Grounding Check Schema
 */
export const EvidenceGroundingCheckSchema = z.object({
  total_claims: z.number().min(0),
  grounded_claims: z.number().min(0),
  grounding_rate: z.number().min(0).max(1),
  spot_check_passed: z.boolean(),
  spot_check_details: z.array(
    z.object({
      claim: z.string(),
      source_locator: z.string().optional(),
      verified: z.boolean(),
    })
  ),
});

export type EvidenceGroundingCheck = z.infer<typeof EvidenceGroundingCheckSchema>;

// ============================================================================
// MODULE COMPLETION SCHEMAS (existing)
// ============================================================================

export const BusinessModelCompletionSchema = z.object({
  revenue_model: z.object({
    description: z.string().min(100),
    revenue_streams: z.array(z.object({
      name: z.string(),
      percentage: z.number().min(0).max(100),
      growth_rate: z.number(),
      recurring: z.boolean(),
    })).min(1),
    pricing_power: z.enum(['strong', 'moderate', 'weak']),
  }),
  cost_structure: z.object({
    fixed_vs_variable: z.number().min(0).max(100),
    operating_leverage: z.enum(['high', 'moderate', 'low']),
    key_cost_drivers: z.array(z.string()).min(2),
    margin_trajectory: z.enum(['expanding', 'stable', 'contracting']),
  }),
  unit_economics: z.object({
    ltv: z.number().nullable(),
    cac: z.number().nullable(),
    ltv_cac_ratio: z.number().nullable(),
    payback_period_months: z.number().nullable(),
    gross_margin_per_unit: z.number().nullable(),
    contribution_margin: z.number().nullable(),
  }),
  competitive_position: z.object({
    market_share: z.number().min(0).max(100).nullable(),
    market_share_trend: z.enum(['gaining', 'stable', 'losing']).nullable(),
    relative_position: z.enum(['leader', 'challenger', 'follower', 'niche']),
    sustainable_advantages: z.array(z.string()).min(1),
  }),
});

export const IndustryMoatCompletionSchema = z.object({
  industry_structure: z.object({
    market_size_usd: z.number(),
    growth_rate_5y: z.number(),
    concentration: z.enum(['fragmented', 'moderate', 'concentrated', 'oligopoly']),
    barriers_to_entry: z.enum(['high', 'moderate', 'low']),
    buyer_power: z.enum(['high', 'moderate', 'low']),
    supplier_power: z.enum(['high', 'moderate', 'low']),
  }),
  moat_sources: z.array(z.object({
    type: z.enum(['network_effects', 'switching_costs', 'cost_advantages', 'intangible_assets', 'efficient_scale']),
    strength: z.enum(['wide', 'narrow', 'none']),
    evidence: z.string().min(50),
    durability_years: z.number().min(0).max(30),
  })).min(1),
  moat_durability: z.object({
    overall_rating: z.enum(['wide', 'narrow', 'none']),
    trend: z.enum(['strengthening', 'stable', 'weakening']),
    key_threats: z.array(z.string()).min(1),
    confidence: z.number().min(0).max(100),
  }),
  competitive_threats: z.array(z.object({
    threat: z.string(),
    severity: z.enum(['high', 'moderate', 'low']),
    timeline: z.enum(['near_term', 'medium_term', 'long_term']),
    mitigation: z.string(),
  })).min(1),
});

export const FinancialForensicsCompletionSchema = z.object({
  earnings_quality: z.object({
    score: z.number().min(0).max(100),
    accrual_ratio: z.number(),
    cash_earnings_ratio: z.number(),
    revenue_recognition_concerns: z.boolean(),
    one_time_items_impact: z.number(),
    assessment: z.enum(['high', 'moderate', 'low']),
  }),
  accruals_analysis: z.object({
    total_accruals_to_assets: z.number(),
    discretionary_accruals: z.number(),
    trend_3y: z.enum(['improving', 'stable', 'deteriorating']),
    flags: z.array(z.string()),
  }),
  cash_conversion: z.object({
    fcf_to_net_income: z.number(),
    operating_cash_flow_to_ebitda: z.number(),
    working_capital_trend: z.enum(['improving', 'stable', 'deteriorating']),
    capex_to_depreciation: z.number(),
  }),
  red_flags: z.array(z.object({
    flag: z.string(),
    severity: z.enum(['critical', 'warning', 'minor']),
    evidence: z.string(),
    recommendation: z.string(),
  })),
});

export const CapitalAllocationCompletionSchema = z.object({
  reinvestment_rate: z.object({
    current: z.number(),
    historical_avg_5y: z.number(),
    trend: z.enum(['increasing', 'stable', 'decreasing']),
    quality_assessment: z.enum(['high', 'moderate', 'low']),
  }),
  roic_trend: z.object({
    current: z.number(),
    historical_5y: z.array(z.number()).min(3),
    vs_wacc_spread: z.number(),
    trend: z.enum(['improving', 'stable', 'declining']),
    sustainability: z.enum(['high', 'moderate', 'low']),
  }),
  capital_priorities: z.array(z.object({
    priority: z.enum(['organic_growth', 'ma', 'dividends', 'buybacks', 'debt_reduction']),
    allocation_pct: z.number().min(0).max(100),
    historical_returns: z.enum(['excellent', 'good', 'poor', 'unknown']),
    assessment: z.string(),
  })).min(2),
  shareholder_returns: z.object({
    dividend_yield: z.number(),
    dividend_growth_5y: z.number(),
    payout_ratio: z.number(),
    buyback_yield: z.number(),
    total_yield: z.number(),
    sustainability: z.enum(['high', 'moderate', 'low']),
  }),
});

export const ManagementQualityCompletionSchema = z.object({
  track_record: z.object({
    tenure_years: z.number(),
    prior_experience: z.string(),
    key_achievements: z.array(z.string()).min(1),
    key_failures: z.array(z.string()),
    overall_rating: z.enum(['excellent', 'good', 'average', 'poor']),
  }),
  incentive_alignment: z.object({
    ownership_pct: z.number().min(0).max(100),
    compensation_structure: z.object({
      base_salary_pct: z.number(),
      annual_bonus_pct: z.number(),
      equity_pct: z.number(),
    }),
    performance_metrics: z.array(z.string()).min(1),
    alignment_rating: z.enum(['strong', 'moderate', 'weak']),
  }),
  capital_allocation_skill: z.object({
    ma_track_record: z.enum(['excellent', 'good', 'mixed', 'poor', 'na']),
    organic_investment_returns: z.enum(['excellent', 'good', 'mixed', 'poor']),
    capital_discipline: z.enum(['high', 'moderate', 'low']),
    overall_rating: z.enum(['excellent', 'good', 'average', 'poor']),
  }),
  communication_quality: z.object({
    transparency: z.enum(['high', 'moderate', 'low']),
    guidance_accuracy: z.enum(['high', 'moderate', 'low']),
    consistency: z.enum(['high', 'moderate', 'low']),
    overall_rating: z.enum(['excellent', 'good', 'average', 'poor']),
  }),
});

export const ValuationCompletionSchema = z.object({
  primary_method: z.object({
    method: z.enum(['dcf', 'comps', 'sum_of_parts', 'asset_based', 'lbo']),
    fair_value: z.number(),
    upside_pct: z.number(),
    confidence: z.enum(['high', 'moderate', 'low']),
    key_drivers: z.array(z.string()).min(2),
  }),
  secondary_method: z.object({
    method: z.enum(['dcf', 'comps', 'sum_of_parts', 'asset_based', 'lbo']),
    fair_value: z.number(),
    upside_pct: z.number(),
    notes: z.string(),
  }),
  key_assumptions: z.array(z.object({
    assumption: z.string(),
    value: z.string(),
    sensitivity: z.enum(['high', 'moderate', 'low']),
    rationale: z.string(),
  })).min(3),
  sensitivity_analysis: z.object({
    bull_case: z.object({
      fair_value: z.number(),
      upside_pct: z.number(),
      key_assumptions: z.array(z.string()).min(2),
    }),
    base_case: z.object({
      fair_value: z.number(),
      upside_pct: z.number(),
    }),
    bear_case: z.object({
      fair_value: z.number(),
      upside_pct: z.number(),
      key_assumptions: z.array(z.string()).min(2),
    }),
  }),
});

export const RiskStressCompletionSchema = z.object({
  key_risks: z.array(z.object({
    risk: z.string(),
    category: z.enum(['business', 'financial', 'regulatory', 'macro', 'competitive']),
    probability: z.enum(['high', 'moderate', 'low']),
    impact: z.enum(['severe', 'moderate', 'minor']),
    mitigation: z.string(),
    monitoring: z.string(),
  })).min(3),
  stress_scenarios: z.array(z.object({
    scenario: z.string(),
    trigger: z.string(),
    probability_pct: z.number().min(0).max(100),
    impact_on_thesis: z.string(),
    downside_pct: z.number(),
    action_plan: z.string(),
  })).min(2),
  downside_protection: z.object({
    asset_coverage: z.number(),
    debt_capacity: z.number(),
    liquidity_runway_months: z.number(),
    margin_of_safety: z.number(),
    floor_valuation: z.number(),
    floor_methodology: z.string(),
  }),
  risk_reward_ratio: z.object({
    upside_pct: z.number(),
    downside_pct: z.number(),
    ratio: z.number(),
    expected_value: z.number(),
    assessment: z.enum(['attractive', 'neutral', 'unattractive']),
  }),
});

// ============================================================================
// REQUIRED MODULES (LOCKED)
// ============================================================================

export const REQUIRED_MODULES = [
  'business_model',
  'industry_moat',
  'financial_forensics',
  'capital_allocation',
  'management_quality',
  'valuation',
  'risk_stress',
] as const;

// ============================================================================
// COMPLETION CHECKER TYPES
// ============================================================================

export interface ModuleCompletionResult {
  module: string;
  isComplete: boolean;
  missingFields: string[];
  errors: string[];
}

export interface ICGradeCompletionResult {
  is_complete: boolean;
  can_include_in_ic_bundle: boolean;
  missing_sections: string[];
  warnings: string[];
  details: Record<string, { passed: boolean; message: string }>;
  module_results: ModuleCompletionResult[];
  overall_score: number;
}

// ============================================================================
// MODULE COMPLETION CHECKER
// ============================================================================

export function checkModuleCompletion(
  module: string,
  data: unknown
): ModuleCompletionResult {
  const result: ModuleCompletionResult = {
    module,
    isComplete: false,
    missingFields: [],
    errors: [],
  };

  if (!data) {
    result.errors.push('Module data is null or undefined');
    return result;
  }

  let schema: z.ZodSchema;
  switch (module) {
    case 'business_model':
      schema = BusinessModelCompletionSchema;
      break;
    case 'industry_moat':
      schema = IndustryMoatCompletionSchema;
      break;
    case 'financial_forensics':
      schema = FinancialForensicsCompletionSchema;
      break;
    case 'capital_allocation':
      schema = CapitalAllocationCompletionSchema;
      break;
    case 'management_quality':
      schema = ManagementQualityCompletionSchema;
      break;
    case 'valuation':
      schema = ValuationCompletionSchema;
      break;
    case 'risk_stress':
      schema = RiskStressCompletionSchema;
      break;
    default:
      result.errors.push(`Unknown module: ${module}`);
      return result;
  }

  const parseResult = schema.safeParse(data);
  
  if (parseResult.success) {
    result.isComplete = true;
  } else {
    result.isComplete = false;
    for (const issue of parseResult.error.issues) {
      const path = issue.path.join('.');
      result.missingFields.push(path);
      result.errors.push(`${path}: ${issue.message}`);
    }
  }

  return result;
}

// ============================================================================
// IC-GRADE PACKET COMPLETION CHECKER
// ============================================================================

/**
 * Check if a ResearchPacket meets IC-grade completion requirements
 * 
 * A packet is COMPLETE only when ALL of the following are satisfied:
 * 1. All 7 research modules completed
 * 2. Bull/Base/Bear scenarios with probabilities summing to 1.0
 * 3. Decision brief with verdict and conviction
 * 4. Variant perception statement (non-trivial)
 * 5. Historical parallels (at least 2) with base rate implications
 * 6. Pre-mortem with early warnings (at least 3)
 * 7. Monitoring plan with KPIs (at least 5) and invalidation triggers (at least 3)
 * 8. Evidence grounding spot check passed
 */
export function checkPacketCompletion(packet: {
  modules: Record<string, unknown>;
  bull_base_bear?: unknown;
  decision_brief?: unknown;
  variant_perception?: unknown;
  historical_parallels?: unknown[];
  pre_mortem?: unknown;
  monitoring_plan?: unknown;
  evidence_grounding_check?: unknown;
  evidence?: unknown[];
}): ICGradeCompletionResult {
  const missing_sections: string[] = [];
  const warnings: string[] = [];
  const details: Record<string, { passed: boolean; message: string }> = {};
  const module_results: ModuleCompletionResult[] = [];

  // -------------------------------------------------------------------------
  // 1. All 7 research modules completed
  // -------------------------------------------------------------------------
  const completedModules: string[] = [];
  const incompleteModules: string[] = [];

  for (const module of REQUIRED_MODULES) {
    const moduleData = packet.modules?.[module];
    const result = checkModuleCompletion(module, moduleData);
    module_results.push(result);

    if (result.isComplete) {
      completedModules.push(module);
    } else {
      incompleteModules.push(module);
    }
  }

  if (incompleteModules.length === 0) {
    details['modules'] = { passed: true, message: 'All 7 modules completed' };
  } else {
    details['modules'] = { passed: false, message: `Missing modules: ${incompleteModules.join(', ')}` };
    missing_sections.push(`Research modules: ${incompleteModules.join(', ')}`);
  }

  // -------------------------------------------------------------------------
  // 2. Bull/Base/Bear scenarios with probabilities summing to 1.0
  // -------------------------------------------------------------------------
  if (packet.bull_base_bear) {
    const result = BullBaseBearSchema.safeParse(packet.bull_base_bear);
    if (result.success) {
      details['bull_base_bear'] = { passed: true, message: 'Valid scenarios with correct probabilities' };
    } else {
      details['bull_base_bear'] = { passed: false, message: result.error.issues[0]?.message || 'Invalid' };
      missing_sections.push('Bull/Base/Bear scenarios (invalid or probabilities do not sum to 1.0)');
    }
  } else {
    details['bull_base_bear'] = { passed: false, message: 'Missing Bull/Base/Bear scenarios' };
    missing_sections.push('Bull/Base/Bear scenarios');
  }

  // -------------------------------------------------------------------------
  // 3. Decision brief with verdict and conviction
  // -------------------------------------------------------------------------
  if (packet.decision_brief) {
    const result = DecisionBriefSchema.safeParse(packet.decision_brief);
    if (result.success) {
      details['decision_brief'] = { passed: true, message: 'Valid decision brief' };
    } else {
      details['decision_brief'] = { passed: false, message: result.error.issues[0]?.message || 'Invalid' };
      missing_sections.push('Decision brief (invalid format)');
    }
  } else {
    details['decision_brief'] = { passed: false, message: 'Missing decision brief' };
    missing_sections.push('Decision brief');
  }

  // -------------------------------------------------------------------------
  // 4. Variant perception statement (non-trivial)
  // -------------------------------------------------------------------------
  if (packet.variant_perception) {
    const result = VariantPerceptionSchema.safeParse(packet.variant_perception);
    if (result.success) {
      const vp = packet.variant_perception as VariantPerception;
      // Check non-triviality
      if (vp.why_we_differ.length >= 30 && !vp.why_we_differ.toLowerCase().includes('we agree')) {
        details['variant_perception'] = { passed: true, message: 'Valid and non-trivial variant perception' };
      } else {
        details['variant_perception'] = { passed: false, message: 'Variant perception is trivial or agrees with consensus' };
        missing_sections.push('Variant perception (trivial)');
      }
    } else {
      details['variant_perception'] = { passed: false, message: result.error.issues[0]?.message || 'Invalid' };
      missing_sections.push('Variant perception (invalid format)');
    }
  } else {
    details['variant_perception'] = { passed: false, message: 'Missing variant perception' };
    missing_sections.push('Variant perception');
  }

  // -------------------------------------------------------------------------
  // 5. Historical parallels (at least 2) with base rate implications
  // -------------------------------------------------------------------------
  if (packet.historical_parallels && Array.isArray(packet.historical_parallels)) {
    const validParallels = packet.historical_parallels.filter((p) => {
      const result = HistoricalParallelSchema.safeParse(p);
      return result.success;
    });
    if (validParallels.length >= 2) {
      details['historical_parallels'] = { passed: true, message: `${validParallels.length} valid historical parallels with base rate implications` };
    } else {
      details['historical_parallels'] = { passed: false, message: `Only ${validParallels.length} valid parallels (need 2+ with base rate implications)` };
      missing_sections.push('Historical parallels (need at least 2 with base rate implications and key differences)');
    }
  } else {
    details['historical_parallels'] = { passed: false, message: 'Missing historical parallels' };
    missing_sections.push('Historical parallels (need at least 2)');
  }

  // -------------------------------------------------------------------------
  // 6. Pre-mortem with early warnings (at least 3)
  // -------------------------------------------------------------------------
  if (packet.pre_mortem) {
    const result = PreMortemSchema.safeParse(packet.pre_mortem);
    if (result.success) {
      const pm = packet.pre_mortem as PreMortem;
      if (pm.early_warnings.length >= 3) {
        details['pre_mortem'] = { passed: true, message: `Pre-mortem with ${pm.early_warnings.length} early warnings` };
      } else {
        details['pre_mortem'] = { passed: false, message: `Only ${pm.early_warnings.length} early warnings (need 3+)` };
        missing_sections.push('Pre-mortem (need at least 3 early warnings)');
      }
    } else {
      details['pre_mortem'] = { passed: false, message: result.error.issues[0]?.message || 'Invalid' };
      missing_sections.push('Pre-mortem (invalid format)');
    }
  } else {
    details['pre_mortem'] = { passed: false, message: 'Missing pre-mortem' };
    missing_sections.push('Pre-mortem');
  }

  // -------------------------------------------------------------------------
  // 7. Monitoring plan with KPIs (5+) and invalidation triggers (3+)
  // -------------------------------------------------------------------------
  if (packet.monitoring_plan) {
    const result = MonitoringPlanSchema.safeParse(packet.monitoring_plan);
    if (result.success) {
      const mp = packet.monitoring_plan as MonitoringPlan;
      const kpiCount = mp.kpis.length;
      const triggerCount = mp.invalidation_triggers.length;
      if (kpiCount >= 5 && triggerCount >= 3) {
        details['monitoring_plan'] = { passed: true, message: `${kpiCount} KPIs, ${triggerCount} invalidation triggers` };
      } else {
        details['monitoring_plan'] = { passed: false, message: `KPIs: ${kpiCount}/5, Triggers: ${triggerCount}/3` };
        if (kpiCount < 5) missing_sections.push('Monitoring plan (need at least 5 KPIs)');
        if (triggerCount < 3) missing_sections.push('Monitoring plan (need at least 3 invalidation triggers)');
      }
    } else {
      details['monitoring_plan'] = { passed: false, message: result.error.issues[0]?.message || 'Invalid' };
      missing_sections.push('Monitoring plan (invalid format)');
    }
  } else {
    details['monitoring_plan'] = { passed: false, message: 'Missing monitoring plan' };
    missing_sections.push('Monitoring plan');
  }

  // -------------------------------------------------------------------------
  // 8. Evidence grounding spot check
  // -------------------------------------------------------------------------
  if (packet.evidence_grounding_check) {
    const result = EvidenceGroundingCheckSchema.safeParse(packet.evidence_grounding_check);
    if (result.success) {
      const egc = packet.evidence_grounding_check as EvidenceGroundingCheck;
      if (egc.spot_check_passed && egc.grounding_rate >= 0.9) {
        details['evidence_grounding'] = { passed: true, message: `Grounding rate: ${(egc.grounding_rate * 100).toFixed(0)}%` };
      } else {
        details['evidence_grounding'] = { passed: false, message: `Grounding rate: ${(egc.grounding_rate * 100).toFixed(0)}% (need 90%+)` };
        warnings.push('Evidence grounding spot check failed - review source citations');
      }
    } else {
      details['evidence_grounding'] = { passed: false, message: 'Invalid evidence grounding check' };
      warnings.push('Evidence grounding check format invalid');
    }
  } else {
    details['evidence_grounding'] = { passed: false, message: 'Evidence grounding check not performed' };
    warnings.push('Evidence grounding check not performed');
  }

  // -------------------------------------------------------------------------
  // Calculate overall score
  // -------------------------------------------------------------------------
  const moduleScore = (completedModules.length / REQUIRED_MODULES.length) * 40;
  const icGradeSections = [
    'bull_base_bear',
    'decision_brief',
    'variant_perception',
    'historical_parallels',
    'pre_mortem',
    'monitoring_plan',
    'evidence_grounding',
  ];
  const passedSections = icGradeSections.filter((s) => details[s]?.passed).length;
  const sectionScore = (passedSections / icGradeSections.length) * 60;
  const overall_score = Math.round(moduleScore + sectionScore);

  // -------------------------------------------------------------------------
  // Final result
  // -------------------------------------------------------------------------
  const is_complete = missing_sections.length === 0;
  const can_include_in_ic_bundle = is_complete && details['evidence_grounding']?.passed !== false;

  return {
    is_complete,
    can_include_in_ic_bundle,
    missing_sections,
    warnings,
    details,
    module_results,
    overall_score,
  };
}

/**
 * Validate that a packet can be included in IC Bundle
 */
export function canIncludeInICBundle(packet: Parameters<typeof checkPacketCompletion>[0]): {
  eligible: boolean;
  reason?: string;
} {
  const completion = checkPacketCompletion(packet);

  if (!completion.can_include_in_ic_bundle) {
    return {
      eligible: false,
      reason: completion.missing_sections.length > 0
        ? `Incomplete: ${completion.missing_sections.join(', ')}`
        : 'Evidence grounding check failed',
    };
  }

  return { eligible: true };
}

/**
 * Get human-readable completion summary
 */
export function getCompletionSummary(result: ICGradeCompletionResult): string {
  const lines: string[] = [];
  
  lines.push(`ResearchPacket IC-Grade Completion: ${result.overall_score}%`);
  lines.push(`Status: ${result.is_complete ? 'COMPLETE' : 'INCOMPLETE'}`);
  lines.push(`IC Bundle Eligible: ${result.can_include_in_ic_bundle ? 'YES' : 'NO'}`);
  lines.push('');
  
  lines.push('Module Status:');
  for (const moduleResult of result.module_results) {
    const status = moduleResult.isComplete ? '✓' : '✗';
    lines.push(`  ${status} ${moduleResult.module}`);
  }
  
  lines.push('');
  lines.push('IC-Grade Sections:');
  for (const [section, detail] of Object.entries(result.details)) {
    if (section !== 'modules') {
      const status = detail.passed ? '✓' : '✗';
      lines.push(`  ${status} ${section}: ${detail.message}`);
    }
  }
  
  if (result.missing_sections.length > 0) {
    lines.push('');
    lines.push('Missing Sections:');
    for (const section of result.missing_sections) {
      lines.push(`  - ${section}`);
    }
  }
  
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`  ⚠ ${warning}`);
    }
  }
  
  return lines.join('\n');
}

export default {
  REQUIRED_MODULES,
  checkPacketCompletion,
  canIncludeInICBundle,
  getCompletionSummary,
  checkModuleCompletion,
  // Schema exports
  VariantPerceptionSchema,
  HistoricalParallelSchema,
  PreMortemSchema,
  MonitoringPlanSchema,
  BullBaseBearSchema,
  DecisionBriefSchema,
  EvidenceGroundingCheckSchema,
};
