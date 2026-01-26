/**
 * ARC Investment Factory - Lane C IC Memo Runner
 * 
 * Pipeline: select_pending_memos → fetch_research_packet → fetch_live_data → run_supporting_prompts → generate_ic_memo → persist
 * 
 * This runner orchestrates the IC Memo generation process for approved research packets.
 * It fetches live data from APIs (Polygon, FMP, FRED) and executes supporting prompts to enrich the research.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  icMemosRepository,
  researchPacketsRepository,
  ideasRepository,
} from '@arc/database';
import { createResilientClient, type LLMClient, type LLMRequest } from '@arc/llm-client';
import { createDataAggregator, type AggregatedCompanyData } from '@arc/retriever';
import { telemetry } from '@arc/database';
import { runROICDecompositionForICMemo } from './roic-decomposition-runner.js';

// Supporting prompt definitions (hardcoded to avoid schema validation issues)
const SUPPORTING_PROMPT_TEMPLATES: Record<string, string> = {
  'Variant Perception': `You are an expert investment analyst specializing in identifying variant perceptions.

Analyze the following research on [[ticker]] ([[company_name]]) and identify:
1. What is the consensus view on this company?
2. What is our differentiated view?
3. Why might the market be wrong?
4. What facts would confirm our view?
5. What facts would invalidate our view?

CURRENT MARKET DATA (as of [[data_date]]):
- Current Price: $[[current_price]]
- Market Cap: $[[market_cap]]
- P/E Ratio: [[pe_ratio]]
- 52-Week Range: $[[price_low_52w]] - $[[price_high_52w]]

MACRO ENVIRONMENT:
[[macro_data]]

Research Data:
[[research_summary]]

Respond in JSON format:
{
  "consensus_view": "string",
  "our_view": "string",
  "why_market_wrong": "string",
  "confirming_facts": ["array of facts"],
  "invalidating_facts": ["array of facts"],
  "confidence": 1-10
}`,

  'Bull Bear Analysis': `You are an expert investment analyst. Analyze the following research on [[ticker]] ([[company_name]]) and provide:

1. Bull Case: The most optimistic but realistic scenario
2. Bear Case: The most pessimistic but realistic scenario
3. Base Case: The most likely scenario
4. Key debates and uncertainties

CURRENT MARKET DATA (as of [[data_date]]):
- Current Price: $[[current_price]]
- Market Cap: $[[market_cap]]
- P/E Ratio: [[pe_ratio]]
- EV/EBITDA: [[ev_ebitda]]

Research Data:
[[research_summary]]

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

  'Position Sizing': `You are an expert portfolio manager. Based on the following research on [[ticker]] ([[company_name]]), recommend an appropriate position size.

Consider:
1. Conviction level based on the analysis
2. Risk/reward asymmetry from current price of $[[current_price]]
3. Liquidity (average daily volume, market cap)
4. Portfolio concentration
5. Correlation with existing holdings

CURRENT MARKET DATA (as of [[data_date]]):
- Current Price: $[[current_price]]
- Market Cap: $[[market_cap]]
- Average Volume: [[avg_volume]]
- Beta: [[beta]]

Research Data:
[[research_summary]]

Respond in JSON format:
{
  "recommended_size": "string (e.g., 2-3% of portfolio)",
  "sizing_rationale": "string",
  "max_position": "string",
  "scaling_strategy": "string",
  "liquidity_assessment": "string",
  "risk_adjusted_size": "string"
}`,

  'Pre Mortem Analysis': `You are an expert risk analyst. Conduct a pre-mortem analysis for an investment in [[ticker]] ([[company_name]]).

Imagine the investment has failed completely. What went wrong?

CURRENT MARKET DATA (as of [[data_date]]):
- Current Price: $[[current_price]]
- Market Cap: $[[market_cap]]

MACRO ENVIRONMENT:
[[macro_data]]

Research Data:
[[research_summary]]

Respond in JSON format:
{
  "failure_scenarios": [
    {
      "scenario": "string",
      "probability": "high/medium/low",
      "warning_signs": ["array"],
      "mitigation": "string"
    }
  ],
  "most_likely_failure_mode": "string",
  "early_warning_indicators": ["array"],
  "kill_switch_triggers": ["array"]
}`,

  'Exit Strategy': `You are an expert portfolio manager. Define exit strategies for an investment in [[ticker]] ([[company_name]]).

CURRENT MARKET DATA (as of [[data_date]]):
- Current Price: $[[current_price]]
- 52-Week High: $[[price_high_52w]]
- 52-Week Low: $[[price_low_52w]]

Research Data:
[[research_summary]]

Respond in JSON format:
{
  "profit_taking_targets": [
    {
      "target_price": number,
      "percentage_to_sell": number,
      "rationale": "string"
    }
  ],
  "stop_loss_levels": [
    {
      "price": number,
      "type": "hard/trailing/mental",
      "rationale": "string"
    }
  ],
  "thesis_invalidation_triggers": ["array"],
  "time_based_review": "string",
  "rebalancing_rules": "string"
}`,

  'Catalyst Identification': `You are an expert event-driven analyst. Identify potential catalysts for [[ticker]] ([[company_name]]).

CURRENT MARKET DATA (as of [[data_date]]):
- Current Price: $[[current_price]]
- Next Earnings: [[next_earnings_date]]

MACRO ENVIRONMENT:
[[macro_data]]

Research Data:
[[research_summary]]

Respond in JSON format:
{
  "near_term_catalysts": [
    {
      "catalyst": "string",
      "expected_timing": "string",
      "potential_impact": "high/medium/low",
      "probability": "high/medium/low"
    }
  ],
  "medium_term_catalysts": [
    {
      "catalyst": "string",
      "expected_timing": "string",
      "potential_impact": "high/medium/low",
      "probability": "high/medium/low"
    }
  ],
  "long_term_catalysts": ["array"],
  "negative_catalysts_to_watch": ["array"],
  "catalyst_calendar": "string"
}`,

  'Risk Assessment': `You are an expert risk analyst. Provide a comprehensive risk assessment for [[ticker]] ([[company_name]]).

CURRENT MARKET DATA (as of [[data_date]]):
- Current Price: $[[current_price]]
- Beta: [[beta]]
- Debt/Equity: [[debt_equity]]

MACRO ENVIRONMENT:
[[macro_data]]

Research Data:
[[research_summary]]

Respond in JSON format:
{
  "company_specific_risks": [
    {
      "risk": "string",
      "severity": "high/medium/low",
      "probability": "high/medium/low",
      "mitigation": "string"
    }
  ],
  "industry_risks": [
    {
      "risk": "string",
      "severity": "high/medium/low",
      "probability": "high/medium/low",
      "mitigation": "string"
    }
  ],
  "macro_risks": [
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

interface LiveMarketData {
  currentPrice: number | null;
  marketCap: number | null;
  peRatio: number | null;
  evEbitda: number | null;
  beta: number | null;
  debtEquity: number | null;
  avgVolume: number | null;
  priceHigh52w: number | null;
  priceLow52w: number | null;
  nextEarningsDate: string | null;
  dataDate: string;
}

interface MacroData {
  gdpGrowth: number | null;
  unemployment: number | null;
  inflation: number | null;
  fedFundsRate: number | null;
  tenYearYield: number | null;
  vix: number | null;
}

/**
 * Fetch live market data from APIs
 */
