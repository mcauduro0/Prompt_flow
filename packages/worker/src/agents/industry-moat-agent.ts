/**
 * ARC Investment Factory - Industry & Moat Agent
 * Analyzes competitive position and moat durability
 */

import { BaseResearchAgent, type AgentContext } from './base-agent.js';
import type { LLMClient } from '@arc/llm-client';
import type { DataAggregator } from '@arc/retriever';
import { IndustryMoatModuleSchema, type IndustryMoatModule } from '@arc/core';

const SYSTEM_PROMPT = `You are an expert industry analyst specializing in competitive dynamics and moat analysis.

Your task is to analyze a company's competitive position and the durability of its moat.

Focus on:
1. Industry structure and dynamics
2. Competitive advantages (cost, differentiation, network effects, switching costs)
3. Moat durability and threats
4. Peer comparison
5. Market share trends

Output ONLY valid JSON matching the IndustryMoatModule schema.`;

export class IndustryMoatAgent extends BaseResearchAgent<IndustryMoatModule> {
  constructor(llmClient: LLMClient, dataAggregator: DataAggregator) {
    super(
      'IndustryMoatAgent',
      llmClient,
      dataAggregator,
      IndustryMoatModuleSchema,
      'ResearchPacket'
    );
  }

  protected getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  protected buildUserPrompt(context: AgentContext): string {
    const { ticker, companyData } = context;

    return `Analyze the competitive position and moat for ${ticker}:

COMPANY PROFILE:
${JSON.stringify(companyData.profile, null, 2)}

FINANCIAL METRICS:
${JSON.stringify(companyData.metrics, null, 2)}

Provide your analysis as an IndustryMoatModule JSON with:
- summary: Comprehensive summary of competitive position
- competitive_position: Description of market position
- moat_claims: Array of moat claims with evidence
- peer_set: Array of comparable companies
- evidence: Array of evidence IDs

JSON output:`;
  }
}

export function createIndustryMoatAgent(
  llmClient: LLMClient,
  dataAggregator: DataAggregator
): IndustryMoatAgent {
  return new IndustryMoatAgent(llmClient, dataAggregator);
}
