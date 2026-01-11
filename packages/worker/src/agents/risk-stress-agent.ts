/**
 * ARC Investment Factory - Risk & Stress Agent
 * Analyzes risks and performs stress testing
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
5. Macro risks (interest rates, FX, commodity)

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

    return `Analyze risks and perform stress testing for ${ticker}:

COMPANY PROFILE:
${JSON.stringify(companyData.profile, null, 2)}

FINANCIAL METRICS:
${JSON.stringify(companyData.metrics, null, 2)}

BALANCE SHEET:
${JSON.stringify(companyData.balanceSheets?.[0], null, 2)}

PREVIOUS ANALYSIS MODULES:
${JSON.stringify(previousModules, null, 2)}

RECENT NEWS:
${JSON.stringify(companyData.news?.slice(0, 5), null, 2)}

Provide your analysis as a RiskStressModule JSON with:
- summary: Comprehensive risk summary
- top_risks: Array of risk objects with { risk, probability, impact, mitigants, early_indicators }
- stress_test_results: Description of stress test scenarios and results
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