async function fetchLiveMarketData(ticker: string): Promise<LiveMarketData> {
  console.log(`[Lane C] Fetching live market data for ${ticker}`);
  
  const result: LiveMarketData = {
    currentPrice: null,
    marketCap: null,
    peRatio: null,
    evEbitda: null,
    beta: null,
    debtEquity: null,
    avgVolume: null,
    priceHigh52w: null,
    priceLow52w: null,
    nextEarningsDate: null,
    dataDate: new Date().toISOString().split('T')[0],
  };

  try {
    const aggregator = createDataAggregator({
      fmpApiKey: process.env.FMP_API_KEY,
      polygonApiKey: process.env.POLYGON_API_KEY,
    });

    const companyData = await aggregator.getCompanyData(ticker, {
      includeFinancials: true,
      includePriceHistory: false,
      includeNews: false,
      includeFilings: false,
      includeMacro: false,
    });

    if (companyData.latestPrice) {
      result.currentPrice = companyData.latestPrice.close;
      result.priceHigh52w = companyData.latestPrice.high;
      result.priceLow52w = companyData.latestPrice.low;
    }

    if (companyData.profile) {
      result.marketCap = companyData.profile.marketCap || null;
    }

    if (companyData.metrics) {
      result.peRatio = companyData.metrics.pe || null;
      result.evEbitda = companyData.metrics.evToEbitda || null;
      result.debtEquity = companyData.metrics.netDebtToEbitda || null;
    }

    console.log(`[Lane C] Live data fetched: price=$${result.currentPrice}, mktCap=$${result.marketCap}`);
  } catch (error) {
    console.error(`[Lane C] Error fetching live market data for ${ticker}:`, error);
  }

  return result;
}

