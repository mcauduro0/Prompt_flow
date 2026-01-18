/**
 * ARC Investment Factory - Lane C IC Memo Runner
 * 
 * Pipeline: select_pending_memos → fetch_research_packet → fetch_live_data → run_roic_decomposition → run_supporting_prompts → generate_ic_memo → persist
 * 
 * This runner orchestrates the IC Memo generation process for approved research packets.
 * It fetches live data from APIs (Polygon, FMP, FRED) and executes supporting prompts to enrich the research.
 * NEW: Includes ROIC Decomposition analysis (3-step: Gross Margin, Capital Efficiency, ROIC Stress Test)
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
import { runROICDecompositionForICMemo, type ROICDecompositionResult, type ROICDecomposition } from './roic-decomposition-runner.js';

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
- Average Daily Volume: [[avg_volume]]
- Beta: [[beta]]

Research Data:
[[research_summary]]

Respond in JSON format:
{
  "recommended_weight": "underweight|market_weight|overweight|high_conviction",
  "max_position_pct": number (0-10),
  "entry_strategy": "string",
  "exit_triggers": ["array of exit triggers"],
  "risk_management": "string",
  "rationale": "string"
}`,

  'Catalyst Timeline': `You are an expert investment analyst. Based on the following research on [[ticker]] ([[company_name]]), identify and timeline potential catalysts.

CURRENT MARKET DATA (as of [[data_date]]):
- Current Price: $[[current_price]]
- Next Earnings Date: [[next_earnings_date]]

Research Data:
[[research_summary]]

Respond in JSON format:
{
  "catalysts": [
    {
      "event": "string",
      "expected_date": "YYYY-MM-DD or Q1 2025 format",
      "probability": 0-100,
      "impact": "high|medium|low",
      "direction": "positive|negative|uncertain",
      "description": "string"
    }
  ],
  "monitoring_checklist": ["array of things to monitor"],
  "key_dates": ["array of important dates"]
}`,

  'Risk Assessment': `You are an expert risk analyst. Based on the following research on [[ticker]] ([[company_name]]), provide a comprehensive risk assessment.

CURRENT MARKET DATA (as of [[data_date]]):
- Current Price: $[[current_price]]
- Market Cap: $[[market_cap]]
- Debt/Equity: [[debt_equity]]
- Current Ratio: [[current_ratio]]

MACRO ENVIRONMENT:
[[macro_data]]

Research Data:
[[research_summary]]

Respond in JSON format:
{
  "risk_score": 1-10 (10 = highest risk),
  "key_risks": [
    {
      "risk": "string",
      "severity": "high|medium|low",
      "probability": 0-100,
      "mitigation": "string"
    }
  ],
  "tail_risks": ["array of low probability but high impact risks"],
  "risk_reward_ratio": number,
  "max_drawdown_estimate": number (percentage)
}`
};

export interface LaneCConfig {
  dryRun?: boolean;
  maxMemos?: number;
  memoIds?: string[];
  includeROICDecomposition?: boolean;
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
    roicDurabilityScore?: number;
  }>;
}

interface SupportingAnalysis {
  promptName: string;
  result: any;
  success: boolean;
  error?: string;
}

interface MacroData {
  gdp_growth?: number;
  unemployment?: number;
  fed_funds_rate?: number;
  inflation?: number;
  treasury_10y?: number;
}

/**
 * Fetch live market data for a ticker
 */
async function fetchLiveData(ticker: string): Promise<AggregatedCompanyData | null> {
  try {
    const aggregator = createDataAggregator();
    const data = await aggregator.getCompanyData(ticker);
    console.log(`[Lane C] Fetched live data for ${ticker}: price=$${data.latestPrice?.close || 'N/A'}`);
    return data;
  } catch (error) {
    console.error(`[Lane C] Error fetching live data for ${ticker}:`, error);
    return null;
  }
}

/**
 * Fetch macro economic data
 */
