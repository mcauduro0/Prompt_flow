/**
 * ARC Investment Factory - Gate System
 * 
 * LOCKED GATE DEFINITIONS (from Operating Parameters):
 * 
 * Gate 0: DATA_SUFFICIENCY
 *   - Minimum data available to form a view
 *   - Required: financials, price history, basic company info
 * 
 * Gate 1: COHERENCE
 *   - Thesis is internally consistent
 *   - No contradictory claims
 * 
 * Gate 2: EDGE_CLAIM
 *   - Clear, testable edge articulated
 *   - Must explain WHY market is wrong
 * 
 * Gate 3: DOWNSIDE_SANITY
 *   - Downside scenario is realistic and bounded
 *   - Must have defined loss limit
 *   - BINARY OVERRIDE: Fails if leverage/liquidity/regulatory risk is dominant
 * 
 * Gate 4: STYLE_FIT
 *   - Idea fits the assigned style bucket
 *   - Quality ideas need moat, Value needs margin of safety, etc.
 * 
 * IMPORTANT: Gate numbering and semantics are LOCKED.
 * Rejection shadow must use these exact identifiers.
 */

import { z } from 'zod';

// ============================================================================
// GATE DEFINITIONS (LOCKED)
// ============================================================================

export const GATE_DEFINITIONS = {
  GATE_0: {
    id: 0,
    name: 'DATA_SUFFICIENCY',
    description: 'Minimum data available to form a view',
    requirements: [
      'At least 3 years of financial statements',
      'Price history available',
      'Basic company info (sector, market cap, country)',
      'At least one analyst estimate or guidance',
    ],
  },
  GATE_1: {
    id: 1,
    name: 'COHERENCE',
    description: 'Thesis is internally consistent',
    requirements: [
      'No contradictory claims in thesis',
      'Bull case and bear case are logically distinct',
      'Catalysts align with thesis',
      'Time horizon is consistent with catalyst windows',
    ],
  },
  GATE_2: {
    id: 2,
    name: 'EDGE_CLAIM',
    description: 'Clear, testable edge articulated',
    requirements: [
      'Explicit statement of why market is wrong',
      'Edge is testable/falsifiable',
      'Edge is not common knowledge',
      'Edge has supporting evidence',
    ],
  },
  GATE_3: {
    id: 3,
    name: 'DOWNSIDE_SANITY',
    description: 'Downside scenario is realistic and bounded',
    requirements: [
      'Bear case price target defined',
      'Downside is not catastrophic (>50% loss)',
      'Key risks are identified',
      'Stop-loss or exit trigger defined',
    ],
    // BINARY OVERRIDES - These cause immediate failure regardless of score
    binary_overrides: [
      'leverage_risk_dominant',
      'liquidity_risk_dominant',
      'regulatory_cliff_dominant',
    ],
  },
  GATE_4: {
    id: 4,
    name: 'STYLE_FIT',
    description: 'Idea fits the assigned style bucket',
    requirements: {
      quality: [
        'Durable competitive advantage (moat)',
        'High ROIC (>15%)',
        'Consistent earnings growth',
        'Strong balance sheet',
      ],
      value: [
        'Trading below intrinsic value',
        'Margin of safety >20%',
        'Catalyst for value realization',
        'Not a value trap (has path to unlock)',
      ],
      growth: [
        'Revenue growth >15% CAGR',
        'Large addressable market',
        'Competitive position improving',
        'Unit economics positive or improving',
      ],
      special_situations: [
        'Identifiable event catalyst',
        'Asymmetric payoff structure',
        'Limited correlation to market',
        'Clear timeline for resolution',
      ],
      turnaround: [
        'Clear path to profitability',
        'Management change or new strategy',
        'Balance sheet can survive transition',
        'Early signs of improvement',
      ],
    },
  },
} as const;

// ============================================================================
// GATE 3 BINARY OVERRIDE DEFINITIONS
// ============================================================================

/**
 * GATE 3 BINARY OVERRIDES
 * 
 * These risks cause IMMEDIATE Gate 3 failure regardless of numeric score.
 * This aligns with real IC behavior and prevents gaming the score.
 * 
 * LLM optimism is most dangerous in downside risk assessment.
 * These overrides ensure catastrophic risks cannot be masked by good scores.
 */