/**
 * Fetch macro economic data from FRED
 */
async function fetchMacroData(): Promise<MacroData> {
  console.log(`[Lane C] Fetching macro data from FRED`);
  
  const result: MacroData = {
    gdpGrowth: null,
    unemployment: null,
    inflation: null,
    fedFundsRate: null,
    tenYearYield: null,
    vix: null,
  };

  try {
    const aggregator = createDataAggregator({
      fmpApiKey: process.env.FMP_API_KEY,
      polygonApiKey: process.env.POLYGON_API_KEY,
    });

    // Try to get macro indicators
    const companyData = await aggregator.getCompanyData('SPY', {
      includeFinancials: false,
      includePriceHistory: false,
      includeNews: false,
      includeFilings: false,
      includeMacro: true,
    });

    if (companyData.macroIndicators) {
      result.gdpGrowth = companyData.macroIndicators.gdp_growth || null;
      result.unemployment = companyData.macroIndicators.unemployment_rate || null;
      result.inflation = companyData.macroIndicators.inflation_cpi || null;
      result.fedFundsRate = companyData.macroIndicators.fed_funds_rate || null;
      result.tenYearYield = companyData.macroIndicators.treasury_10y || null;
      result.vix = companyData.macroIndicators.vix || null;
    }

    console.log(`[Lane C] Macro data fetched: GDP=${result.gdpGrowth}%, Unemployment=${result.unemployment}%`);
  } catch (error) {
    console.error(`[Lane C] Error fetching macro data:`, error);
  }

  return result;
}

/**
 * Format macro data for prompts
 */
