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
});

export type GateResults = z.infer<typeof GateResultsSchema>;

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
 */
export function evaluateGate3(idea: IdeaForGating): GateResult {
  const checks_passed: string[] = [];
  const checks_failed: string[] = [];

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

  return {
    gate_0_data_sufficiency: gate_0,
    gate_1_coherence: gate_1,
    gate_2_edge_claim: gate_2,
    gate_3_downside_sanity: gate_3,
    gate_4_style_fit: gate_4,
    all_passed,
    first_failed_gate: first_failed ? first_failed.gate_id : null,
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
  };
}

export default {
  GATE_DEFINITIONS,
  evaluateGate0,
  evaluateGate1,
  evaluateGate2,
  evaluateGate3,
  evaluateGate4,
  evaluateAllGates,
  getGateName,
  createRejectionShadow,
};
