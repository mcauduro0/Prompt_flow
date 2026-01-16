/**
 * ARC Investment Factory - Lane C IC Memo Runner
 * 
 * Pipeline: select_pending_memos → fetch_research_packet → run_supporting_prompts → generate_ic_memo → persist
 * 
 * This runner orchestrates the IC Memo generation process for approved research packets.
 * It executes supporting prompts to enrich the research and generates a comprehensive IC Memo.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  icMemosRepository,
  researchPacketsRepository,
  ideasRepository,
} from '@arc/database';
import { createResilientClient, type LLMClient, type LLMRequest } from '@arc/llm-client';
import { createDataAggregator, type AggregatedCompanyData } from '@arc/retriever';

// Supporting prompt definitions (hardcoded to avoid schema validation issues)
const SUPPORTING_PROMPT_TEMPLATES: Record<string, string> = {
  'Variant Perception': `You are an expert investment analyst specializing in identifying variant perceptions.

Analyze the following research on {{ticker}} ({{company_name}}) and identify:
1. What is the consensus view on this company?
2. What is our differentiated view?
3. Why might the market be wrong?
4. What facts would confirm our view?
5. What facts would invalidate our view?

Research Data:
{{research_summary}}

Respond in JSON format:
{
  "consensus_view": "string",
  "our_view": "string",
  "why_market_wrong": "string",
  "confirming_facts": ["array of facts"],
  "invalidating_facts": ["array of facts"],
  "confidence": 1-10
}`,

  'Bull Bear Analysis': `You are an expert investment analyst. Analyze the following research on {{ticker}} ({{company_name}}) and provide:

1. Bull Case: The most optimistic but realistic scenario
2. Bear Case: The most pessimistic but realistic scenario
3. Base Case: The most likely scenario
4. Key debates and uncertainties

Research Data:
{{research_summary}}

Respond in JSON format:
{
  "bull_case": {
    "scenario": "string",
    "probability": 0-100,
    "target_price": number,
    "key_drivers": ["array"]
  },
  "bear_case": {
    "scenario": "string",
    "probability": 0-100,
    "target_price": number,
    "key_risks": ["array"]
  },
  "base_case": {
    "scenario": "string",
    "probability": 0-100,
    "target_price": number,
    "assumptions": ["array"]
  },
  "key_debates": ["array of key debates"]
}`,

  'Position Sizing': `You are an expert portfolio manager. Based on the following research on {{ticker}} ({{company_name}}), recommend an appropriate position size.

Consider:
1. Conviction level
2. Risk/reward asymmetry
3. Liquidity
4. Portfolio concentration
5. Correlation with existing holdings

Research Data:
{{research_summary}}

Respond in JSON format:
{
  "recommended_size": "string (e.g., 2-3% of portfolio)",
  "sizing_rationale": "string",
  "max_position": "string",
  "scaling_strategy": "string",
  "liquidity_assessment": "string",
  "risk_adjusted_size": "string"
}`,

  'Pre Mortem Analysis': `You are an expert risk analyst. Conduct a pre-mortem analysis for an investment in {{ticker}} ({{company_name}}).

Imagine the investment has failed completely. What went wrong?

Research Data:
{{research_summary}}

Respond in JSON format:
{
  "failure_scenarios": [
    {
      "scenario": "string",
      "probability": 0-100,
      "early_warning_signs": ["array"],
      "mitigation": "string"
    }
  ],
  "most_likely_failure_mode": "string",
  "blind_spots": ["array of potential blind spots"],
  "key_assumptions_to_monitor": ["array"]
}`,

  'Exit Strategy': `You are an expert portfolio manager. Define exit strategies for an investment in {{ticker}} ({{company_name}}).

Research Data:
{{research_summary}}

Respond in JSON format:
{
  "profit_taking_strategy": {
    "target_prices": [number],
    "scaling_out_plan": "string",
    "thesis_completion_triggers": ["array"]
  },
  "stop_loss_strategy": {
    "price_based_stop": "string",
    "thesis_invalidation_triggers": ["array"],
    "time_based_review": "string"
  },
  "rebalancing_triggers": ["array"],
  "holding_period_expectation": "string"
}`,

  'Catalyst Identification': `You are an expert investment analyst. Identify potential catalysts for {{ticker}} ({{company_name}}).

Research Data:
{{research_summary}}

Respond in JSON format:
{
  "near_term_catalysts": [
    {
      "event": "string",
      "timeline": "string",
      "impact": "positive/negative/uncertain",
      "probability": 0-100
    }
  ],
  "medium_term_catalysts": [
    {
      "event": "string",
      "timeline": "string",
      "impact": "positive/negative/uncertain",
      "probability": 0-100
    }
  ],
  "long_term_catalysts": [
    {
      "event": "string",
      "timeline": "string",
      "impact": "positive/negative/uncertain",
      "probability": 0-100
    }
  ],
  "catalyst_calendar": "string summary"
}`,

  'Risk Assessment': `You are an expert risk analyst. Provide a comprehensive risk assessment for {{ticker}} ({{company_name}}).

Research Data:
{{research_summary}}

Respond in JSON format:
{
  "business_risks": [
    {
      "risk": "string",
      "severity": "high/medium/low",
      "probability": "high/medium/low",
      "mitigation": "string"
    }
  ],
  "financial_risks": [
    {
      "risk": "string",
      "severity": "high/medium/low",
      "probability": "high/medium/low",
      "mitigation": "string"
    }
  ],
  "market_risks": [
    {
      "risk": "string",
      "severity": "high/medium/low",
      "probability": "high/medium/low",
      "mitigation": "string"
    }
  ],
  "overall_risk_rating": "high/medium/low",
  "key_risk_to_monitor": "string"
}`,
};

export interface LaneCConfig {
  dryRun?: boolean;
  maxMemos?: number;
  memoIds?: string[]; // Specific memos to process
}

export interface LaneCResult {
  success: boolean;
  memosStarted: number;
  memosCompleted: number;
  memosFailed: number;
  errors: string[];
  duration_ms: number;
  memos: Array<{
    memoId: string;
    ticker: string;
    status: 'completed' | 'failed';
    error?: string;
  }>;
}

interface SupportingAnalysis {
  promptName: string;
  result: any;
  success: boolean;
  error?: string;
}

/**
 * Robust JSON parser that handles common LLM output issues
 */
