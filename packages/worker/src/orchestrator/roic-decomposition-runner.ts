/**
 * ARC Investment Factory - ROIC Decomposition Runner
 * Orchestrates the 3-step ROIC analysis for IC Memo building
 * 
 * Uses GPT-5.2 Pro (preferred) or Gemini 3.0 Pro with real market data from Polygon/FMP
 */
import { createResilientClient, type LLMClient } from '@arc/llm-client';
import { DataAggregator, type AggregatedCompanyData } from '@arc/retriever';

export interface ROICDecompositionConfig {
  ticker: string;
  ideaId: string;
  packetId: string;
  useGemini?: boolean;
  skipSteps?: ('gross_margin' | 'capital_efficiency' | 'roic_stress_test')[];
}

export interface ROICDecomposition {
  completed_at: string;
  model_used: string;
  gross_margin_analysis?: GrossMarginAnalysis;
  capital_efficiency_analysis?: CapitalEfficiencyAnalysis;
  roic_stress_test?: ROICStressTest;
}

export interface GrossMarginAnalysis {
  executive_summary: {
    current_state: string;
    money_engine: string;
    industry_vs_individual: string;
    strategic_verdict: string;
  };
  quantitative_anatomy: {
    cogs_deconstruction: Array<{
      cost_item: string;
      percentage_of_cogs: number | null;
      trend: string;
    }>;
    value_driver: string;
    value_driver_explanation: string;
    incremental_margin_analysis: {
      direction: string;
      explanation: string;
    };
  };
  qualitative_analysis: {
    mission_critical_test: {
      is_mission_critical: boolean;
      cost_of_failure: string;
    };
    switching_barrier: {
      barrier_strength: string;
      pain_points: string[];
    };
    clone_question: {
      defensible_assets: string[];
      clone_difficulty: string;
    };
  };
  pricing_power_stress_test: {
    inflation_pass_through: {
      passed_through: boolean;
      recovery_speed: string;
      notes: string;
    };
    elasticity_proof: {
      demand_elasticity: string;
      volume_impact: string;
    };
  };
  scores: {
    gross_margin_quality_score: number;
    gross_margin_durability_score: number;
    classification: string;
  };
  final_verdict: string;
}

export interface CapitalEfficiencyAnalysis {
  executive_summary: {
    key_findings: string[];
    classification: string;
    greatest_threat: string;
  };
  asset_intensity: {
    capital_anchors: {
      primary_assets: string[];
      capital_tied_up_in: string;
    };
    maintenance_vs_growth: {
      maintenance_capex_pct_of_ocf: number | null;
      cash_unlocked_if_no_growth: string;
    };
    scaling_mechanics: {
      owns_brain: boolean;
      outsources_brawn: boolean;
      capital_intensity_at_scale: string;
    };
  };
  working_capital: {
    funding_relationship: {
      dso_days: number | null;
      dpo_days: number | null;
      power_position: string;
      analysis: string;
    };
    cash_timing_reality: {
      timing_model: string;
      explanation: string;
    };
    inventory_velocity: {
      inventory_turnover: number | null;
      is_capital_accelerator: boolean;
      risks: string[];
    };
  };
  capital_turns: {
    capital_turns_trend: {
      five_year_trend: string;
      current_ratio: number | null;
      analysis: string;
    };
    structural_drivers: {
      positive_drivers: string[];
      negative_drivers: string[];
    };
    next_dollar_test: {
      roiic_assessment: string;
      explanation: string;
    };
  };
  risk_hierarchy: Array<{
    risk: string;
    category: string;
    severity: string;
  }>;
  final_verdict: string;
}

export interface ROICStressTest {
  executive_summary: {
    current_roic: number | null;
    five_year_trend: string;
    two_engines: {
      primary_driver: string;
      explanation: string;
    };
    fragility_map: {
      more_vulnerable_engine: string;
      reason: string;
    };
    number_one_threat: string;
  };
  gross_margin_stress: any;
  capital_turns_stress: any;
  reinvestment_quality_stress: any;
  industry_structural_risks: any;
  bear_case_scenarios: Array<{
    scenario_name: string;
    mechanism: string;
    timeline: string;
    roic_impact: string;
  }>;
  scores: {
    gross_margin_fragility_score: number;
    capital_turns_fragility_score: number;
    overall_roic_durability_score: number;
  };
  number_one_thing_to_watch: string;
}

export interface ROICDecompositionResult {
  success: boolean;
  data?: ROICDecomposition;
  errors?: string[];
  duration_ms: number;
  model_used: string;
}

