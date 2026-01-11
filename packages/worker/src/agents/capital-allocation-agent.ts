/**
 * ARC Investment Factory - Capital Allocation Agent
 * Analyzes management's capital allocation track record
 */

import { BaseResearchAgent, type AgentContext } from './base-agent.js';
import type { LLMClient } from '@arc/llm-client';
import type { DataAggregator } from '@arc/retriever';
import { CapitalAllocationModuleSchema, type CapitalAllocationModule } from '@arc/core';

const SYSTEM_PROMPT = `You are an expert analyst specializing in capital allocation analysis.

Your task is to analyze a company's capital allocation decisions and track record.

Focus on:
1. Historical capital allocation decisions
2. M&A track record and integration success
3. Organic vs inorganic growth
4. Dividend and buyback policies
5. ROIC trends and reinvestment rates

Output ONLY valid JSON matching the CapitalAllocationModule schema.`;

export class CapitalAllocationAgent extends BaseResearchAgent<CapitalAllocationModule> {
  constructor(llmClient: LLMClient, dataAggregator: DataAggregator) {
    super(
      'CapitalAllocationAgent',
      llmClient,
      dataAggregator,
      CapitalAllocationModuleSchema,
      'ResearchPacket'
    );
  }

  protected getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  protected buildUserPrompt(context: AgentContext): string {
    const { ticker, companyData } = context;

    return `Analyze the capital allocation for ${ticker}:

COMPANY PROFILE:
${JSON.stringify(companyData.profile, null, 2)}

CASH FLOW STATEMENTS:
${JSON.stringify(companyData.cashFlowStatements, null, 2)}

FINANCIAL METRICS:
${JSON.stringify(companyData.metrics, null, 2)}

RECENT NEWS (for M&A activity):
${JSON.stringify(companyData.news?.slice(0, 5), null, 2)}

Provide your analysis as a CapitalAllocationModule JSON with:
- summary: Comprehensive summary of capital allocation
- track_record: Description of historical track record
- mna_notes: Notes on M&A activity and success
- evidence: Array of evidence IDs

JSON output:`;
  }
}

export function createCapitalAllocationAgent(
  llmClient: LLMClient,
  dataAggregator: DataAggregator
): CapitalAllocationAgent {
  return new CapitalAllocationAgent(llmClient, dataAggregator);
}
