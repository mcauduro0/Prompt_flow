/**
 * ARC Investment Factory - Business Model Agent
 * Analyzes company business model and unit economics
 */

import { z } from 'zod';
import { BaseResearchAgent, type AgentContext } from './base-agent.js';
import type { LLMClient } from '@arc/llm-client';
import type { DataAggregator } from '@arc/retriever';
import { BusinessModuleSchema, type BusinessModule } from '@arc/core';

const SYSTEM_PROMPT = `You are an expert business analyst specializing in understanding company business models and unit economics.

Your task is to analyze a company's business model and provide a comprehensive assessment.

Focus on:
1. Revenue model and pricing power
2. Customer acquisition and retention
3. Unit economics (LTV/CAC, gross margin, contribution margin)
4. Scalability and operating leverage
5. Competitive dynamics

Output ONLY valid JSON matching the BusinessModule schema.`;

export class BusinessModelAgent extends BaseResearchAgent<BusinessModule> {
  constructor(llmClient: LLMClient, dataAggregator: DataAggregator) {
    super(
      'BusinessModelAgent',
      llmClient,
      dataAggregator,
      BusinessModuleSchema,
      'ResearchPacket' // Using parent schema name for validation context
    );
  }

  protected getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  protected buildUserPrompt(context: AgentContext): string {
    const { ticker, companyData } = context;

    return `Analyze the business model for ${ticker}:

COMPANY PROFILE:
${JSON.stringify(companyData.profile, null, 2)}

FINANCIAL METRICS:
${JSON.stringify(companyData.metrics, null, 2)}

INCOME STATEMENTS (Last 3 Years):
${JSON.stringify(companyData.incomeStatements?.slice(0, 3), null, 2)}

RECENT NEWS:
${JSON.stringify(companyData.news?.slice(0, 5), null, 2)}

Provide your analysis as a BusinessModule JSON with:
- summary: Comprehensive summary of the business model (min 100 chars)
- unit_economics: { ltv_cac, gross_margin, contribution_margin, retention } (use null if unknown)
- key_questions: Array of important questions to investigate further
- evidence: Array of evidence IDs supporting your analysis (use placeholder IDs like "ev_001")

JSON output:`;
  }
}

export function createBusinessModelAgent(
  llmClient: LLMClient,
  dataAggregator: DataAggregator
): BusinessModelAgent {
  return new BusinessModelAgent(llmClient, dataAggregator);
}
