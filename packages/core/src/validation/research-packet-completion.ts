/**
 * ARC Investment Factory - ResearchPacket Completion Criteria
 * 
 * Per Operating Parameters, a ResearchPacket is COMPLETE only when:
 * 1. All 7 research modules have been executed
 * 2. Each module meets its mandatory field requirements
 * 3. The decision brief has been generated
 * 4. All evidence is properly linked
 * 
 * MANDATORY FIELDS PER MODULE:
 * - business_model: revenue_model, cost_structure, unit_economics, competitive_position
 * - industry_moat: industry_structure, moat_sources, moat_durability, competitive_threats
 * - financial_forensics: earnings_quality, accruals_analysis, cash_conversion, red_flags
 * - capital_allocation: reinvestment_rate, roic_trend, capital_priorities, shareholder_returns
 * - management_quality: track_record, incentive_alignment, capital_allocation_skill, communication_quality
 * - valuation: primary_method, secondary_method, key_assumptions, sensitivity_analysis
 * - risk_stress: key_risks, stress_scenarios, downside_protection, risk_reward_ratio
 */

import { z } from 'zod';

// ============================================================================
// MODULE COMPLETION SCHEMAS
// ============================================================================

/**
 * Business Model Module - Mandatory Fields
 */
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
    fixed_vs_variable: z.number().min(0).max(100), // % fixed
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

/**
 * Industry & Moat Module - Mandatory Fields
 */
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
    type: z.enum([
      'network_effects',
      'switching_costs',
      'cost_advantages',
      'intangible_assets',
      'efficient_scale',
    ]),
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

/**
 * Financial Forensics Module - Mandatory Fields
 */
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

/**
 * Capital Allocation Module - Mandatory Fields
 */
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

/**
 * Management Quality Module - Mandatory Fields
 */
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

/**
 * Valuation Module - Mandatory Fields
 */
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

/**
 * Risk & Stress Module - Mandatory Fields
 */
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
// COMPLETION CHECKER
// ============================================================================

export interface ModuleCompletionResult {
  module: string;
  isComplete: boolean;
  missingFields: string[];
  errors: string[];
}

export interface PacketCompletionResult {
  isComplete: boolean;
  completedModules: string[];
  incompleteModules: string[];
  moduleResults: ModuleCompletionResult[];
  hasDecisionBrief: boolean;
  evidenceCount: number;
  overallScore: number; // 0-100
}

/**
 * Check if a research module is complete
 */
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

/**
 * Check if a ResearchPacket is complete
 */
export function checkPacketCompletion(packet: {
  modules: Record<string, unknown>;
  decisionBrief?: unknown;
  evidence?: unknown[];
}): PacketCompletionResult {
  const requiredModules = [
    'business_model',
    'industry_moat',
    'financial_forensics',
    'capital_allocation',
    'management_quality',
    'valuation',
    'risk_stress',
  ];

  const moduleResults: ModuleCompletionResult[] = [];
  const completedModules: string[] = [];
  const incompleteModules: string[] = [];

  for (const module of requiredModules) {
    const moduleData = packet.modules?.[module];
    const result = checkModuleCompletion(module, moduleData);
    moduleResults.push(result);

    if (result.isComplete) {
      completedModules.push(module);
    } else {
      incompleteModules.push(module);
    }
  }

  const hasDecisionBrief = !!packet.decisionBrief && 
    typeof packet.decisionBrief === 'object' &&
    Object.keys(packet.decisionBrief).length > 0;

  const evidenceCount = packet.evidence?.length ?? 0;

  // Calculate overall score
  const moduleScore = (completedModules.length / requiredModules.length) * 70;
  const briefScore = hasDecisionBrief ? 20 : 0;
  const evidenceScore = Math.min(evidenceCount / 10, 1) * 10;
  const overallScore = Math.round(moduleScore + briefScore + evidenceScore);

  const isComplete = 
    completedModules.length === requiredModules.length &&
    hasDecisionBrief &&
    evidenceCount >= 5;

  return {
    isComplete,
    completedModules,
    incompleteModules,
    moduleResults,
    hasDecisionBrief,
    evidenceCount,
    overallScore,
  };
}

/**
 * Get human-readable completion summary
 */
export function getCompletionSummary(result: PacketCompletionResult): string {
  const lines: string[] = [];
  
  lines.push(`ResearchPacket Completion: ${result.overallScore}%`);
  lines.push(`Status: ${result.isComplete ? 'COMPLETE' : 'INCOMPLETE'}`);
  lines.push('');
  lines.push('Module Status:');
  
  for (const moduleResult of result.moduleResults) {
    const status = moduleResult.isComplete ? '✓' : '✗';
    lines.push(`  ${status} ${moduleResult.module}`);
    if (!moduleResult.isComplete && moduleResult.missingFields.length > 0) {
      lines.push(`    Missing: ${moduleResult.missingFields.slice(0, 3).join(', ')}${moduleResult.missingFields.length > 3 ? '...' : ''}`);
    }
  }
  
  lines.push('');
  lines.push(`Decision Brief: ${result.hasDecisionBrief ? 'Present' : 'Missing'}`);
  lines.push(`Evidence Items: ${result.evidenceCount}`);
  
  return lines.join('\n');
}