// Prompts for each step
const GROSS_MARGIN_PROMPT = `You are an expert financial analyst specializing in gross margin analysis.

Analyze the company's gross margin structure and answer these questions:

EXECUTIVE SUMMARY:
- Current State: Describe the current gross margin level and recent trajectory
- Money Engine: In one sentence, explain how this company makes money at the gross profit level
- Industry vs Individual: Is the gross margin driven by industry structure or company-specific advantages?
- Strategic Verdict: Is this company a "Price Boss" (pricing power) or "Efficiency King" (cost advantage)?

QUANTITATIVE ANATOMY:
- COGS Deconstruction: List the main cost items as % of COGS and their trends
- Value Driver: Is the margin driven by high ASP, structural cost advantage, or both?
- Incremental Margin Analysis: Are incremental margins expanding, contracting, or stable?

QUALITATIVE ANALYSIS:
- Mission Critical Test: Is the product/service mission critical? What's the cost of failure?
- Switching Barrier: How strong are switching barriers? What are the pain points?
- Clone Question: What defensible assets exist? How hard would it be to clone?

PRICING POWER STRESS TEST:
- Inflation Pass-Through: Has the company passed through inflation? How fast?
- Elasticity Proof: How elastic is demand? What's the volume impact of price changes?

SCORES (1-10):
- Gross Margin Quality Score
- Gross Margin Durability Score
- Classification: structural_fortress, cyclical_temporary, or structurally_weak

FINAL VERDICT: One paragraph summary of gross margin quality and durability.

Respond in JSON format.`;

const CAPITAL_EFFICIENCY_PROMPT = `You are an expert financial analyst specializing in capital efficiency and ROIC analysis.

Analyze the company's capital efficiency and answer these questions:

EXECUTIVE SUMMARY:
- Key Findings: List 3-5 key findings about capital efficiency
- Classification: capital_compounder, capital_neutral, or capital_consumer
- Greatest Threat: What's the biggest threat to capital efficiency?

ASSET INTENSITY:
- Capital Anchors: What are the primary assets? Where is capital tied up?
- Maintenance vs Growth: What % of OCF goes to maintenance capex? What cash is unlocked if no growth?
- Scaling Mechanics: Does the company own the "brain" and outsource the "brawn"?

WORKING CAPITAL:
- Funding Relationship: DSO, DPO, power position analysis
- Cash Timing Reality: Is revenue pre-paid, at delivery, or long-cycle accrued?
- Inventory Velocity: Turnover ratio, is it a capital accelerator, risks?

CAPITAL TURNS:
- Capital Turns Trend: 5-year trend, current ratio, analysis
- Structural Drivers: Positive and negative drivers
- Next Dollar Test: ROIIC assessment vs historical

RISK HIERARCHY: List risks by category (trap_capital, slow_capital_turns, destroy_roiic) and severity

FINAL VERDICT: One paragraph summary of capital efficiency.

Respond in JSON format.`;

const ROIC_STRESS_TEST_PROMPT = `You are an expert financial analyst specializing in ROIC stress testing.

Analyze the company's ROIC durability and answer these questions:

EXECUTIVE SUMMARY:
- Current ROIC: Latest ROIC %
- Five Year Trend: improving, stable, or declining
- Two Engines: Which drives ROIC more - gross margin or capital turns? Explain.
- Fragility Map: Which engine is more vulnerable? Why?
- Number One Threat: What's the biggest threat to ROIC?

GROSS MARGIN STRESS:
- Input cost scenarios
- Pricing power erosion scenarios
- Competition scenarios

CAPITAL TURNS STRESS:
- Working capital deterioration scenarios
- Asset intensity increase scenarios
- Growth capex scenarios

REINVESTMENT QUALITY STRESS:
- ROIIC sustainability
- Acquisition integration risks
- Capital allocation discipline

INDUSTRY STRUCTURAL RISKS:
- Disruption scenarios
- Regulatory scenarios
- Cyclical scenarios

BEAR CASE SCENARIOS: List 3-5 scenarios with mechanism, timeline, and ROIC impact

SCORES (1-10):
- Gross Margin Fragility Score (higher = more fragile)
- Capital Turns Fragility Score (higher = more fragile)
- Overall ROIC Durability Score (higher = more durable)

NUMBER ONE THING TO WATCH: What single metric/event should investors monitor?

Respond in JSON format.`;

/**
 * Run the complete ROIC Decomposition analysis
 */