function parseJSONRobust(content: string): { success: boolean; data: any; error?: string } {
  try {
    // First, try direct parsing
    const data = JSON.parse(content);
    return { success: true, data };
  } catch (e) {
    // Try to extract JSON from markdown code blocks
    const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      try {
        const data = JSON.parse(jsonBlockMatch[1].trim());
        return { success: true, data };
      } catch {}
    }

    // Try to find JSON object in the content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      let jsonStr = jsonMatch[0];
      
      // Fix common JSON issues
      // 1. Replace unquoted boolean-like values
      jsonStr = jsonStr.replace(/:\s*(partially|true|false|null)\s*([,}\]])/gi, (match, value, end) => {
        const lowerValue = value.toLowerCase();
        if (lowerValue === 'partially') {
          return `: "partially"${end}`;
        }
        return `: ${lowerValue}${end}`;
      });
      
      // 2. Fix trailing commas before closing brackets
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      
      // 3. Fix single quotes to double quotes (carefully)
      jsonStr = jsonStr.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"');
      
      // 4. Remove control characters
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, (char) => {
        if (char === '\n' || char === '\r' || char === '\t') {
          return char;
        }
        return '';
      });
      
      // 5. Fix unquoted string values (common issue)
      // This is tricky, so we'll be conservative
      
      try {
        const data = JSON.parse(jsonStr);
        return { success: true, data };
      } catch (e2) {
        return { 
          success: false, 
          data: null, 
          error: `JSON parse failed after fixes: ${(e2 as Error).message}` 
        };
      }
    }

    return { 
      success: false, 
      data: null, 
      error: `No valid JSON found in content: ${(e as Error).message}` 
    };
  }
}

/**
 * Execute a supporting prompt
 */
