/**
 * ARC Investment Factory - Valuation Agent
 * Performs multi-method valuation analysis
 */

import { BaseResearchAgent, type AgentContext } from './base-agent.js';
import type { LLMClient } from '@arc/llm-client';
import type { DataAggregator } from '@arc/retriever';
import { ValuationModuleSchema, type ValuationModule } from '@arc/core';

const SYSTEM_PROMPT = `You are an expert valuation analyst specializing in equity valuation.

Your task is to perform a comprehensive valuation analysis using multiple methods.

Focus on:
1. DCF analysis with explicit assumptions
2. Comparable company analysis
3. Precedent transactions (if relevant)
4. Sum-of-the-parts (if applicable)
5. Key value drivers and sensitivities

Output ONLY valid JSON matching the ValuationModule schema.`;

export class ValuationAgent extends BaseResearchAgent<ValuationModule> {
  constructor(llmClient: LLMClient, dataAggregator: DataAggregator) {
    super(
      'ValuationAgent',
      llmClient,
      dataAggregator,
      ValuationModuleSchema,
      'ResearchPacket'
    );
  }

  protected getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  protected buildUserPrompt(context: AgentContext): string {
    const { ticker, companyData } = context;

    return `Perform valuation analysis for ${ticker}:

COMPANY PROFILE:
${JSON.stringify(companyData.profile, null, 2)}

FINANCIAL METRICS:
${JSON.stringify(companyData.metrics, null, 2)}

INCOME STATEMENTS:
${JSON.stringify(companyData.incomeStatements, null, 2)}

CASH FLOW STATEMENTS:
${JSON.stringify(companyData.cashFlowStatements, null, 2)}

ANALYST ESTIMATES:
${JSON.stringify(companyData.analystEstimates, null, 2)}

LATEST PRICE:
${JSON.stringify(companyData.latestPrice, null, 2)}

Provide your analysis as a ValuationModule JSON with:
- summary: Comprehensive valuation summary
- methods_used: Array of methods (dcf, comps, sopt, precedent)
- fair_value_range: { low, base, high }
- key_drivers: Array of key value drivers
- margin_of_safety_notes: Notes on margin of safety
- evidence: Array of evidence IDs

JSON output:`;
  }
}

export function createValuationAgent(
  llmClient: LLMClient,
  dataAggregator: DataAggregator
): ValuationAgent {
  return new ValuationAgent(llmClient, dataAggregator);
}