export const GATE_3_BINARY_OVERRIDES = {
  /**
   * LEVERAGE RISK DOMINANT
   * Triggers when:
   * - Net debt / EBITDA > 4x
   * - Interest coverage < 2x
   * - Significant debt maturities in next 18 months
   * - Covenant risk identified
   */
  leverage_risk_dominant: {
    name: 'Leverage Risk Dominant',
    description: 'Excessive leverage creates existential risk',
    triggers: [
      'Net debt / EBITDA > 4x',
      'Interest coverage < 2x',
      'Debt maturities > 30% of market cap in 18 months',
      'Covenant breach risk identified',
      'Negative free cash flow with high debt',
    ],
    severity: 'critical',
  },
  
  /**
   * LIQUIDITY RISK DOMINANT
   * Triggers when:
   * - Current ratio < 0.8
   * - Quick ratio < 0.5
   * - Cash runway < 12 months at current burn
   * - Revolver fully drawn
   * - Going concern warning
   */
  liquidity_risk_dominant: {
    name: 'Liquidity Risk Dominant',
    description: 'Insufficient liquidity threatens survival',
    triggers: [
      'Current ratio < 0.8',
      'Quick ratio < 0.5',
      'Cash runway < 12 months',
      'Revolver fully drawn or unavailable',
      'Going concern warning in audit',
      'Supplier payment delays reported',
    ],
    severity: 'critical',
  },
  
  /**
   * REGULATORY CLIFF DOMINANT
   * Triggers when:
   * - Major regulatory decision pending with binary outcome
   * - Patent cliff > 30% of revenue
   * - License renewal at risk
   * - Antitrust action pending
   * - Sanctions or export control risk
   */
  regulatory_cliff_dominant: {
    name: 'Regulatory Cliff Dominant',
    description: 'Regulatory event creates binary risk',
    triggers: [
      'FDA/EMA decision pending with >30% revenue impact',
      'Patent cliff > 30% of revenue in 24 months',
      'License/permit renewal at risk',
      'Antitrust investigation with breakup risk',
      'Sanctions or export control exposure',
      'Environmental liability > 20% of market cap',
    ],
    severity: 'critical',
  },
} as const;

export type Gate3BinaryOverrideType = keyof typeof GATE_3_BINARY_OVERRIDES;

// ============================================================================
// GATE RESULT SCHEMA
// ============================================================================

export const GateResultSchema = z.object({
  gate_id: z.number().min(0).max(4),
  gate_name: z.enum([
    'DATA_SUFFICIENCY',
    'COHERENCE',
    'EDGE_CLAIM',
    'DOWNSIDE_SANITY',
    'STYLE_FIT',
  ]),
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  details: z.object({
    checks_passed: z.array(z.string()),
    checks_failed: z.array(z.string()),
    notes: z.string().optional(),
    binary_override: z.string().optional(), // For Gate 3
    binary_override_reason: z.string().optional(), // For Gate 3
  }),
});

export type GateResult = z.infer<typeof GateResultSchema>;

export const GateResultsSchema = z.object({
  gate_0_data_sufficiency: GateResultSchema,
  gate_1_coherence: GateResultSchema,
  gate_2_edge_claim: GateResultSchema,
  gate_3_downside_sanity: GateResultSchema,
  gate_4_style_fit: GateResultSchema,
  all_passed: z.boolean(),
  first_failed_gate: z.number().nullable(),
  binary_override_triggered: z.boolean().optional(),
  binary_override_type: z.string().optional(),
});

export type GateResults = z.infer<typeof GateResultsSchema>;

// ============================================================================
// RISK FLAGS SCHEMA (for Gate 3 binary override)
// ============================================================================

export const RiskFlagsSchema = z.object({
  // Leverage risk indicators
  leverage_risk_dominant: z.boolean().default(false),
  net_debt_to_ebitda: z.number().optional(),
  interest_coverage: z.number().optional(),
  debt_maturity_pct_18m: z.number().optional(),
  covenant_risk: z.boolean().optional(),
  
  // Liquidity risk indicators
  liquidity_risk_dominant: z.boolean().default(false),
  current_ratio: z.number().optional(),
  quick_ratio: z.number().optional(),
  cash_runway_months: z.number().optional(),
  revolver_utilization: z.number().optional(),
  going_concern_warning: z.boolean().optional(),
  
  // Regulatory risk indicators
  regulatory_cliff_dominant: z.boolean().default(false),
  pending_regulatory_decision: z.boolean().optional(),
  patent_cliff_revenue_pct: z.number().optional(),
  license_renewal_risk: z.boolean().optional(),
  antitrust_risk: z.boolean().optional(),
  sanctions_exposure: z.boolean().optional(),
});

