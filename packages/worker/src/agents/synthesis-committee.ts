/**
 * ARC Investment Factory - Synthesis Committee Agent
 * 
 * This agent synthesizes all research modules into a final investment thesis.
 * It acts as a virtual investment committee, weighing all evidence and producing
 * a coherent recommendation with conviction level and risk assessment.
 */

import { z } from 'zod';
import { createResilientClient, type LLMClient } from '@arc/llm-client';

// Schema for synthesis output
export const SynthesisResultSchema = z.object({
  thesis: z.string().min(100).describe('Complete investment thesis synthesizing all research'),
  conviction: z.number().min(1).max(10).describe('Conviction level 1-10'),
  recommendation: z.enum(['strong_buy', 'buy', 'hold', 'sell', 'strong_sell']),
  
  // Key components
  bull_case: z.string().describe('Best case scenario'),
  base_case: z.string().describe('Most likely scenario'),
  bear_case: z.string().describe('Worst case scenario'),
  
  // Risk assessment
  risks: z.array(z.object({
    risk: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    mitigation: z.string().optional(),
  })),
  
  // Catalysts
  catalysts: z.array(z.object({
    catalyst: z.string(),
    timeframe: z.string(),
    probability: z.enum(['low', 'medium', 'high']),
    impact: z.enum(['low', 'medium', 'high']),
  })),
  
  // Position sizing guidance
  position_guidance: z.object({
    suggested_weight: z.enum(['underweight', 'market_weight', 'overweight', 'high_conviction']),
    max_position_pct: z.number().min(0).max(10),
    entry_strategy: z.string(),
    exit_triggers: z.array(z.string()),
  }),
  
  // Monitoring plan
  monitoring: z.object({
    key_metrics: z.array(z.string()),
    review_frequency: z.enum(['weekly', 'monthly', 'quarterly']),
    red_flags: z.array(z.string()),
  }),
  
  // Dissenting views
  dissenting_views: z.array(z.string()).optional(),
  
  // Evidence quality
  evidence_quality: z.object({
    data_completeness: z.number().min(0).max(1),
    analysis_depth: z.number().min(0).max(1),
    confidence_in_estimates: z.number().min(0).max(1),
  }),
});

export type SynthesisResult = z.infer<typeof SynthesisResultSchema>;

// Input for synthesis
export interface SynthesisInput {
  ticker: string;
  companyName: string;
  styleTag: string;
  originalHypothesis: string;
  modules: {
    business?: any;
    industryMoat?: any;
    financials?: any;
    capitalAllocation?: any;
    management?: any;
    valuation?: any;
    risk?: any;
  };
  gateResults?: any;
  currentPrice?: number;
}

const SYNTHESIS_SYSTEM_PROMPT = `You are the Chief Investment Officer of a fundamental-focused hedge fund, chairing the Investment Committee.

Your role is to synthesize all research modules into a final investment recommendation. You must:

1. WEIGH ALL EVIDENCE objectively - don't let one strong module override concerns from others
2. IDENTIFY CONTRADICTIONS between modules and resolve them
3. ASSESS CONVICTION based on the quality and consistency of evidence
4. CONSIDER POSITION SIZING based on conviction and risk
5. DEFINE CLEAR EXIT TRIGGERS for both upside and downside

Key principles:
- Quality of business matters more than cheapness
- Moat durability is the most important long-term factor
- Management incentive alignment is critical
- Downside protection should be explicit
- Catalysts should have defined timeframes

Output ONLY valid JSON matching the SynthesisResult schema.`;

/**
 * Build the user prompt for synthesis
 */
function buildSynthesisPrompt(input: SynthesisInput): string {
  const sections: string[] = [];

  sections.push(`# Investment Synthesis Request

**Company:** ${input.companyName} (${input.ticker})
**Style:** ${input.styleTag}
**Original Hypothesis:** ${input.originalHypothesis}
**Current Price:** ${input.currentPrice ? `$${input.currentPrice.toFixed(2)}` : 'N/A'}
`);

  if (input.modules.business) {
    sections.push(`## Business Model Analysis
${JSON.stringify(input.modules.business, null, 2)}
`);
  }

  if (input.modules.industryMoat) {
    sections.push(`## Industry & Moat Analysis
${JSON.stringify(input.modules.industryMoat, null, 2)}
`);
  }

  if (input.modules.financials) {
    sections.push(`## Financial Forensics
${JSON.stringify(input.modules.financials, null, 2)}
`);
  }

  if (input.modules.capitalAllocation) {
    sections.push(`## Capital Allocation
${JSON.stringify(input.modules.capitalAllocation, null, 2)}
`);
  }

  if (input.modules.management) {
    sections.push(`## Management Quality
${JSON.stringify(input.modules.management, null, 2)}
`);
  }

  if (input.modules.valuation) {
    sections.push(`## Valuation Analysis
${JSON.stringify(input.modules.valuation, null, 2)}
`);
  }

  if (input.modules.risk) {
    sections.push(`## Risk Assessment
${JSON.stringify(input.modules.risk, null, 2)}
`);
  }

  if (input.gateResults) {
    sections.push(`## Gate Results
${JSON.stringify(input.gateResults, null, 2)}
`);
  }

  sections.push(`
## Your Task

Synthesize all the above research into a comprehensive investment recommendation.

Consider:
1. Is the thesis coherent across all modules?
2. What are the key risks and how severe are they?
3. What conviction level is warranted by the evidence?
4. What position size is appropriate?
5. What are the key monitoring metrics?

Provide your synthesis as a JSON object matching the SynthesisResult schema.
`);

  return sections.join('\n');
}