export async function runROICDecomposition(
  config: ROICDecompositionConfig
): Promise<ROICDecompositionResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  
  console.log(`[ROIC Decomposition] Starting analysis for ${config.ticker}`);
  
  // Initialize LLM client - prefer GPT-5.2 Pro
  const modelProvider = config.useGemini ? 'google' : 'openai';
  const modelName = config.useGemini ? 'gemini-2.5-pro' : 'gpt-5.2';
  
  console.log(`[ROIC Decomposition] Using model: ${modelName} (${modelProvider})`);
  
  // Use the default resilient client (GPT-5.2 with Anthropic fallback)
  const llmClient = createResilientClient();
  console.log(`[ROIC Decomposition] Using resilient client with GPT-5.2 primary`);
  
  // Initialize data aggregator for market data
  const dataAggregator = new DataAggregator();
  
  // Fetch comprehensive company data
  console.log(`[ROIC Decomposition] Fetching market data for ${config.ticker}...`);
  let companyData: AggregatedCompanyData;
  try {
    companyData = await dataAggregator.getCompanyData(config.ticker, {
      includeFinancials: true,
      includePriceHistory: false,
      includeNews: false,
      includeFilings: false,
      includeMacro: false,
    });
    console.log(`[ROIC Decomposition] Fetched data: ${companyData.incomeStatements?.length || 0} income statements, ${companyData.balanceSheets?.length || 0} balance sheets`);
  } catch (error) {
    const errorMsg = `Failed to fetch market data: ${(error as Error).message}`;
    console.error(`[ROIC Decomposition] ${errorMsg}`);
    return {
      success: false,
      errors: [errorMsg],
      duration_ms: Date.now() - startTime,
      model_used: modelName,
    };
  }
  
  const result: ROICDecomposition = {
    completed_at: new Date().toISOString(),
    model_used: modelName,
  };
  
  // Prepare financial data context
  const financialContext = prepareFinancialContext(companyData);
  
  // Step 1: Gross Margin Reality Check
  if (!config.skipSteps?.includes('gross_margin')) {
    console.log(`[ROIC Decomposition] Step 1: Running Gross Margin Reality Check...`);
    try {
      const grossMarginResult = await runStep(
        llmClient,
        GROSS_MARGIN_PROMPT,
        financialContext,
        config.ticker
      );
      
      if (grossMarginResult) {
        result.gross_margin_analysis = grossMarginResult as GrossMarginAnalysis;
        console.log(`[ROIC Decomposition] Step 1 completed: Quality Score ${result.gross_margin_analysis.scores?.gross_margin_quality_score}/10`);
      }
    } catch (error) {
      const errorMsg = `Gross Margin Analysis failed: ${(error as Error).message}`;
      errors.push(errorMsg);
      console.error(`[ROIC Decomposition] ${errorMsg}`);
    }
  }
  
  // Step 2: Capital Efficiency Check
  if (!config.skipSteps?.includes('capital_efficiency')) {
    console.log(`[ROIC Decomposition] Step 2: Running Capital Efficiency Check...`);
    try {
      const capitalEfficiencyResult = await runStep(
        llmClient,
        CAPITAL_EFFICIENCY_PROMPT,
        financialContext,
        config.ticker
      );
      
      if (capitalEfficiencyResult) {
        result.capital_efficiency_analysis = capitalEfficiencyResult as CapitalEfficiencyAnalysis;
        console.log(`[ROIC Decomposition] Step 2 completed: Classification: ${result.capital_efficiency_analysis.executive_summary?.classification}`);
      }
    } catch (error) {
      const errorMsg = `Capital Efficiency Analysis failed: ${(error as Error).message}`;
      errors.push(errorMsg);
      console.error(`[ROIC Decomposition] ${errorMsg}`);
    }
  }
  
  // Step 3: ROIC Stress Test
  if (!config.skipSteps?.includes('roic_stress_test')) {
    console.log(`[ROIC Decomposition] Step 3: Running ROIC Stress Test...`);
    try {
      // Include previous analyses in context
      const enrichedContext = {
        ...financialContext,
        gross_margin_analysis: result.gross_margin_analysis,
        capital_efficiency_analysis: result.capital_efficiency_analysis,
      };
      
      const roicStressTestResult = await runStep(
        llmClient,
        ROIC_STRESS_TEST_PROMPT,
        enrichedContext,
        config.ticker
      );
      
      if (roicStressTestResult) {
        result.roic_stress_test = roicStressTestResult as ROICStressTest;
        console.log(`[ROIC Decomposition] Step 3 completed: ROIC Durability Score ${result.roic_stress_test.scores?.overall_roic_durability_score}/10`);
      }
    } catch (error) {
      const errorMsg = `ROIC Stress Test failed: ${(error as Error).message}`;
      errors.push(errorMsg);
      console.error(`[ROIC Decomposition] ${errorMsg}`);
    }
  }
  
  const duration_ms = Date.now() - startTime;
  const success = errors.length === 0 || (
    result.gross_margin_analysis || 
    result.capital_efficiency_analysis || 
    result.roic_stress_test
  );
  
  console.log(`[ROIC Decomposition] Analysis completed in ${duration_ms}ms. Success: ${success}`);
  
  return {
    success: !!success,
    data: result,
    errors: errors.length > 0 ? errors : undefined,
    duration_ms,
    model_used: modelName,
  };
}