async function fetchMacroData(): Promise<MacroData> {
  try {
    const aggregator = createDataAggregator();
    const macro = await aggregator.getMacroIndicators();
    return {
      gdp_growth: (macro as any).gdp_growth,
      unemployment: (macro as any).unemployment,
      fed_funds_rate: macro.fed_funds_rate,
      inflation: (macro as any).cpi,
      treasury_10y: macro.treasury_10y,
    };
  } catch (error) {
    console.error('[Lane C] Error fetching macro data:', error);
    return {};
  }
}

/**
 * Format macro data for prompt injection
 */
function formatMacroData(macro: MacroData): string {
  const lines = [];
  if (macro.gdp_growth !== undefined) lines.push(`- GDP Growth: ${macro.gdp_growth}%`);
  if (macro.unemployment !== undefined) lines.push(`- Unemployment: ${macro.unemployment}%`);
  if (macro.fed_funds_rate !== undefined) lines.push(`- Fed Funds Rate: ${macro.fed_funds_rate}%`);
  if (macro.inflation !== undefined) lines.push(`- Inflation (CPI): ${macro.inflation}%`);
  if (macro.treasury_10y !== undefined) lines.push(`- 10Y Treasury: ${macro.treasury_10y}%`);
  return lines.length > 0 ? lines.join('\n') : 'Macro data not available';
}

/**
 * Execute a supporting prompt with live data
 */
async function executeSupportingPrompt(
  promptName: string,
  ticker: string,
  companyName: string,
  researchSummary: string,
  liveData: AggregatedCompanyData | null,
  macroData: MacroData,
  llm: LLMClient
): Promise<SupportingAnalysis> {
  try {
    const template = SUPPORTING_PROMPT_TEMPLATES[promptName];
    if (!template) {
      return { promptName, result: null, success: false, error: 'Template not found' };
    }

    // Replace placeholders with live data
    let prompt = template
      .replace(/\[\[ticker\]\]/g, ticker)
      .replace(/\[\[company_name\]\]/g, companyName)
      .replace(/\[\[research_summary\]\]/g, researchSummary)
      .replace(/\[\[macro_data\]\]/g, formatMacroData(macroData))
      .replace(/\[\[data_date\]\]/g, new Date().toISOString().split('T')[0]);

    // Replace market data placeholders
    if (liveData?.latestPrice || liveData?.profile) {
      prompt = prompt
        .replace(/\[\[current_price\]\]/g, String(liveData.latestPrice?.close || 'N/A'))
        .replace(/\[\[market_cap\]\]/g, formatNumber(liveData.profile?.marketCap || undefined))
        .replace(/\[\[pe_ratio\]\]/g, String(liveData.metrics?.pe || 'N/A'))
        .replace(/\[\[ev_ebitda\]\]/g, String(liveData.metrics?.evToEbitda || 'N/A'))
        .replace(/\[\[price_low_52w\]\]/g, 'N/A')
        .replace(/\[\[price_high_52w\]\]/g, 'N/A')
        .replace(/\[\[avg_volume\]\]/g, 'N/A')
        .replace(/\[\[beta\]\]/g, 'N/A')
        .replace(/\[\[debt_equity\]\]/g, String(liveData.metrics?.netDebtToEbitda || 'N/A'))
        .replace(/\[\[current_ratio\]\]/g, String(liveData.metrics?.currentRatio || 'N/A'))
        .replace(/\[\[next_earnings_date\]\]/g, 'TBD');
    } else {
      // Replace with N/A if no live data
      prompt = prompt.replace(/\[\[[^\]]+\]\]/g, 'N/A');
    }

    const request: LLMRequest = {
      messages: [
        { role: 'system', content: 'You are an expert investment analyst. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      maxTokens: 4000,
    };

    const response = await llm.complete(request);
    
    // Parse JSON response
    let result;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      result = { raw: response.content };
    }

    return { promptName, result, success: true };
  } catch (error) {
    console.error(`[Lane C] Error executing ${promptName}:`, error);
    return { promptName, result: null, success: false, error: (error as Error).message };
  }
}

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return 'N/A';
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return num.toLocaleString();
}