/**
 * Run the synthesis committee
 */
export async function runSynthesis(
  input: SynthesisInput,
  llmClient?: LLMClient
): Promise<SynthesisResult> {
  const llm = llmClient || createResilientClient();

  console.log(`[Synthesis] Starting synthesis for ${input.ticker}`);

  try {
    const response = await llm.complete({
      messages: [
        { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
        { role: 'user', content: buildSynthesisPrompt(input) },
      ],
      temperature: 0.4,
      maxTokens: 4000,
      jsonMode: true,
    });

    // Parse and validate response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in synthesis response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = SynthesisResultSchema.parse(parsed);

    console.log(`[Synthesis] Completed for ${input.ticker} - Conviction: ${validated.conviction}, Recommendation: ${validated.recommendation}`);

    return validated;
  } catch (error) {
    console.error(`[Synthesis] Error for ${input.ticker}:`, error);

    // Return a default/error synthesis
    return {
      thesis: `Synthesis failed for ${input.ticker}: ${(error as Error).message}`,
      conviction: 1,
      recommendation: 'hold',
      bull_case: 'Unable to generate bull case',
      base_case: 'Unable to generate base case',
      bear_case: 'Unable to generate bear case',
      risks: [{ risk: 'Synthesis failed', severity: 'critical' }],
      catalysts: [],
      position_guidance: {
        suggested_weight: 'underweight',
        max_position_pct: 0,
        entry_strategy: 'Do not enter until synthesis is complete',
        exit_triggers: [],
      },
      monitoring: {
        key_metrics: [],
        review_frequency: 'weekly',
        red_flags: ['Synthesis incomplete'],
      },
      evidence_quality: {
        data_completeness: 0,
        analysis_depth: 0,
        confidence_in_estimates: 0,
      },
    };
  }
}

/**
 * Run synthesis for a research packet
 */
export async function synthesizePacket(
  packet: any,
  idea: any,
  currentPrice?: number
): Promise<SynthesisResult> {
  const input: SynthesisInput = {
    ticker: packet.ticker,
    companyName: idea?.companyName || packet.ticker,
    styleTag: idea?.styleTag || 'unknown',
    originalHypothesis: idea?.oneSentenceHypothesis || '',
    modules: {
      business: packet.modules?.business,
      industryMoat: packet.modules?.industry_moat,
      financials: packet.modules?.financials,
      capitalAllocation: packet.modules?.capital_allocation,
      management: packet.modules?.management,
      valuation: packet.modules?.valuation,
      risk: packet.modules?.risk,
    },
    gateResults: packet.gateResults,
    currentPrice,
  };

  return runSynthesis(input);
}

/**
 * Quick synthesis for ideas without full research
 */
export async function quickSynthesis(
  ticker: string,
  hypothesis: string,
  styleTag: string,
  metrics?: any
): Promise<Pick<SynthesisResult, 'thesis' | 'conviction' | 'recommendation' | 'risks'>> {
  const llm = createResilientClient();

  const prompt = `Quick investment assessment for ${ticker}:

Hypothesis: ${hypothesis}
Style: ${styleTag}
Metrics: ${JSON.stringify(metrics || {}, null, 2)}

Provide a brief assessment with:
1. thesis: 2-3 sentence summary
2. conviction: 1-10 score
3. recommendation: strong_buy/buy/hold/sell/strong_sell
4. risks: top 3 risks with severity

JSON output only:`;

  try {
    const response = await llm.complete({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 1000,
      jsonMode: true,
    });

    const parsed = JSON.parse(response.content);
    return {
      thesis: parsed.thesis || hypothesis,
      conviction: parsed.conviction || 5,
      recommendation: parsed.recommendation || 'hold',
      risks: parsed.risks || [],
    };
  } catch (error) {
    return {
      thesis: hypothesis,
      conviction: 5,
      recommendation: 'hold',
      risks: [{ risk: 'Quick synthesis failed', severity: 'medium' as const }],
    };
  }
}

export default { runSynthesis, synthesizePacket, quickSynthesis };
