/**
 * ARC Investment Factory - Financial Forensics Agent
 * Analyzes earnings quality and financial health
 */

import { BaseResearchAgent, type AgentContext } from './base-agent.js';
import type { LLMClient } from '@arc/llm-client';
import type { DataAggregator } from '@arc/retriever';
import { FinancialForensicsModuleSchema, type FinancialForensicsModule } from '@arc/core';

const SYSTEM_PROMPT = `You are an expert financial analyst specializing in earnings quality and forensic accounting.

Your task is to analyze a company's financial statements for quality and potential red flags.

Focus on:
1. Earnings quality and sustainability
2. Cash conversion (CFO vs Net Income)
3. Revenue recognition practices
4. Balance sheet risks (off-balance sheet items, contingent liabilities)
5. Accrual analysis and accounting choices

Output ONLY valid JSON matching the FinancialForensicsModule schema.`;

export class FinancialForensicsAgent extends BaseResearchAgent<FinancialForensicsModule> {
  constructor(llmClient: LLMClient, dataAggregator: DataAggregator) {
    super(
      'FinancialForensicsAgent',
      llmClient,
      dataAggregator,
      FinancialForensicsModuleSchema,
      'ResearchPacket'
    );
  }

  protected getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  protected buildUserPrompt(context: AgentContext): string {
    const { ticker, companyData } = context;

    return `Analyze the financial quality for ${ticker}:

INCOME STATEMENTS:
${JSON.stringify(companyData.incomeStatements, null, 2)}

BALANCE SHEETS:
${JSON.stringify(companyData.balanceSheets, null, 2)}

CASH FLOW STATEMENTS:
${JSON.stringify(companyData.cashFlowStatements, null, 2)}

FINANCIAL METRICS:
${JSON.stringify(companyData.metrics, null, 2)}

Provide your analysis as a FinancialForensicsModule JSON with:
- summary: Comprehensive summary of financial quality
- earnings_quality_score_1_10: Score from 1-10
- cash_conversion_notes: Analysis of cash conversion
- balance_sheet_risks: Array of identified risks
- evidence: Array of evidence IDs

JSON output:`;
  }
}

export function createFinancialForensicsAgent(
  llmClient: LLMClient,
  dataAggregator: DataAggregator
): FinancialForensicsAgent {
  return new FinancialForensicsAgent(llmClient, dataAggregator);
}