/**
 * Generate the final IC Memo content
 */
async function generateICMemo(
  ticker: string,
  companyName: string,
  styleTag: string,
  researchSummary: string,
  supportingAnalyses: SupportingAnalysis[],
  roicDecomposition: ROICDecompositionResult | null,
  liveData: AggregatedCompanyData | null,
  macroData: MacroData,
  llm: LLMClient
): Promise<any> {
  const analysesText = supportingAnalyses
    .filter(a => a.success)
    .map(a => `### ${a.promptName}\n${JSON.stringify(a.result, null, 2)}`)
    .join('\n\n');

  // Add ROIC Decomposition to the memo if available
  let roicText = '';
  if (roicDecomposition?.success && roicDecomposition.data) {
    roicText = `
### ROIC Decomposition Analysis

#### Step 1: Gross Margin Reality Check
${JSON.stringify(roicDecomposition.data.gross_margin_analysis, null, 2)}

#### Step 2: Capital Efficiency Check
${JSON.stringify(roicDecomposition.data.capital_efficiency_analysis, null, 2)}

#### Step 3: ROIC Stress Test
${JSON.stringify(roicDecomposition.data.roic_stress_test, null, 2)}

**ROIC Durability Score: ${roicDecomposition.data.roic_stress_test?.scores?.overall_roic_durability_score || 'N/A'}/10**
**Number One Thing to Watch: ${roicDecomposition.data.roic_stress_test?.number_one_thing_to_watch || 'N/A'}**
`;
  }

  const prompt = `You are an expert investment analyst preparing an Investment Committee (IC) Memo.

Based on the following research and supporting analyses for ${ticker} (${companyName}), generate a comprehensive IC Memo.

## Style Tag: ${styleTag}

## Current Market Data
- Price: $${liveData?.latestPrice?.close || 'N/A'}
- Market Cap: ${formatNumber(liveData?.profile?.marketCap || undefined)}
- P/E: ${liveData?.metrics?.pe || 'N/A'}

## Macro Environment
${formatMacroData(macroData)}

## Original Research Summary
${researchSummary}

## Supporting Analyses
${analysesText}

${roicText}

Generate a structured IC Memo in JSON format with:
{
  "executive_summary": "2-3 paragraph summary of the investment thesis",
  "decision": {
    "recommendation": "strong_buy|buy|hold|sell|strong_sell",
    "conviction": 1-10,
    "time_horizon": "string",
    "target_price": number or null
  },
  "thesis": {
    "core_thesis": "string",
    "key_drivers": ["array"],
    "variant_perception": "string"
  },
  "valuation": {
    "current_valuation": "string",
    "fair_value_range": { "low": number, "mid": number, "high": number },
    "methodology": "string"
  },
  "risks": {
    "key_risks": ["array"],
    "mitigants": ["array"],
    "kill_switch": "what would make us exit immediately"
  },
  "catalysts": ["array of upcoming catalysts"],
  "position_sizing": {
    "recommended_weight": "string",
    "max_position": "string",
    "entry_strategy": "string"
  },
  "roic_analysis": {
    "durability_score": number or null,
    "gross_margin_quality": "string",
    "capital_efficiency": "string",
    "key_watch_item": "string"
  },
  "monitoring": {
    "key_metrics": ["array"],
    "review_triggers": ["array"]
  }
}`;

  const request: LLMRequest = {
    messages: [
      { role: 'system', content: 'You are an expert investment analyst. Respond only with valid JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.4,
    maxTokens: 6000,
  };

  const response = await llm.complete(request);
  
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: response.content };
  } catch {
    return { raw: response.content };
  }
}

/**
 * Calculate conviction score based on analysis
 */