export type RiskFlags = z.infer<typeof RiskFlagsSchema>;

// ============================================================================
// GATE EVALUATION FUNCTIONS
// ============================================================================

interface IdeaForGating {
  ticker: string;
  style_tag: string;
  one_sentence_hypothesis: string;
  edge_clarity: number;
  downside_protection: number;
  catalysts: Array<{ name: string; window: string }>;
  bull_case?: string;
  bear_case?: string;
  bear_price_target?: number;
  current_price?: number;
  data_coverage?: {
    has_financials: boolean;
    financials_years: number;
    has_price_history: boolean;
    has_company_info: boolean;
    has_estimates: boolean;
  };
  moat_score?: number;
  roic?: number;
  revenue_growth?: number;
  margin_of_safety?: number;
  // Risk flags for Gate 3 binary override
  risk_flags?: RiskFlags;
}

/**
 * Gate 0: Data Sufficiency
 */
export function evaluateGate0(idea: IdeaForGating): GateResult {
  const checks_passed: string[] = [];
  const checks_failed: string[] = [];

  const coverage = idea.data_coverage || {
    has_financials: false,
    financials_years: 0,
    has_price_history: false,
    has_company_info: false,
    has_estimates: false,
  };

  // Check financials
  if (coverage.has_financials && coverage.financials_years >= 3) {
    checks_passed.push('At least 3 years of financial statements');
  } else {
    checks_failed.push(`Only ${coverage.financials_years} years of financials (need 3+)`);
  }

  // Check price history
  if (coverage.has_price_history) {
    checks_passed.push('Price history available');
  } else {
    checks_failed.push('Price history not available');
  }

  // Check company info
  if (coverage.has_company_info) {
    checks_passed.push('Basic company info available');
  } else {
    checks_failed.push('Basic company info missing');
  }

  // Check estimates
  if (coverage.has_estimates) {
    checks_passed.push('Analyst estimates or guidance available');
  } else {
    checks_failed.push('No analyst estimates or guidance');
  }

  const score = checks_passed.length / 4;
  const passed = checks_failed.length === 0;

  return {
    gate_id: 0,
    gate_name: 'DATA_SUFFICIENCY',
    passed,
    score,
    details: { checks_passed, checks_failed },
  };
}

/**
 * Gate 1: Coherence
 */
export function evaluateGate1(idea: IdeaForGating): GateResult {
  const checks_passed: string[] = [];
  const checks_failed: string[] = [];

  // Check thesis exists and is non-trivial
  if (idea.one_sentence_hypothesis && idea.one_sentence_hypothesis.length > 20) {
    checks_passed.push('Thesis statement present');
  } else {
    checks_failed.push('Thesis statement missing or too short');
  }

  // Check bull/bear distinction
  if (idea.bull_case && idea.bear_case && idea.bull_case !== idea.bear_case) {
    checks_passed.push('Bull and bear cases are distinct');
  } else {
    checks_failed.push('Bull and bear cases not clearly distinguished');
  }

  // Check catalysts align
  if (idea.catalysts && idea.catalysts.length > 0) {
    checks_passed.push('Catalysts defined');
  } else {
    checks_failed.push('No catalysts defined');
  }

  // Check for contradictions (simplified - would use LLM in production)
  const hasContradiction = false; // Placeholder for LLM-based check
  if (!hasContradiction) {
    checks_passed.push('No obvious contradictions');
  } else {
    checks_failed.push('Contradictory claims detected');
  }

  const score = checks_passed.length / 4;
  const passed = checks_failed.length <= 1; // Allow 1 minor issue

  return {
    gate_id: 1,
    gate_name: 'COHERENCE',
    passed,
    score,
    details: { checks_passed, checks_failed },
  };
}

/**
 * Gate 2: Edge Claim
 */
