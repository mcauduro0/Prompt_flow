/**
 * ARC Investment Factory - Risk & Stress Agent
 * Analyzes risks and performs stress testing
 * 
 * UPDATED: Now includes macroeconomic data from FRED for enhanced risk analysis
 */
import { BaseResearchAgent, type AgentContext } from './base-agent.js';
import type { LLMClient } from '@arc/llm-client';
import type { DataAggregator } from '@arc/retriever';
import { RiskStressModuleSchema, type RiskStressModule } from '@arc/core';

const SYSTEM_PROMPT = `You are an expert risk analyst specializing in investment risk assessment.
Your task is to identify and analyze key risks and perform stress testing.

Focus on:
1. Business risks (competition, disruption, customer concentration)
2. Financial risks (leverage, liquidity, refinancing)
3. Operational risks (key person, supply chain)
4. Regulatory and legal risks
5. Macro risks (interest rates, FX, commodity) - USE THE PROVIDED MACRO DATA

IMPORTANT: Use the macroeconomic indicators provided (GDP growth, unemployment, inflation, Fed Funds rate, Treasury yields) to assess how the company would perform under different macro scenarios.

For each risk, assess probability, impact, mitigants, and early warning indicators.

Output ONLY valid JSON matching the RiskStressModule schema.`;

export class RiskStressAgent extends BaseResearchAgent<RiskStressModule> {
  constructor(llmClient: LLMClient, dataAggregator: DataAggregator) {
    super(
      'RiskStressAgent',
      llmClient,
      dataAggregator,
      RiskStressModuleSchema,
      'ResearchPacket'
    );
  }

  protected getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  protected buildUserPrompt(context: AgentContext): string {
    const { ticker, companyData, previousModules } = context;
    
    // Build macro section if available
    let macroSection = '';
    if (companyData.macroIndicators) {
      const macro = companyData.macroIndicators;
      macroSection = `
CURRENT MACROECONOMIC ENVIRONMENT (FRED Data):
- GDP Growth Rate: ${macro.gdp_growth !== undefined ? macro.gdp_growth + '%' : 'N/A'} (as of ${macro.gdp_growth_date || 'N/A'})
- Unemployment Rate: ${macro.unemployment_rate !== undefined ? macro.unemployment_rate + '%' : 'N/A'} (as of ${macro.unemployment_date || 'N/A'})
- Inflation (CPI): ${macro.inflation_cpi !== undefined ? macro.inflation_cpi : 'N/A'} (as of ${macro.inflation_date || 'N/A'})
- Fed Funds Rate: ${macro.fed_funds_rate !== undefined ? macro.fed_funds_rate + '%' : 'N/A'}
- 10-Year Treasury Yield: ${macro.treasury_10y !== undefined ? macro.treasury_10y + '%' : 'N/A'}
- 2-Year Treasury Yield: ${macro.treasury_2y !== undefined ? macro.treasury_2y + '%' : 'N/A'}
- Yield Curve Spread (10Y-2Y): ${macro.yield_curve_spread !== undefined ? macro.yield_curve_spread.toFixed(2) + '%' : 'N/A'}
- Consumer Sentiment: ${macro.consumer_sentiment !== undefined ? macro.consumer_sentiment : 'N/A'}
- VIX (Volatility Index): ${macro.vix !== undefined ? macro.vix : 'N/A'}

Use this macro data to:
1. Assess interest rate sensitivity of the company's debt
2. Evaluate recession risk impact on revenues
3. Consider inflation impact on margins
4. Analyze consumer spending sensitivity if applicable
`;
    }

    return `Analyze risks and perform stress testing for ${ticker}:

COMPANY PROFILE:
${JSON.stringify(companyData.profile, null, 2)}

FINANCIAL METRICS:
${JSON.stringify(companyData.metrics, null, 2)}

BALANCE SHEET:
${JSON.stringify(companyData.balanceSheets?.[0], null, 2)}
${macroSection}
PREVIOUS ANALYSIS MODULES:
${JSON.stringify(previousModules, null, 2)}

RECENT NEWS:
${JSON.stringify(companyData.news?.slice(0, 5), null, 2)}

Provide your analysis as a RiskStressModule JSON with:
- summary: Comprehensive risk summary including macro risk assessment
- top_risks: Array of risk objects with { risk, probability, impact, mitigants, early_indicators }
- stress_test_results: Description of stress test scenarios (include recession scenario, rate hike scenario)
- evidence: Array of evidence IDs

JSON output:`;
  }
}

export function createRiskStressAgent(
  llmClient: LLMClient,
  dataAggregator: DataAggregator
): RiskStressAgent {
  return new RiskStressAgent(llmClient, dataAggregator);
}