function calculateConviction(
  memoContent: any,
  supportingAnalyses: SupportingAnalysis[],
  roicDecomposition: ROICDecompositionResult | null,
  liveData: AggregatedCompanyData | null
): number {
  let conviction = memoContent?.decision?.conviction || 5;
  
  // Adjust based on ROIC durability score if available
  if (roicDecomposition?.success && roicDecomposition.data?.roic_stress_test?.scores?.overall_roic_durability_score) {
    const roicScore = roicDecomposition.data.roic_stress_test.scores.overall_roic_durability_score;
    // Blend ROIC score with base conviction (20% weight)
    conviction = Math.round(conviction * 0.8 + roicScore * 0.2);
  }
  
  // Adjust based on successful analyses
  const successfulAnalyses = supportingAnalyses.filter(a => a.success).length;
  const totalAnalyses = supportingAnalyses.length;
  if (totalAnalyses > 0 && successfulAnalyses < totalAnalyses * 0.5) {
    conviction = Math.max(1, conviction - 1); // Reduce conviction if many analyses failed
  }
  
  return Math.min(10, Math.max(1, conviction));
}

/**
 * Process a single IC Memo
 */
async function processICMemo(
  memoId: string,
  packetId: string,
  ticker: string,
  llm: LLMClient,
  includeROIC: boolean = true
): Promise<{ success: boolean; error?: string; roicDurabilityScore?: number }> {
  try {
    console.log(`[Lane C] Starting IC Memo generation for ${ticker}`);
    
    // Update status to generating
    await icMemosRepository.updateStatus(memoId, 'generating');
    await icMemosRepository.updateProgress(memoId, 5);

    // Fetch research packet
    const packet = await researchPacketsRepository.getById(packetId);
    if (!packet) {
      throw new Error(`Research packet not found: ${packetId}`);
    }

    const idea = await ideasRepository.getById(packet.ideaId);
    const companyName = idea?.companyName || packet.ticker;
    const styleTag = idea?.styleTag || 'Quality';

    await icMemosRepository.updateProgress(memoId, 10);

    // Fetch live market data
    console.log(`[Lane C] Fetching live data for ${ticker}...`);
    const liveData = await fetchLiveData(ticker);
    const macroData = await fetchMacroData();
    
    await icMemosRepository.updateProgress(memoId, 15);

    // Prepare research summary
    const decisionBrief = packet.decisionBrief as any || {};
    const researchSummary = JSON.stringify({
      thesis: decisionBrief.thesis,
      moat: decisionBrief.moat_assessment,
      valuation: decisionBrief.valuation_summary,
      risks: decisionBrief.key_risks,
      recommendation: decisionBrief.recommendation,
      conviction: decisionBrief.conviction,
    }, null, 2);

    // Run ROIC Decomposition (NEW)
    let roicDecomposition: ROICDecompositionResult | null = null;
    if (includeROIC) {
      console.log(`[Lane C] Running ROIC Decomposition for ${ticker}...`);
      await icMemosRepository.updateProgress(memoId, 20);
      
      try {
        roicDecomposition = await runROICDecompositionForICMemo(
          ticker,
          packet.ideaId,
          packetId
        );
        
        if (roicDecomposition.success) {
          console.log(`[Lane C] ROIC Decomposition completed for ${ticker}: Durability Score ${roicDecomposition.data?.roic_stress_test?.scores?.overall_roic_durability_score}/10`);
        } else {
          console.warn(`[Lane C] ROIC Decomposition failed for ${ticker}:`, roicDecomposition.errors);
        }
      } catch (error) {
        console.error(`[Lane C] ROIC Decomposition error for ${ticker}:`, error);
        // Continue without ROIC - it's not critical
      }
      
      await icMemosRepository.updateProgress(memoId, 35);
    }

    // Execute supporting prompts with live data
    const supportingAnalyses: SupportingAnalysis[] = [];
    const promptNames = Object.keys(SUPPORTING_PROMPT_TEMPLATES);
    const progressPerPrompt = 35 / promptNames.length;

    for (let i = 0; i < promptNames.length; i++) {
      const promptName = promptNames[i];
      console.log(`[Lane C] Running ${promptName} for ${ticker}...`);
      
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
      await icMemosRepository.updateProgress(memoId, Math.round(35 + (i + 1) * progressPerPrompt));
    }

    await icMemosRepository.updateProgress(memoId, 75);

    // Generate the final IC Memo with live data and ROIC
    console.log(`[Lane C] Generating final IC Memo for ${ticker}...`);
    const memoContent = await generateICMemo(
      ticker,
      companyName,
      styleTag,
      researchSummary,
      supportingAnalyses,
      roicDecomposition,
      liveData,
      macroData,
      llm
    );

    await icMemosRepository.updateProgress(memoId, 90);

    // Extract recommendation from the memo
    const recommendation = memoContent?.decision?.recommendation || 'hold';
    
    // Calculate dynamic conviction based on analysis (including ROIC)
    const conviction = calculateConviction(memoContent, supportingAnalyses, roicDecomposition, liveData);
    
    console.log(`[Lane C] Calculated conviction for ${ticker}: ${conviction} (recommendation: ${recommendation})`);

    await icMemosRepository.updateProgress(memoId, 95);

    // Build supporting analyses object including ROIC
    const supportingAnalysesObj = supportingAnalyses.reduce((acc, a) => {
      const key = a.promptName.toLowerCase().replace(/ /g, '_');
      acc[key] = {
        result: a.result,
        success: a.success,
        error: a.error,
      };
      return acc;
    }, {} as Record<string, any>);

    // Add ROIC Decomposition to supporting analyses
    if (roicDecomposition) {
      supportingAnalysesObj['roic_decomposition'] = {
        result: roicDecomposition.data,
        success: roicDecomposition.success,
        errors: roicDecomposition.errors,
        durability_score: roicDecomposition.data?.roic_stress_test?.scores?.overall_roic_durability_score,
        gross_margin_classification: (roicDecomposition.data?.gross_margin_analysis as any)?.classification,
        capital_efficiency_classification: (roicDecomposition.data?.capital_efficiency_analysis as any)?.classification,
        number_one_thing_to_watch: roicDecomposition.data?.roic_stress_test?.number_one_thing_to_watch,
      };
    }

    // Save the completed memo
    await icMemosRepository.complete(
      memoId,
      memoContent,
      supportingAnalysesObj,
      recommendation as any,
      conviction
    );

    const roicDurabilityScore = roicDecomposition?.data?.roic_stress_test?.scores?.overall_roic_durability_score;
    console.log(`[Lane C] IC Memo completed for ${ticker} with conviction ${conviction}${roicDurabilityScore !== undefined ? `, ROIC Durability: ${roicDurabilityScore}/10` : ''}`);
    
    return { success: true, roicDurabilityScore };
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
  const { dryRun = false, maxMemos = 5, memoIds, includeROICDecomposition = true } = config;

  console.log(`[Lane C] Starting IC Memo generation run`);
  console.log(`[Lane C] Config: dryRun=${dryRun}, maxMemos=${maxMemos}, includeROIC=${includeROICDecomposition}`);

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
        llm,
        includeROICDecomposition
      );

      if (processResult.success) {
        result.memosCompleted++;
        result.memos.push({
          memoId: memo.memoId,
          ticker: memo.ticker,
          status: 'completed',
          roicDurabilityScore: processResult.roicDurabilityScore,
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
 * Process a single IC Memo with ROIC Decomposition
 * Exported wrapper function that creates its own LLM client
 */
export async function processICMemoSingle(
  memoId: string,
  packetId: string,
  includeROIC: boolean = true
): Promise<{ success: boolean; error?: string; roicDurabilityScore?: number }> {
  console.log(`[Lane C] processICMemoSingle called for memo ${memoId}`);
  
  // Get memo to find ticker
  const memo = await icMemosRepository.getById(memoId);
  if (!memo) {
    return { success: false, error: 'IC Memo not found' };
  }
  
  // Create LLM client
  const llm = createResilientClient();
  
  // Process the memo
  return processICMemo(memoId, packetId, memo.ticker, llm, includeROIC);
}
