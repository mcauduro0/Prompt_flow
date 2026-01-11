/**
 * ARC Investment Factory - Management Quality Agent
 * Analyzes management team quality and alignment
 */

import { BaseResearchAgent, type AgentContext } from './base-agent.js';
import type { LLMClient } from '@arc/llm-client';
import type { DataAggregator } from '@arc/retriever';
import { ManagementQualityModuleSchema, type ManagementQualityModule } from '@arc/core';

const SYSTEM_PROMPT = `You are an expert analyst specializing in management quality assessment.

Your task is to analyze a company's management team quality and alignment with shareholders.

Focus on:
1. Management track record and experience
2. Compensation structure and alignment
3. Insider ownership and transactions
4. Communication quality and transparency
5. Corporate governance practices

Output ONLY valid JSON matching the ManagementQualityModule schema.`;

export class ManagementQualityAgent extends BaseResearchAgent<ManagementQualityModule> {
  constructor(llmClient: LLMClient, dataAggregator: DataAggregator) {
    super(
      'ManagementQualityAgent',
      llmClient,
      dataAggregator,
      ManagementQualityModuleSchema,
      'ResearchPacket'
    );
  }

  protected getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  protected buildUserPrompt(context: AgentContext): string {
    const { ticker, companyData } = context;

    return `Analyze the management quality for ${ticker}:

COMPANY PROFILE:
${JSON.stringify(companyData.profile, null, 2)}

SEC FILINGS (for proxy statements):
${JSON.stringify(companyData.filings?.filter(f => f.formType.includes('DEF')), null, 2)}

RECENT NEWS:
${JSON.stringify(companyData.news?.slice(0, 5), null, 2)}

Provide your analysis as a ManagementQualityModule JSON with:
- summary: Comprehensive summary of management quality
- score_1_10: Score from 1-10
- red_flags: Array of any red flags identified
- evidence: Array of evidence IDs

JSON output:`;
  }
}

export function createManagementQualityAgent(
  llmClient: LLMClient,
  dataAggregator: DataAggregator
): ManagementQualityAgent {
  return new ManagementQualityAgent(llmClient, dataAggregator);
}