/**
 * Prepare financial context from aggregated data
 * Uses the correct types from @arc/retriever
 */
function prepareFinancialContext(data: AggregatedCompanyData): Record<string, any> {
  const context: Record<string, any> = {
    ticker: data.ticker,
    company_name: data.profile?.companyName || data.ticker,
    industry: data.profile?.industry || 'Unknown',
    sector: data.profile?.sector || 'Unknown',
    description: data.profile?.description || '',
  };
  
  // Add income statement data - using correct field names
  if (data.incomeStatements && data.incomeStatements.length > 0) {
    context.income_statements = data.incomeStatements.slice(0, 5).map(is => ({
      fiscal_year: is.fiscalYear,
      fiscal_quarter: is.fiscalQuarter,
      revenue: is.revenue,
      gross_profit: is.grossProfit,
      gross_margin: is.revenue > 0 ? (is.grossProfit / is.revenue) : null,
      operating_income: is.operatingIncome,
      operating_margin: is.revenue > 0 ? (is.operatingIncome / is.revenue) : null,
      net_income: is.netIncome,
      net_margin: is.revenue > 0 ? (is.netIncome / is.revenue) : null,
      ebitda: is.ebitda,
      eps: is.eps,
    }));
  }
  
  // Add balance sheet data - using correct field names
  if (data.balanceSheets && data.balanceSheets.length > 0) {
    context.balance_sheets = data.balanceSheets.slice(0, 5).map(bs => ({
      fiscal_year: bs.fiscalYear,
      fiscal_quarter: bs.fiscalQuarter,
      total_assets: bs.totalAssets,
      total_liabilities: bs.totalLiabilities,
      total_equity: bs.totalEquity,
      cash: bs.cash,
      total_debt: bs.totalDebt,
      net_debt: bs.netDebt,
    }));
  }
  
  // Add cash flow data - using correct field names
  if (data.cashFlowStatements && data.cashFlowStatements.length > 0) {
    context.cash_flows = data.cashFlowStatements.slice(0, 5).map(cf => ({
      fiscal_year: cf.fiscalYear,
      fiscal_quarter: cf.fiscalQuarter,
      operating_cash_flow: cf.operatingCashFlow,
      capex: cf.capitalExpenditure,
      free_cash_flow: cf.freeCashFlow,
      dividends: cf.dividendsPaid,
      share_repurchases: cf.shareRepurchases,
    }));
  }
  
  // Add key metrics - using correct field names
  if (data.metrics) {
    context.metrics = {
      market_cap: data.metrics.marketCapUsd,
      pe_ratio: data.metrics.pe,
      ev_to_ebitda: data.metrics.evToEbitda,
      fcf_yield: data.metrics.fcfYield,
      revenue_cagr_3y: data.metrics.revenueCagr3y,
      ebit_margin: data.metrics.ebitMargin,
      gross_margin: data.metrics.grossMargin,
      roe: data.metrics.roe,
      roic: data.metrics.roic,
      current_ratio: data.metrics.currentRatio,
      quick_ratio: data.metrics.quickRatio,
      net_debt_to_ebitda: data.metrics.netDebtToEbitda,
    };
  }
  
  return context;
}

/**
 * Run a single analysis step
 */
async function runStep(
  llmClient: LLMClient,
  systemPrompt: string,
  context: Record<string, any>,
  ticker: string
): Promise<any> {
  const userPrompt = `Analyze ${ticker} using the following financial data:

${JSON.stringify(context, null, 2)}

Provide your analysis in JSON format.`;

  const response = await llmClient.complete({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    maxTokens: 8000,
    temperature: 0.3,
    jsonMode: true,
  });
  
  try {
    // Try to parse JSON from response
    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (error) {
    console.error(`[ROIC Decomposition] Failed to parse JSON response:`, error);
    throw new Error('Failed to parse LLM response as JSON');
  }
}

/**
 * Run ROIC Decomposition as part of IC Memo building
 */
export async function runROICDecompositionForICMemo(
  ticker: string,
  ideaId: string,
  packetId: string
): Promise<ROICDecompositionResult> {
  console.log(`[ROIC Decomposition] Running for IC Memo: ${ticker} (Packet: ${packetId})`);
  
  return runROICDecomposition({
    ticker,
    ideaId,
    packetId,
    useGemini: false, // Prefer GPT-5.2 Pro
  });
}

export default {
  runROICDecomposition,
  runROICDecompositionForICMemo,
};