async function executeSupportingPrompt(
  promptName: string,
  ticker: string,
  companyName: string,
  researchSummary: string,
  llm: LLMClient
): Promise<SupportingAnalysis> {
  console.log(`[Lane C] Executing supporting prompt: ${promptName} for ${ticker}`);
  
  const template = SUPPORTING_PROMPT_TEMPLATES[promptName];
  if (!template) {
    console.warn(`[Lane C] No template found for prompt: ${promptName}`);
    return {
      promptName,
      result: null,
      success: false,
      error: `Template not found for prompt: ${promptName}`,
    };
  }

  try {
    // Fill in the template
    const filledPrompt = template
      .replace(/\{\{ticker\}\}/g, ticker)
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{research_summary\}\}/g, researchSummary);

    const request: LLMRequest = {
      messages: [
        { role: 'user', content: filledPrompt },
      ],
      temperature: 0.3,
      maxTokens: 4000,
    };

    const response = await llm.complete(request);
    const parseResult = parseJSONRobust(response.content);

    if (parseResult.success) {
      return {
        promptName,
        result: parseResult.data,
        success: true,
      };
    } else {
      // Return raw content if parsing fails
      return {
        promptName,
        result: { _raw_content: response.content },
        success: true, // Still mark as success since we got a response
        error: parseResult.error,
      };
    }
  } catch (error) {
    console.error(`[Lane C] Error executing prompt ${promptName}:`, error);
    return {
      promptName,
      result: null,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Prepare research summary from packet
 */
function prepareResearchSummary(packet: any, idea: any): string {
  const sections: string[] = [];

  // Add decision brief if available
  if (packet.decisionBrief) {
    sections.push(`## Decision Brief\n${packet.decisionBrief}`);
  }

  // Add original thesis
  if (idea?.oneSentenceHypothesis) {
    sections.push(`## Original Thesis\n${idea.oneSentenceHypothesis}`);
  }

  // Add research modules from packet
  if (packet.packet) {
    const modules = packet.packet;
    
    if (modules.business_model) {
      sections.push(`## Business Model\n${JSON.stringify(modules.business_model, null, 2)}`);
    }
    if (modules.industry_moat) {
      sections.push(`## Industry & Moat\n${JSON.stringify(modules.industry_moat, null, 2)}`);
    }
    if (modules.valuation) {
      sections.push(`## Valuation\n${JSON.stringify(modules.valuation, null, 2)}`);
    }
    if (modules.financial_forensics) {
      sections.push(`## Financial Forensics\n${JSON.stringify(modules.financial_forensics, null, 2)}`);
    }
    if (modules.capital_allocation) {
      sections.push(`## Capital Allocation\n${JSON.stringify(modules.capital_allocation, null, 2)}`);
    }
    if (modules.management_quality) {
      sections.push(`## Management Quality\n${JSON.stringify(modules.management_quality, null, 2)}`);
    }
    if (modules.risk_stress) {
      sections.push(`## Risk & Stress\n${JSON.stringify(modules.risk_stress, null, 2)}`);
    }
    if (modules.synthesis) {
      sections.push(`## Synthesis\n${JSON.stringify(modules.synthesis, null, 2)}`);
    }
  }

  return sections.join('\n\n');
}

/**
 * Generate the final IC Memo
 */
async function generateICMemo(
  ticker: string,
  companyName: string,
  styleTag: string,
  researchSummary: string,
  supportingAnalyses: SupportingAnalysis[],
  llm: LLMClient
): Promise<any> {
  console.log(`[Lane C] Generating final IC Memo for ${ticker}`);

  // Prepare supporting analyses summary
  const supportingData = supportingAnalyses
    .filter(a => a.success)
    .map(a => `### ${a.promptName}\n${JSON.stringify(a.result, null, 2)}`)
    .join('\n\n');

  const IC_MEMO_SYSTEM_PROMPT = `You are an expert investment analyst at a top-tier hedge fund. Your task is to synthesize research into a comprehensive Investment Committee (IC) Memo.

The IC Memo must be:
1. Rigorous and analytical
2. Clear and concise
3. Actionable with specific recommendations
4. Honest about uncertainties and risks

Style Tag: ${styleTag}
This influences the investment approach and criteria.`;

  const userPrompt = `Generate a comprehensive IC Memo for ${ticker} (${companyName}).

## Research Summary
${researchSummary}

## Supporting Analyses
${supportingData}

Generate a complete IC Memo in the following JSON structure. Be thorough and specific.

{
  "executive_summary": {
    "opportunity": "string - One paragraph describing the investment opportunity",
    "why_now": "string - Why is this the right time to invest?",
    "risk_reward_asymmetry": "string - What makes the risk/reward attractive?",
    "decision_required": "string - What decision is being requested?"
  },
  "investment_thesis": {
    "central_thesis": "string - The core investment thesis in 2-3 sentences",
    "value_creation_mechanism": "string - How will value be created?",
    "sustainability": "string - Why is this sustainable?",
    "structural_vs_cyclical": "string - Is this structural or cyclical?"
  },
  "business_analysis": {
    "how_company_makes_money": "string - Clear explanation of the business model",
    "competitive_advantages": ["array of competitive advantages"],
    "competitive_weaknesses": ["array of competitive weaknesses"],
    "industry_structure": "string - Industry dynamics",
    "competitive_dynamics": "string - Competitive landscape",
    "barriers_to_entry": "string - Barriers to entry",
    "pricing_power": "string - Pricing power assessment",
    "disruption_risks": "string - Technology/disruption risks"
  },
  "financial_quality": {
    "revenue_quality": "string - Assessment of revenue quality",
    "margin_analysis": "string - Margin trends and sustainability",
    "capital_intensity": "string - Capital requirements",
    "return_on_capital": "string - ROIC/ROE analysis",
    "accounting_distortions": ["array of accounting concerns"],
    "earnings_quality_risks": ["array of earnings quality risks"],
    "growth_capital_dynamics": "string - Growth vs capital needs"
  },
  "valuation": {
    "methodology": "string - Valuation methodology used",
    "key_assumptions": ["array of key assumptions"],
    "value_range": {
      "bear": 100,
      "base": 150,
      "bull": 200
    },
    "sensitivities": ["array of key sensitivities"],
    "expected_return": "string - Expected return analysis",
    "opportunity_cost": "string - Opportunity cost consideration"
  },
  "risks": {
    "material_risks": [
      {
        "risk": "string - Description of the risk",
        "manifestation": "string - How it would manifest",
        "impact": "string - Potential impact",
        "early_signals": ["array of early warning signals"]
      }
    ],
    "thesis_error_risks": ["array of ways the thesis could be wrong"],
    "asymmetric_risks": ["array of asymmetric risks"]
  },
  "variant_perception": {
    "consensus_view": "string - What does the market think?",
    "our_view": "string - Our differentiated view",
    "why_market_wrong": "string - Why the market may be wrong",
    "confirming_facts": ["array of confirming facts"],
    "invalidating_facts": ["array of facts that would invalidate thesis"]
  },
  "catalysts": {
    "value_unlocking_events": [
      {
        "event": "string - Description of catalyst",
        "timeline": "string - Expected timing",
        "controllable": true
      }
    ],
    "expected_horizon": "string - Investment horizon"
  },
  "portfolio_fit": {
    "portfolio_role": "string - Role in portfolio",
    "correlation": "string - Correlation with other holdings",
    "concentration_impact": "string - Impact on concentration",
    "liquidity": "string - Liquidity assessment",
    "drawdown_impact": "string - Impact on portfolio drawdowns",
    "sizing_rationale": "string - Rationale for position size",
    "suggested_position_size": "string - Recommended position size"
  },
  "decision": {
    "recommendation": "strong_buy|buy|hold|sell|strong_sell",
    "revisit_conditions": ["array of conditions to revisit"],
    "change_of_mind_triggers": ["array of triggers to change view"]
  }
}

IMPORTANT: 
- Respond ONLY with the structured JSON, no additional text before or after.
- Use numeric values for value_range (bear, base, bull), not strings.
- Use true/false for booleans (controllable), not strings like "partially".
- If something is partially controllable, use true and explain in the event field.
- Do not use trailing commas.
- Ensure all string values are properly quoted.`;

  const request: LLMRequest = {
    messages: [
      { role: 'system', content: IC_MEMO_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens: 8000,
  };
  const response = await llm.complete(request);

  // Parse the JSON response using robust parser
  const parseResult = parseJSONRobust(response.content);
  
  if (parseResult.success) {
    return parseResult.data;
  } else {
    console.error('Failed to parse IC Memo JSON:', parseResult.error);
    // Return a structured error response with the raw content
    return {
      executive_summary: {
        opportunity: 'Failed to generate - see raw content',
        why_now: '',
        risk_reward_asymmetry: '',
        decision_required: 'Manual review required',
      },
      _raw_content: response.content,
      _parse_error: parseResult.error,
    };
  }
}

/**
 * Process a single IC Memo
 */
async function processICMemo(
  memoId: string,
  packetId: string,
  ticker: string,
  llm: LLMClient
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update status to generating
    await icMemosRepository.updateStatus(memoId, 'generating');
    await icMemosRepository.updateProgress(memoId, 5);

    // Fetch the research packet
    const packet = await researchPacketsRepository.getById(packetId);
    if (!packet) {
      throw new Error(`Research packet not found: ${packetId}`);
    }

    // Fetch the idea for additional context
    const idea = await ideasRepository.getById(packet.ideaId);
    const companyName = idea?.companyName || ticker;
    const styleTag = packet.styleTag || 'quality_compounder';

    await icMemosRepository.updateProgress(memoId, 10);

    // Prepare research summary
    const researchSummary = prepareResearchSummary(packet, idea);

    // Execute supporting prompts
    const supportingAnalyses: SupportingAnalysis[] = [];
    const promptNames = Object.keys(SUPPORTING_PROMPT_TEMPLATES);
    const progressPerPrompt = 60 / promptNames.length;

    for (let i = 0; i < promptNames.length; i++) {
      const promptName = promptNames[i];
      const analysis = await executeSupportingPrompt(
        promptName,
        ticker,
        companyName,
        researchSummary,
        llm
      );
      supportingAnalyses.push(analysis);
      await icMemosRepository.updateProgress(memoId, Math.round(10 + (i + 1) * progressPerPrompt));
    }

    await icMemosRepository.updateProgress(memoId, 75);

    // Generate the final IC Memo
    const memoContent = await generateICMemo(
      ticker,
      companyName,
      styleTag,
      researchSummary,
      supportingAnalyses,
      llm
    );

    await icMemosRepository.updateProgress(memoId, 95);

    // Extract recommendation from the memo
    const recommendation = memoContent?.decision?.recommendation || 'hold';
    
    // Calculate conviction based on recommendation
    const convictionMap: Record<string, number> = {
      'strong_buy': 90,
      'buy': 80,
      'invest': 75,
      'increase': 70,
      'hold': 50,
      'reduce': 30,
      'wait': 40,
      'sell': 25,
      'strong_sell': 15,
      'reject': 20,
    };
    const conviction = convictionMap[recommendation.toLowerCase()] || 50;

    // Save the completed memo
    const supportingAnalysesObj = supportingAnalyses.reduce((acc, a) => {
      const key = a.promptName.toLowerCase().replace(/ /g, '_');
      acc[key] = {
        result: a.result,
        success: a.success,
        error: a.error,
      };
      return acc;
    }, {} as Record<string, any>);

    await icMemosRepository.complete(
      memoId,
      memoContent,
      supportingAnalysesObj,
      recommendation as any,
      conviction
    );

    console.log(`[Lane C] IC Memo completed for ${ticker}`);
    return { success: true };
  } catch (error) {
    console.error(`[Lane C] Error processing IC Memo for ${ticker}:`, error);
    await icMemosRepository.markFailed(memoId, (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Run Lane C IC Memo generation
 */
export async function runLaneC(config: LaneCConfig = {}): Promise<LaneCResult> {
  const startTime = Date.now();
  const { dryRun = false, maxMemos = 5, memoIds } = config;

  console.log(`[Lane C] Starting IC Memo generation run`);
  console.log(`[Lane C] Config: dryRun=${dryRun}, maxMemos=${maxMemos}`);

  const result: LaneCResult = {
    success: true,
    memosStarted: 0,
    memosCompleted: 0,
    memosFailed: 0,
    errors: [],
    duration_ms: 0,
    memos: [],
  };

  try {
    // Initialize LLM client
    const llm = createResilientClient();

    // Get pending memos
    let pendingMemos;
    if (memoIds && memoIds.length > 0) {
      pendingMemos = await Promise.all(
        memoIds.map(id => icMemosRepository.getById(id))
      );
      pendingMemos = pendingMemos.filter(m => m !== null);
    } else {
      pendingMemos = await icMemosRepository.getPending(maxMemos);
    }

    if (pendingMemos.length === 0) {
      console.log('[Lane C] No pending IC Memos to process');
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    console.log(`[Lane C] Found ${pendingMemos.length} pending IC Memos`);

    if (dryRun) {
      console.log('[Lane C] Dry run - not processing memos');
      result.memosStarted = pendingMemos.length;
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    // Process each memo
    for (const memo of pendingMemos) {
      if (!memo) continue;
      
      result.memosStarted++;
      console.log(`[Lane C] Processing IC Memo for ${memo.ticker} (${memo.memoId})`);

      const processResult = await processICMemo(
        memo.memoId,
        memo.packetId,
        memo.ticker,
        llm
      );

      if (processResult.success) {
        result.memosCompleted++;
        result.memos.push({
          memoId: memo.memoId,
          ticker: memo.ticker,
          status: 'completed',
        });
      } else {
        result.memosFailed++;
        result.errors.push(`${memo.ticker}: ${processResult.error}`);
        result.memos.push({
          memoId: memo.memoId,
          ticker: memo.ticker,
          status: 'failed',
          error: processResult.error,
        });
      }
    }

    result.success = result.memosFailed === 0;
    result.duration_ms = Date.now() - startTime;

    console.log(`[Lane C] Run completed: ${result.memosCompleted} completed, ${result.memosFailed} failed`);
    return result;
  } catch (error) {
    console.error('[Lane C] Fatal error:', error);
    result.success = false;
    result.errors.push((error as Error).message);
    result.duration_ms = Date.now() - startTime;
    return result;
  }
}

export default runLaneC;