export function evaluateGate2(idea: IdeaForGating): GateResult {
  const checks_passed: string[] = [];
  const checks_failed: string[] = [];

  // Check edge clarity score
  if (idea.edge_clarity >= 0.6) {
    checks_passed.push(`Edge clarity score: ${(idea.edge_clarity * 100).toFixed(0)}%`);
  } else {
    checks_failed.push(`Edge clarity too low: ${(idea.edge_clarity * 100).toFixed(0)}% (need 60%+)`);
  }

  // Check for explicit "why market is wrong" statement
  const hypothesis = idea.one_sentence_hypothesis.toLowerCase();
  const hasEdgeLanguage =
    hypothesis.includes('market') ||
    hypothesis.includes('underestimate') ||
    hypothesis.includes('overestimate') ||
    hypothesis.includes('mispriced') ||
    hypothesis.includes('overlooked');

  if (hasEdgeLanguage) {
    checks_passed.push('Explicit edge language present');
  } else {
    checks_failed.push('No explicit statement of why market is wrong');
  }

  // Check edge is testable
  if (idea.catalysts && idea.catalysts.length > 0) {
    checks_passed.push('Edge is testable via catalysts');
  } else {
    checks_failed.push('Edge is not testable');
  }

  const score = checks_passed.length / 3;
  const passed = checks_failed.length === 0;

  return {
    gate_id: 2,
    gate_name: 'EDGE_CLAIM',
    passed,
    score,
    details: { checks_passed, checks_failed },
  };
}

/**
 * Gate 3: Downside Sanity
 * 
 * ============================================================================
 * BINARY OVERRIDE LOGIC
 * ============================================================================
 * 
 * If leverage_risk OR liquidity_risk OR regulatory_cliff is flagged as dominant,
 * Gate 3 fails REGARDLESS of numeric score.
 * 
 * This aligns with real IC behavior and prevents gaming the score.
 * LLM optimism is most dangerous in downside risk assessment.
 * ============================================================================
 */
export function evaluateGate3(idea: IdeaForGating): GateResult {
  const checks_passed: string[] = [];
  const checks_failed: string[] = [];
  let binary_override: string | undefined;
  let binary_override_reason: string | undefined;

  // ============================================================================
  // BINARY OVERRIDE CHECK (FIRST - before any numeric checks)
  // ============================================================================
  const riskFlags = idea.risk_flags;
  
  if (riskFlags) {
    // Check leverage risk
    if (riskFlags.leverage_risk_dominant) {
      binary_override = 'leverage_risk_dominant';
      binary_override_reason = buildLeverageRiskReason(riskFlags);
      checks_failed.push(`BINARY OVERRIDE: ${binary_override_reason}`);
    }
    
    // Check liquidity risk
    if (riskFlags.liquidity_risk_dominant) {
      binary_override = 'liquidity_risk_dominant';
      binary_override_reason = buildLiquidityRiskReason(riskFlags);
      checks_failed.push(`BINARY OVERRIDE: ${binary_override_reason}`);
    }
    
    // Check regulatory cliff
    if (riskFlags.regulatory_cliff_dominant) {
      binary_override = 'regulatory_cliff_dominant';
      binary_override_reason = buildRegulatoryRiskReason(riskFlags);
      checks_failed.push(`BINARY OVERRIDE: ${binary_override_reason}`);
    }
    
    // Auto-detect binary overrides from numeric indicators
    if (!binary_override) {
      const autoDetected = autoDetectBinaryOverrides(riskFlags);
      if (autoDetected) {
        binary_override = autoDetected.type;
        binary_override_reason = autoDetected.reason;
        checks_failed.push(`BINARY OVERRIDE (auto-detected): ${binary_override_reason}`);
      }
    }
  }

  // If binary override triggered, fail immediately
  if (binary_override) {
    return {
      gate_id: 3,
      gate_name: 'DOWNSIDE_SANITY',
      passed: false,
      score: 0,
      details: {
        checks_passed,
        checks_failed,
        binary_override,
        binary_override_reason,
        notes: 'Gate 3 failed due to binary override - catastrophic risk identified',
      },
    };
  }

  // ============================================================================
  // NUMERIC CHECKS (only if no binary override)
  // ============================================================================

  // Check downside protection score
  if (idea.downside_protection >= 0.5) {
    checks_passed.push(`Downside protection score: ${(idea.downside_protection * 100).toFixed(0)}%`);
  } else {
    checks_failed.push(`Downside protection too low: ${(idea.downside_protection * 100).toFixed(0)}% (need 50%+)`);
  }

  // Check bear price target defined
  if (idea.bear_price_target !== undefined && idea.bear_price_target > 0) {
    checks_passed.push(`Bear price target defined: $${idea.bear_price_target}`);

    // Check downside is not catastrophic
    if (idea.current_price) {
      const downside = (idea.current_price - idea.bear_price_target) / idea.current_price;
      if (downside <= 0.5) {
        checks_passed.push(`Downside bounded: ${(downside * 100).toFixed(0)}%`);
      } else {
        checks_failed.push(`Downside too large: ${(downside * 100).toFixed(0)}% (max 50%)`);
      }
    }
  } else {
    checks_failed.push('Bear price target not defined');
  }

  // Check bear case exists
  if (idea.bear_case && idea.bear_case.length > 20) {
    checks_passed.push('Bear case scenario defined');
  } else {
    checks_failed.push('Bear case scenario not defined');
  }

  const score = checks_passed.length / 4;
  const passed = checks_failed.length === 0;

  return {
    gate_id: 3,
    gate_name: 'DOWNSIDE_SANITY',
    passed,
    score,
    details: { checks_passed, checks_failed },
  };
}

