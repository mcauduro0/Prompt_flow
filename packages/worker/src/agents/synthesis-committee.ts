/**
 * ARC Investment Factory - Synthesis Committee Step
 * 
 * This is an EXPLICIT step in the Lane B pipeline (not merged into modules).
 * 
 * The Synthesis Committee produces:
 * 1. One-sentence thesis
 * 2. Variant perception
 * 3. Bull/Base/Bear with probabilities
 * 4. Expected value calculation
 * 
 * This step runs AFTER all 7 research modules are complete.
 */

import { z } from 'zod';
import {
  VariantPerceptionSchema,
  BullBaseBearSchema,
  type VariantPerception,
  type BullBaseBear,
} from '@arc/core/validation/research-packet-completion';

// ============================================================================
// SYNTHESIS OUTPUT SCHEMA
// ============================================================================

export const SynthesisOutputSchema = z.object({
  // One-sentence thesis
  one_sentence_thesis: z.string().min(50).max(300),
  
  // Variant perception (MANDATORY)
  variant_perception: VariantPerceptionSchema,
  
  // Bull/Base/Bear scenarios (MANDATORY)
  bull_base_bear: BullBaseBearSchema,
  
  // Expected value calculation
  expected_value: z.object({
    weighted_return: z.number(), // Probability-weighted expected return
    upside_capture: z.number(), // % of upside we expect to capture
    downside_risk: z.number(), // % downside in bear case
    risk_reward_ratio: z.number(), // Upside / Downside
    kelly_fraction: z.number().min(0).max(1), // Optimal position size
    conviction_adjusted_size: z.number().min(0).max(1), // Kelly * conviction factor
  }),
  
  // Key investment attributes
  key_attributes: z.object({
    primary_edge: z.string().min(20),
    time_horizon: z.enum(['3-6 months', '6-12 months', '1-2 years', '2-5 years']),
    catalyst_dependency: z.enum(['high', 'moderate', 'low']),
    thesis_complexity: z.enum(['simple', 'moderate', 'complex']),
    information_edge_type: z.enum(['analytical', 'informational', 'behavioral', 'structural']),
  }),
  
  // Synthesis metadata
  metadata: z.object({
    synthesized_at: z.string(),
    modules_used: z.array(z.string()),
    confidence_score: z.number().min(0).max(1),
    dissenting_views: z.array(z.string()),
  }),
});

export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;

// ============================================================================
// SYNTHESIS COMMITTEE STEP
// ============================================================================

export interface ModuleOutput {
  module_id: string;
  key_findings: string[];
  confidence_score: number;
  bull_implications: string[];
  bear_implications: string[];
}

export interface SynthesisInput {
  ticker: string;
  company_name: string;
  current_price: number;
  modules: ModuleOutput[];
  original_hypothesis: string;
}

/**
 * Synthesis Committee - produces unified investment thesis from module outputs
 */
export class SynthesisCommittee {
  private llmClient: any; // LLM client for synthesis

  constructor(llmClient: any) {
    this.llmClient = llmClient;
  }

