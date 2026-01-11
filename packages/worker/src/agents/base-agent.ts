/**
 * ARC Investment Factory - Base Research Agent
 * Abstract base class for all Lane B research agents
 */

import type { LLMClient, LLMMessage } from '@arc/llm-client';
import type { DataAggregator, AggregatedCompanyData } from '@arc/retriever';
import { validateWithRetry, type SchemaName } from '@arc/core';
import type { ZodSchema } from 'zod';

export interface AgentContext {
  ticker: string;
  companyData: AggregatedCompanyData;
  previousModules?: Record<string, unknown>;
  evidenceIds: string[];
}

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
  evidenceIds: string[];
  tokensUsed: number;
}

export abstract class BaseResearchAgent<T> {
  protected name: string;
  protected llmClient: LLMClient;
  protected dataAggregator: DataAggregator;
  protected outputSchema: ZodSchema<T>;
  protected schemaName: SchemaName;

  constructor(
    name: string,
    llmClient: LLMClient,
    dataAggregator: DataAggregator,
    outputSchema: ZodSchema<T>,
    schemaName: SchemaName
  ) {
    this.name = name;
    this.llmClient = llmClient;
    this.dataAggregator = dataAggregator;
    this.outputSchema = outputSchema;
    this.schemaName = schemaName;
  }

  /**
   * Get the system prompt for this agent
   */
  protected abstract getSystemPrompt(): string;

  /**
   * Build the user prompt from context
   */
  protected abstract buildUserPrompt(context: AgentContext): string;

  /**
   * Fetch additional data specific to this agent
   */
  protected async fetchAdditionalData(context: AgentContext): Promise<Record<string, unknown>> {
    return {};
  }

  /**
   * Run the agent
   */
  async run(context: AgentContext): Promise<AgentResult<T>> {
    console.log(`[${this.name}] Starting analysis for ${context.ticker}`);

    try {
      // Fetch any additional data needed
      const additionalData = await this.fetchAdditionalData(context);
      const enrichedContext = {
        ...context,
        additionalData,
      };

      // Build messages
      const messages: LLMMessage[] = [
        { role: 'system', content: this.getSystemPrompt() },
        { role: 'user', content: this.buildUserPrompt(enrichedContext as AgentContext) },
      ];

      // Call LLM with validation and retry
      const result = await validateWithRetry({
        schema: this.outputSchema,
        schemaName: this.schemaName,
        initialResponse: await this.callLLM(messages),
        retryFn: async (fixPrompt) => {
          const retryMessages: LLMMessage[] = [
            ...messages,
            { role: 'assistant', content: 'I will fix the JSON output.' },
            { role: 'user', content: fixPrompt },
          ];
          return this.callLLM(retryMessages);
        },
      });

      if (result.success) {
        console.log(`[${this.name}] Successfully analyzed ${context.ticker}`);
        return {
          success: true,
          data: result.data,
          evidenceIds: context.evidenceIds,
          tokensUsed: 0, // TODO: Track actual tokens
        };
      } else {
        console.error(`[${this.name}] Validation failed for ${context.ticker}:`, result.errors);
        return {
          success: false,
          errors: result.errors?.map((e) => e.message),
          evidenceIds: context.evidenceIds,
          tokensUsed: 0,
        };
      }
    } catch (error) {
      console.error(`[${this.name}] Error analyzing ${context.ticker}:`, error);
      return {
        success: false,
        errors: [(error as Error).message],
        evidenceIds: context.evidenceIds,
        tokensUsed: 0,
      };
    }
  }

  /**
   * Call the LLM and return raw response
   */
  private async callLLM(messages: LLMMessage[]): Promise<string> {
    const response = await this.llmClient.complete({
      messages,
      maxTokens: 4000,
      temperature: 0.5,
      jsonMode: true,
    });
    return response.content;
  }
}