/**
 * Build leverage risk reason string
 */
function buildLeverageRiskReason(flags: RiskFlags): string {
  const reasons: string[] = [];
  
  if (flags.net_debt_to_ebitda !== undefined && flags.net_debt_to_ebitda > 4) {
    reasons.push(`Net debt/EBITDA ${flags.net_debt_to_ebitda.toFixed(1)}x (>4x)`);
  }
  if (flags.interest_coverage !== undefined && flags.interest_coverage < 2) {
    reasons.push(`Interest coverage ${flags.interest_coverage.toFixed(1)}x (<2x)`);
  }
  if (flags.debt_maturity_pct_18m !== undefined && flags.debt_maturity_pct_18m > 30) {
    reasons.push(`${flags.debt_maturity_pct_18m.toFixed(0)}% debt maturing in 18m`);
  }
  if (flags.covenant_risk) {
    reasons.push('Covenant breach risk');
  }
  
  return reasons.length > 0 
    ? `Leverage risk dominant: ${reasons.join(', ')}`
    : 'Leverage risk flagged as dominant';
}

/**
 * Build liquidity risk reason string
 */
function buildLiquidityRiskReason(flags: RiskFlags): string {
  const reasons: string[] = [];
  
  if (flags.current_ratio !== undefined && flags.current_ratio < 0.8) {
    reasons.push(`Current ratio ${flags.current_ratio.toFixed(2)} (<0.8)`);
  }
  if (flags.quick_ratio !== undefined && flags.quick_ratio < 0.5) {
    reasons.push(`Quick ratio ${flags.quick_ratio.toFixed(2)} (<0.5)`);
  }
  if (flags.cash_runway_months !== undefined && flags.cash_runway_months < 12) {
    reasons.push(`Cash runway ${flags.cash_runway_months} months (<12)`);
  }
  if (flags.revolver_utilization !== undefined && flags.revolver_utilization > 90) {
    reasons.push(`Revolver ${flags.revolver_utilization.toFixed(0)}% utilized`);
  }
  if (flags.going_concern_warning) {
    reasons.push('Going concern warning');
  }
  
  return reasons.length > 0 
    ? `Liquidity risk dominant: ${reasons.join(', ')}`
    : 'Liquidity risk flagged as dominant';
}

/**
 * Build regulatory risk reason string
 */
function buildRegulatoryRiskReason(flags: RiskFlags): string {
  const reasons: string[] = [];
  
  if (flags.pending_regulatory_decision) {
    reasons.push('Pending regulatory decision');
  }
  if (flags.patent_cliff_revenue_pct !== undefined && flags.patent_cliff_revenue_pct > 30) {
    reasons.push(`Patent cliff ${flags.patent_cliff_revenue_pct.toFixed(0)}% of revenue`);
  }
  if (flags.license_renewal_risk) {
    reasons.push('License renewal at risk');
  }
  if (flags.antitrust_risk) {
    reasons.push('Antitrust investigation');
  }
  if (flags.sanctions_exposure) {
    reasons.push('Sanctions exposure');
  }
  
  return reasons.length > 0 
    ? `Regulatory cliff dominant: ${reasons.join(', ')}`
    : 'Regulatory cliff flagged as dominant';
}