  /**
   * Run synthesis on completed module outputs
   */
  async synthesize(input: SynthesisInput): Promise<SynthesisOutput> {
    // Aggregate findings from all modules
    const aggregatedFindings = this.aggregateFindings(input.modules);
    
    // Generate synthesis via LLM
    const synthesisPrompt = this.buildSynthesisPrompt(input, aggregatedFindings);
    
    const llmResponse = await this.llmClient.complete({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an investment committee synthesizing research from 7 specialist analysts.
Your task is to produce a unified investment thesis with:
1. A clear one-sentence thesis (50-300 chars)
2. A variant perception explaining why we differ from consensus
3. Bull/Base/Bear scenarios with probabilities summing to 1.0
4. Expected value calculation

Be specific and quantitative. Avoid vague language.`,
        },
        {
          role: 'user',
          content: synthesisPrompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const rawOutput = JSON.parse(llmResponse.content);
    
    // Validate output
    const validationResult = SynthesisOutputSchema.safeParse(rawOutput);
    if (!validationResult.success) {
      throw new Error(`Synthesis output validation failed: ${validationResult.error.message}`);
    }

    return validationResult.data;
  }

  /**
   * Aggregate findings from all modules
   */
  private aggregateFindings(modules: ModuleOutput[]): {
    bullFactors: string[];
    bearFactors: string[];
    keyFindings: string[];
    avgConfidence: number;
  } {
    const bullFactors: string[] = [];
    const bearFactors: string[] = [];
    const keyFindings: string[] = [];
    let totalConfidence = 0;

    for (const module of modules) {
      bullFactors.push(...module.bull_implications);
      bearFactors.push(...module.bear_implications);
      keyFindings.push(...module.key_findings);
      totalConfidence += module.confidence_score;
    }

    return {
      bullFactors,
      bearFactors,
      keyFindings,
      avgConfidence: totalConfidence / modules.length,
    };
  }

  /**
   * Build synthesis prompt
   */
  private buildSynthesisPrompt(
    input: SynthesisInput,
    aggregated: ReturnType<typeof this.aggregateFindings>
  ): string {
    return `
## Company: ${input.company_name} (${input.ticker})
## Current Price: $${input.current_price}
## Original Hypothesis: ${input.original_hypothesis}

## Key Findings from Research Modules:
${aggregated.keyFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## Bull Factors:
${aggregated.bullFactors.map((f) => `- ${f}`).join('\n')}

## Bear Factors:
${aggregated.bearFactors.map((f) => `- ${f}`).join('\n')}

## Average Module Confidence: ${(aggregated.avgConfidence * 100).toFixed(0)}%

Please synthesize this research into a unified investment thesis with the following JSON structure:
{
  "one_sentence_thesis": "...",
  "variant_perception": {
    "consensus_view": "...",
    "our_view": "...",
    "why_we_differ": "...",
    "evidence_supporting_variant": ["...", "..."],
    "what_would_change_our_mind": "..."
  },
  "bull_base_bear": {
    "bull": { "probability": 0.X, "target_price": X, "description": "...", "key_assumptions": ["...", "..."], "timeline": "..." },
    "base": { "probability": 0.X, "target_price": X, "description": "...", "key_assumptions": ["...", "..."], "timeline": "..." },
    "bear": { "probability": 0.X, "target_price": X, "description": "...", "key_assumptions": ["...", "..."], "timeline": "..." }
  },
  "expected_value": {
    "weighted_return": X,
    "upside_capture": X,
    "downside_risk": X,
    "risk_reward_ratio": X,
    "kelly_fraction": X,
    "conviction_adjusted_size": X
  },
  "key_attributes": {
    "primary_edge": "...",
    "time_horizon": "...",
    "catalyst_dependency": "...",
    "thesis_complexity": "...",
    "information_edge_type": "..."
  },
  "metadata": {
    "synthesized_at": "${new Date().toISOString()}",
    "modules_used": ${JSON.stringify(input.modules.map((m) => m.module_id))},
    "confidence_score": ${aggregated.avgConfidence},
    "dissenting_views": []
  }
}

IMPORTANT: Bull + Base + Bear probabilities MUST sum to exactly 1.0
`;
  }

  /**
   * Calculate expected value from scenarios
   */
  calculateExpectedValue(
    currentPrice: number,
    bullBaseBear: BullBaseBear,
    conviction: number
  ): SynthesisOutput['expected_value'] {
    const bullReturn = (bullBaseBear.bull.target_price - currentPrice) / currentPrice;
    const baseReturn = (bullBaseBear.base.target_price - currentPrice) / currentPrice;
    const bearReturn = (bullBaseBear.bear.target_price - currentPrice) / currentPrice;

    const weightedReturn =
      bullBaseBear.bull.probability * bullReturn +
      bullBaseBear.base.probability * baseReturn +
      bullBaseBear.bear.probability * bearReturn;

    const upside = Math.max(bullReturn, 0);
    const downside = Math.abs(Math.min(bearReturn, 0));
    const riskRewardRatio = downside > 0 ? upside / downside : upside;

    // Kelly criterion: f* = (bp - q) / b
    // where b = odds, p = probability of winning, q = probability of losing
    const winProb = bullBaseBear.bull.probability + bullBaseBear.base.probability * 0.5;
    const loseProb = 1 - winProb;
    const avgWin = (bullReturn * bullBaseBear.bull.probability + baseReturn * bullBaseBear.base.probability * 0.5) / winProb;
    const avgLoss = Math.abs(bearReturn);
    const kellyFraction = avgLoss > 0 ? Math.max(0, Math.min(1, (avgWin * winProb - avgLoss * loseProb) / avgLoss)) : 0;

    // Adjust for conviction (1-5 scale)
    const convictionFactor = conviction / 5;
    const convictionAdjustedSize = kellyFraction * convictionFactor * 0.5; // Half-Kelly with conviction

    return {
      weighted_return: weightedReturn,
      upside_capture: upside,
      downside_risk: downside,
      risk_reward_ratio: riskRewardRatio,
      kelly_fraction: kellyFraction,
      conviction_adjusted_size: convictionAdjustedSize,
    };
  }
}

export default SynthesisCommittee;