function formatMacroData(macro: MacroData): string {
  const lines: string[] = [];
  
  if (macro.gdpGrowth !== null) lines.push(`- GDP Growth: ${macro.gdpGrowth}%`);
  if (macro.unemployment !== null) lines.push(`- Unemployment Rate: ${macro.unemployment}%`);
  if (macro.inflation !== null) lines.push(`- Inflation (CPI YoY): ${macro.inflation}%`);
  if (macro.fedFundsRate !== null) lines.push(`- Fed Funds Rate: ${macro.fedFundsRate}%`);
  if (macro.tenYearYield !== null) lines.push(`- 10-Year Treasury Yield: ${macro.tenYearYield}%`);
  if (macro.vix !== null) lines.push(`- VIX: ${macro.vix}`);
  
  return lines.length > 0 ? lines.join('\n') : 'Macro data unavailable';
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
 * Execute a supporting prompt with live data
 */
async function executeSupportingPrompt(
  promptName: string,
  ticker: string,
  companyName: string,
  researchSummary: string,
  liveData: LiveMarketData,
  macroData: MacroData,
  llm: LLMClient,
  memoId?: string
): Promise<SupportingAnalysis> {
  console.log(`[Lane C] Executing supporting prompt: ${promptName} for ${ticker}`);
  const startTime = Date.now();
  
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
    // Fill in the template with live data
    const filledPrompt = template
      .replace(/\[\[ticker\]\]/g, ticker)
      .replace(/\[\[company_name\]\]/g, companyName)
      .replace(/\[\[research_summary\]\]/g, researchSummary)
      .replace(/\[\[current_price\]\]/g, liveData.currentPrice?.toFixed(2) || 'N/A')
      .replace(/\[\[market_cap\]\]/g, liveData.marketCap ? `${(liveData.marketCap / 1e9).toFixed(2)}B` : 'N/A')
      .replace(/\[\[pe_ratio\]\]/g, liveData.peRatio?.toFixed(2) || 'N/A')
      .replace(/\[\[ev_ebitda\]\]/g, liveData.evEbitda?.toFixed(2) || 'N/A')
      .replace(/\[\[beta\]\]/g, liveData.beta?.toFixed(2) || 'N/A')
      .replace(/\[\[debt_equity\]\]/g, liveData.debtEquity?.toFixed(2) || 'N/A')
      .replace(/\[\[avg_volume\]\]/g, liveData.avgVolume ? `${(liveData.avgVolume / 1e6).toFixed(2)}M` : 'N/A')
      .replace(/\[\[price_high_52w\]\]/g, liveData.priceHigh52w?.toFixed(2) || 'N/A')
      .replace(/\[\[price_low_52w\]\]/g, liveData.priceLow52w?.toFixed(2) || 'N/A')
      .replace(/\[\[next_earnings_date\]\]/g, liveData.nextEarningsDate || 'TBD')
      .replace(/\[\[data_date\]\]/g, liveData.dataDate)
      .replace(/\[\[macro_data\]\]/g, formatMacroData(macroData));

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
      // Log telemetry for successful prompt
      if (memoId) {
        await telemetry.logSupportingPrompt({
          memoId,
          ticker,
          promptName,
          success: true,
          latencyMs: Date.now() - startTime,
          confidence: parseResult.data?.confidence,
        });
      }
      return {
        promptName,
        result: parseResult.data,
        success: true,
      };
    } else {
      console.warn(`[Lane C] Failed to parse ${promptName} response:`, parseResult.error);
      // Log telemetry for failed parse
      if (memoId) {
        await telemetry.logSupportingPrompt({
          memoId,
          ticker,
          promptName,
          success: false,
          latencyMs: Date.now() - startTime,
          errorMessage: parseResult.error,
        });
      }
      return {
        promptName,
        result: { _raw: response.content, _error: parseResult.error },
        success: false,
        error: parseResult.error,
      };
    }
  } catch (error) {
    console.error(`[Lane C] Error executing ${promptName}:`, error);
    // Log telemetry for error
    if (memoId) {
      await telemetry.logSupportingPrompt({
        memoId,
        ticker,
        promptName,
        success: false,
        latencyMs: Date.now() - startTime,
        errorMessage: (error as Error).message,
      });
    }
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
 * Calculate dynamic conviction score based on analysis
 */
function calculateConviction(
  memoContent: any,
  supportingAnalyses: SupportingAnalysis[],
  liveData: LiveMarketData
): number {
  let conviction = 50; // Base conviction
  
  // 1. Analyze variant perception confidence
  const variantPerception = supportingAnalyses.find(a => a.promptName === 'Variant Perception');
  if (variantPerception?.success && variantPerception.result?.confidence) {
    const vpConfidence = Number(variantPerception.result.confidence);
    if (!isNaN(vpConfidence)) {
      conviction += (vpConfidence - 5) * 3; // -15 to +15 adjustment
    }
  }
  
  // 2. Analyze bull/bear probability skew
  const bullBear = supportingAnalyses.find(a => a.promptName === 'Bull Bear Analysis');
  if (bullBear?.success && bullBear.result) {
    const bullProb = Number(bullBear.result.bull_case?.probability) || 25;
    const bearProb = Number(bullBear.result.bear_case?.probability) || 25;
    const skew = bullProb - bearProb;
    conviction += skew * 0.2; // -10 to +10 adjustment
  }
  
  // 3. Analyze valuation upside/downside
  if (memoContent?.valuation?.value_range && liveData.currentPrice) {
    const { bear, base, bull } = memoContent.valuation.value_range;
    const currentPrice = liveData.currentPrice;
    
    if (bear && base && bull && currentPrice > 0) {
      const upside = ((base - currentPrice) / currentPrice) * 100;
      const downside = ((currentPrice - bear) / currentPrice) * 100;
      const ratio = upside / Math.max(downside, 1);
      
      if (ratio > 2) conviction += 10;
      else if (ratio > 1.5) conviction += 5;
      else if (ratio < 0.5) conviction -= 10;
      else if (ratio < 0.75) conviction -= 5;
    }
  }
  
  // 4. Analyze risk assessment
  const riskAssessment = supportingAnalyses.find(a => a.promptName === 'Risk Assessment');
  if (riskAssessment?.success && riskAssessment.result?.overall_risk_rating) {
    const rating = riskAssessment.result.overall_risk_rating.toLowerCase();
    if (rating === 'low') conviction += 5;
    else if (rating === 'high') conviction -= 10;
  }
  
  // 5. Analyze pre-mortem severity
  const preMortem = supportingAnalyses.find(a => a.promptName === 'Pre Mortem Analysis');
  if (preMortem?.success && preMortem.result?.failure_scenarios) {
    const highProbFailures = preMortem.result.failure_scenarios.filter(
      (s: any) => s.probability === 'high'
    ).length;
    conviction -= highProbFailures * 5;
  }
  
  // Clamp conviction to 10-95 range
  return Math.max(10, Math.min(95, Math.round(conviction)));
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
  liveData: LiveMarketData,
  macroData: MacroData,
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
5. Based on CURRENT market data provided

CURRENT MARKET DATA (as of ${liveData.dataDate}):
- Current Price: $${liveData.currentPrice?.toFixed(2) || 'N/A'}
- Market Cap: $${liveData.marketCap ? (liveData.marketCap / 1e9).toFixed(2) + 'B' : 'N/A'}
- P/E Ratio: ${liveData.peRatio?.toFixed(2) || 'N/A'}
- EV/EBITDA: ${liveData.evEbitda?.toFixed(2) || 'N/A'}
- Beta: ${liveData.beta?.toFixed(2) || 'N/A'}

MACRO ENVIRONMENT:
${formatMacroData(macroData)}

Generate the IC Memo in the following JSON structure:
{
  "executive_summary": {
    "opportunity": "string - what is the investment opportunity",
    "why_now": "string - why is this the right time",
    "risk_reward_asymmetry": "string - what is the risk/reward profile",
    "decision_required": "string - what decision is needed from IC"
  },
  "investment_thesis": {
    "central_thesis": "string",
    "value_creation_mechanism": "string",
    "sustainability": "string",
    "structural_vs_cyclical": "string"
  },
  "business_analysis": {
    "business_model": "string",
    "competitive_advantages": ["array"],
    "competitive_weaknesses": ["array"],
    "industry_structure": "string"
  },
  "financial_quality": {
    "revenue_quality": "string",
    "margin_analysis": "string",
    "capital_intensity": "string",
    "roic_analysis": "string"
  },
  "valuation": {
    "methodology": "string",
    "key_assumptions": ["array"],
    "value_range": {
      "bear": number,
      "base": number,
      "bull": number
    },
    "sensitivities": ["array"],
    "expected_return": "string",
    "opportunity_cost": "string"
  },
  "risks": {
    "material_risks": [{"risk": "string", "mitigation": "string", "early_signals": ["array"]}],
    "thesis_error_risks": ["array"],
    "asymmetric_risks": ["array"]
  },
  "variant_perception": {
    "consensus_view": "string",
    "our_view": "string",
    "why_market_wrong": "string"
  },
  "catalysts": {
    "value_unlocking_events": [{"event": "string", "timing": "string", "probability": "string"}],
    "expected_horizon": "string"
  },
  "portfolio_fit": {
    "portfolio_role": "string",
    "correlation_assessment": "string",
    "sizing_rationale": "string"
  },
  "decision": {
    "recommendation": "strong_buy|buy|hold|reduce|sell|strong_sell",
    "conviction_rationale": "string - explain why this conviction level",
    "revisit_conditions": ["array"],
    "change_of_mind_triggers": ["array"]
  }
}

IMPORTANT: 
- The valuation value_range MUST use realistic price targets based on the current price of $${liveData.currentPrice?.toFixed(2) || 'N/A'}
- Bear case should typically be 20-40% below current price
- Bull case should typically be 30-80% above current price
- Base case should be your expected fair value
- The recommendation should be justified by the risk/reward from current price`;

  const userPrompt = `Generate an IC Memo for ${ticker} (${companyName}) - Style: ${styleTag}

## Research Summary
${researchSummary}

## Supporting Analyses
${supportingData}

Generate the complete IC Memo in JSON format.`;

  try {
    const request: LLMRequest = {
      messages: [
        { role: 'system', content: IC_MEMO_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      maxTokens: 8000,
    };

    const response = await llm.complete(request);
    const parseResult = parseJSONRobust(response.content);

    if (parseResult.success) {
      // Add live data to the memo
      parseResult.data._live_data = {
        current_price: liveData.currentPrice,
        market_cap: liveData.marketCap,
        pe_ratio: liveData.peRatio,
        data_date: liveData.dataDate,
      };
      parseResult.data._macro_data = macroData;
      return parseResult.data;
    } else {
      console.warn(`[Lane C] Failed to parse IC Memo response:`, parseResult.error);
      return {
        executive_summary: {
          opportunity: 'Failed to generate - see raw content',
          why_now: '',
          risk_reward_asymmetry: '',
          decision_required: 'Manual review required',
        },
        _raw_content: response.content,
        _parse_error: parseResult.error,
        _live_data: {
          current_price: liveData.currentPrice,
          market_cap: liveData.marketCap,
          pe_ratio: liveData.peRatio,
          data_date: liveData.dataDate,
        },
      };
    }
  } catch (error) {
    console.error(`[Lane C] Error generating IC Memo:`, error);
    return {
      executive_summary: {
        opportunity: 'Error generating memo',
        why_now: '',
        risk_reward_asymmetry: '',
        decision_required: 'Manual review required',
      },
      _error: (error as Error).message,
      _live_data: {
        current_price: liveData.currentPrice,
        market_cap: liveData.marketCap,
        pe_ratio: liveData.peRatio,
        data_date: liveData.dataDate,
      },
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

    await icMemosRepository.updateProgress(memoId, 8);

    // Fetch live market data from APIs
    console.log(`[Lane C] Fetching live data for ${ticker}...`);
    const liveData = await fetchLiveMarketData(ticker);
    await icMemosRepository.updateProgress(memoId, 12);

    // Fetch macro data
    const macroData = await fetchMacroData();
    await icMemosRepository.updateProgress(memoId, 15);

    // Prepare research summary
    const researchSummary = prepareResearchSummary(packet, idea);

    // Execute supporting prompts with live data
    const supportingAnalyses: SupportingAnalysis[] = [];
    const promptNames = Object.keys(SUPPORTING_PROMPT_TEMPLATES);
    const progressPerPrompt = 55 / promptNames.length;

    for (let i = 0; i < promptNames.length; i++) {
      const promptName = promptNames[i];
      const analysis = await executeSupportingPrompt(
        promptName,
        ticker,
        companyName,
        researchSummary,
        liveData,
        macroData,
        llm
      );
      supportingAnalyses.push(analysis);
      await icMemosRepository.updateProgress(memoId, Math.round(15 + (i + 1) * progressPerPrompt));
    }

    await icMemosRepository.updateProgress(memoId, 70);

    // Run ROIC Decomposition analysis
    console.log(`[Lane C] Running ROIC Decomposition for ${ticker}...`);
    let roicDecomposition = null;
    try {
      roicDecomposition = await runROICDecompositionForICMemo(ticker, packet.ideaId, packetId);
      console.log(`[Lane C] ROIC Decomposition completed for ${ticker}`);
    } catch (roicError) {
      console.error(`[Lane C] ROIC Decomposition failed for ${ticker}:`, roicError);
      // Continue without ROIC - it's not critical
    }
    await icMemosRepository.updateProgress(memoId, 75);

    // Generate the final IC Memo with live data
    const memoContent = await generateICMemo(
      ticker,
      companyName,
      styleTag,
      researchSummary,
      supportingAnalyses,
      liveData,
      macroData,
      llm
    );

    await icMemosRepository.updateProgress(memoId, 90);

    // Extract recommendation from the memo
    const recommendation = memoContent?.decision?.recommendation || 'hold';
    
    // Calculate dynamic conviction based on analysis
    const conviction = calculateConviction(memoContent, supportingAnalyses, liveData);
    
    console.log(`[Lane C] Calculated conviction for ${ticker}: ${conviction} (recommendation: ${recommendation})`);

    await icMemosRepository.updateProgress(memoId, 95);

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

    // Add ROIC Decomposition to supporting analyses if available
    if (roicDecomposition) {
      supportingAnalysesObj['roic_decomposition'] = {
        result: roicDecomposition,
        success: true,
        error: null,
      };
    }

    await icMemosRepository.complete(
      memoId,
      memoContent,
      supportingAnalysesObj,
      recommendation as any,
      conviction
    );

    // Update the original idea with the final Conviction Score from Lane C
    // This ensures the score is visible in Inbox/Queue/IC Memo views
    if (packet.ideaId) {
      try {
        await ideasRepository.updateScores(
          packet.ideaId,
          {
            total: conviction,
            edge_clarity: 0,
            business_quality_prior: 0,
            financial_resilience_prior: 0,
            valuation_tension: 0,
            catalyst_clarity: 0,
            information_availability: 0,
            complexity_penalty: 0,
            disclosure_friction_penalty: 0,
          },
          String(conviction),
          String(conviction)
        );
        console.log(`[Lane C] Updated idea ${packet.ideaId} with final conviction score: ${conviction}`);
      } catch (scoreError) {
        console.warn(`[Lane C] Failed to update idea score:`, scoreError);
      }
    }

    console.log(`[Lane C] IC Memo completed for ${ticker} with conviction ${conviction}`);
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
  } catch (error) {
    console.error('[Lane C] Fatal error:', error);
    result.success = false;
    result.errors.push((error as Error).message);
  }

  result.duration_ms = Date.now() - startTime;
  console.log(`[Lane C] Run completed in ${result.duration_ms}ms`);
  console.log(`[Lane C] Results: ${result.memosCompleted} completed, ${result.memosFailed} failed`);

  return result;
}


/**
 * Process a single IC Memo with ROIC Decomposition (for manual triggers)
 * This function is called by the scheduler for individual memo generation
 */
export async function processICMemoSingle(memoId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the memo details
    const memo = await icMemosRepository.getById(memoId);
    if (!memo) {
      throw new Error(`IC Memo not found: ${memoId}`);
    }

    // Initialize LLM client
    const llm = createResilientClient();

    // Process the memo using the existing function
    const result = await processICMemo(
      memo.memoId,
      memo.packetId,
      memo.ticker,
      llm
    );

    return result;
  } catch (error) {
    console.error(`[Lane C] Error in processICMemoSingle:`, error);
    return { success: false, error: (error as Error).message };
  }
}