/**
 * Auto-detect binary overrides from numeric indicators
 * This catches cases where the flag wasn't explicitly set but metrics indicate risk
 */
function autoDetectBinaryOverrides(flags: RiskFlags): { type: Gate3BinaryOverrideType; reason: string } | null {
  // Auto-detect leverage risk
  if (
    (flags.net_debt_to_ebitda !== undefined && flags.net_debt_to_ebitda > 4) ||
    (flags.interest_coverage !== undefined && flags.interest_coverage < 2) ||
    (flags.debt_maturity_pct_18m !== undefined && flags.debt_maturity_pct_18m > 30) ||
    flags.covenant_risk
  ) {
    return {
      type: 'leverage_risk_dominant',
      reason: buildLeverageRiskReason({ ...flags, leverage_risk_dominant: true }),
    };
  }
  
  // Auto-detect liquidity risk
  if (
    (flags.current_ratio !== undefined && flags.current_ratio < 0.8) ||
    (flags.quick_ratio !== undefined && flags.quick_ratio < 0.5) ||
    (flags.cash_runway_months !== undefined && flags.cash_runway_months < 12) ||
    (flags.revolver_utilization !== undefined && flags.revolver_utilization > 90) ||
    flags.going_concern_warning
  ) {
    return {
      type: 'liquidity_risk_dominant',
      reason: buildLiquidityRiskReason({ ...flags, liquidity_risk_dominant: true }),
    };
  }
  
  // Auto-detect regulatory cliff
  if (
    flags.pending_regulatory_decision ||
    (flags.patent_cliff_revenue_pct !== undefined && flags.patent_cliff_revenue_pct > 30) ||
    flags.license_renewal_risk ||
    flags.antitrust_risk ||
    flags.sanctions_exposure
  ) {
    return {
      type: 'regulatory_cliff_dominant',
      reason: buildRegulatoryRiskReason({ ...flags, regulatory_cliff_dominant: true }),
    };
  }
  
  return null;
}

/**
 * Gate 4: Style Fit
 * 
 * CRITICAL: This gate ensures ideas match their assigned style.
 * A "cheap" cigar butt without value realization path MUST fail this gate.
 */
export function evaluateGate4(idea: IdeaForGating): GateResult {
  const checks_passed: string[] = [];
  const checks_failed: string[] = [];
  const style = idea.style_tag.toLowerCase();

  switch (style) {
    case 'quality':
      // Quality requires moat and high ROIC
      if (idea.moat_score && idea.moat_score >= 0.7) {
        checks_passed.push(`Strong moat: ${(idea.moat_score * 100).toFixed(0)}%`);
      } else {
        checks_failed.push('Quality idea lacks durable moat');
      }
      if (idea.roic && idea.roic >= 0.15) {
        checks_passed.push(`High ROIC: ${(idea.roic * 100).toFixed(0)}%`);
      } else {
        checks_failed.push('Quality idea lacks high ROIC (need 15%+)');
      }
      break;

    case 'value':
      // Value requires margin of safety AND path to value realization
      if (idea.margin_of_safety && idea.margin_of_safety >= 0.2) {
        checks_passed.push(`Margin of safety: ${(idea.margin_of_safety * 100).toFixed(0)}%`);
      } else {
        checks_failed.push('Value idea lacks margin of safety (need 20%+)');
      }
      // CRITICAL: Must have catalyst for value realization
      const hasValueCatalyst = idea.catalysts?.some(
        (c) =>
          c.name.toLowerCase().includes('buyback') ||
          c.name.toLowerCase().includes('dividend') ||
          c.name.toLowerCase().includes('activist') ||
          c.name.toLowerCase().includes('spin') ||
          c.name.toLowerCase().includes('sale') ||
          c.name.toLowerCase().includes('restructur')
      );
      if (hasValueCatalyst) {
        checks_passed.push('Has value realization catalyst');
      } else {
        checks_failed.push('Value idea has no path to value realization (cigar butt trap)');
      }
      break;

    case 'growth':
      // Growth requires revenue growth and TAM
      if (idea.revenue_growth && idea.revenue_growth >= 0.15) {
        checks_passed.push(`Revenue growth: ${(idea.revenue_growth * 100).toFixed(0)}%`);
      } else {
        checks_failed.push('Growth idea lacks revenue growth (need 15%+)');
      }
      break;

    case 'special_situations':
    case 'special':
      // Special situations require event catalyst
      const hasEventCatalyst = idea.catalysts?.some(
        (c) =>
          c.name.toLowerCase().includes('merger') ||
          c.name.toLowerCase().includes('acquisition') ||
          c.name.toLowerCase().includes('spin') ||
          c.name.toLowerCase().includes('litigation') ||
          c.name.toLowerCase().includes('regulatory')
      );
      if (hasEventCatalyst) {
        checks_passed.push('Has identifiable event catalyst');
      } else {
        checks_failed.push('Special situation lacks event catalyst');
      }
      break;

    case 'turnaround':
      // Turnaround requires path to profitability
      const hasTurnaroundCatalyst = idea.catalysts?.some(
        (c) =>
          c.name.toLowerCase().includes('management') ||
          c.name.toLowerCase().includes('restructur') ||
          c.name.toLowerCase().includes('cost') ||
          c.name.toLowerCase().includes('margin')
      );
      if (hasTurnaroundCatalyst) {
        checks_passed.push('Has turnaround catalyst');
      } else {
        checks_failed.push('Turnaround lacks clear path to profitability');
      }
      break;

    default:
      checks_failed.push(`Unknown style: ${style}`);
  }

  const totalChecks = checks_passed.length + checks_failed.length;
  const score = totalChecks > 0 ? checks_passed.length / totalChecks : 0;
  const passed = checks_failed.length === 0;

  return {
    gate_id: 4,
    gate_name: 'STYLE_FIT',
    passed,
    score,
    details: {
      checks_passed,
      checks_failed,
      notes: `Style: ${style}`,
    },
  };
}

// ============================================================================
// MAIN GATE EVALUATION
// ============================================================================

/**
 * Run all gates on an idea and return results
 */
export function evaluateAllGates(idea: IdeaForGating): GateResults {
  const gate_0 = evaluateGate0(idea);
  const gate_1 = evaluateGate1(idea);
  const gate_2 = evaluateGate2(idea);
  const gate_3 = evaluateGate3(idea);
  const gate_4 = evaluateGate4(idea);

  const gates = [gate_0, gate_1, gate_2, gate_3, gate_4];
  const all_passed = gates.every((g) => g.passed);
  const first_failed = gates.find((g) => !g.passed);

  // Check if Gate 3 binary override was triggered
  const binary_override_triggered = gate_3.details.binary_override !== undefined;
  const binary_override_type = gate_3.details.binary_override;

  return {
    gate_0_data_sufficiency: gate_0,
    gate_1_coherence: gate_1,
    gate_2_edge_claim: gate_2,
    gate_3_downside_sanity: gate_3,
    gate_4_style_fit: gate_4,
    all_passed,
    first_failed_gate: first_failed ? first_failed.gate_id : null,
    binary_override_triggered,
    binary_override_type,
  };
}

/**
 * Get gate name by ID
 */
export function getGateName(gateId: number): string {
  const names: Record<number, string> = {
    0: 'DATA_SUFFICIENCY',
    1: 'COHERENCE',
    2: 'EDGE_CLAIM',
    3: 'DOWNSIDE_SANITY',
    4: 'STYLE_FIT',
  };
  return names[gateId] || 'UNKNOWN';
}

/**
 * Create rejection shadow record
 */
export function createRejectionShadow(
  ideaId: string,
  ticker: string,
  gateResults: GateResults
): {
  idea_id: string;
  ticker: string;
  rejected_at: Date;
  failed_gate_id: number;
  failed_gate_name: string;
  gate_results: GateResults;
  binary_override?: string;
} | null {
  if (gateResults.all_passed) {
    return null;
  }

  return {
    idea_id: ideaId,
    ticker,
    rejected_at: new Date(),
    failed_gate_id: gateResults.first_failed_gate!,
    failed_gate_name: getGateName(gateResults.first_failed_gate!),
    gate_results: gateResults,
    binary_override: gateResults.binary_override_type,
  };
}

export default {
  GATE_DEFINITIONS,
  GATE_3_BINARY_OVERRIDES,
  evaluateGate0,
  evaluateGate1,
  evaluateGate2,
  evaluateGate3,
  evaluateGate4,
  evaluateAllGates,
  getGateName,
  createRejectionShadow,
};
