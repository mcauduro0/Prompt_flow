/**
 * ARC Investment Factory - Prompt Executor
 * 
 * Executes prompts based on executor_type:
 * - llm: Calls LLM with prompt template and context
 * - code: Executes registered deterministic function
 * - hybrid: Pre-process → LLM → Post-process with validation
 */

import { createHash } from 'crypto';
import { createLLMClient, type LLMClient } from '@arc/llm-client';
import {
  type PromptDefinition,
  type ExecutionOutput,
  type ExecutionContext,
  type Lane,
} from './types.js';
import { getCodeFunction } from './code-functions/index.js';

// ============================================================================
// TEMPLATE RENDERING
// ============================================================================

/**
 * Render a template string with context variables
 * Supports {{variable}} and {{nested.variable}} syntax
 */
function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const keys = path.trim().split('.');
    let value: unknown = context;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return match; // Keep original if path not found
      }
    }
    
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    
    return String(value);
  });
}

/**
 * Generate a hash of the input for caching and tracking
 */
function generateInputHash(input: Record<string, unknown>): string {
  const sorted = JSON.stringify(input, Object.keys(input).sort());
  return createHash('sha256').update(sorted).digest('hex').substring(0, 16);
}

// ============================================================================
// PROMPT EXECUTOR
// ============================================================================

export class PromptExecutor {
  private llmClients: Map<string, LLMClient> = new Map();

  constructor() {
    // Clients will be created on demand
  }

  /**
   * Get or create an LLM client for a provider/model combination
   */
  private getLLMClient(provider: string, model: string): LLMClient {
    const key = `${provider}:${model}`;
    let client = this.llmClients.get(key);
    
    if (!client) {
      client = createLLMClient({
        provider: provider as 'openai' | 'anthropic',
        model,
      });
      this.llmClients.set(key, client);
    }
    
    return client;
  }

  /**
   * Execute a prompt based on its executor_type
   */
  async execute(
    prompt: PromptDefinition,
    data: Record<string, unknown>
  ): Promise<ExecutionOutput> {
    const startTime = Date.now();

    try {
      switch (prompt.executor_type) {
        case 'llm':
          return await this.executeLLM(prompt, data, startTime);
        case 'code':
          return await this.executeCode(prompt, data, startTime);
        case 'hybrid':
          return await this.executeHybrid(prompt, data, startTime);
        default:
          throw new Error(`Unknown executor_type: ${prompt.executor_type}`);
      }
    } catch (error) {
      return {
        success: false,
        validation_pass: false,
        validation_errors: [(error as Error).message],
        latency_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute an LLM prompt
   */
  private async executeLLM(
    prompt: PromptDefinition,
    data: Record<string, unknown>,
    startTime: number
  ): Promise<ExecutionOutput> {
    if (!prompt.llm_config) {
      throw new Error('llm_config is required for executor_type: llm');
    }

    // Render the prompt template
    const renderedPrompt = renderTemplate(prompt.template, data);

    // Extract system and user prompts
    const { systemPrompt, userPrompt } = this.extractPrompts(renderedPrompt);

    // Get LLM client
    const client = this.getLLMClient(prompt.llm_config.provider, prompt.llm_config.model);

    // Call LLM
    const llmResponse = await client.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: prompt.llm_config.temperature,
      maxTokens: prompt.llm_config.max_tokens,
      jsonMode: true,
    });

    const latency_ms = Date.now() - startTime;

    // Parse JSON response
    let parsedData: unknown;
    const raw_output = llmResponse.content;

    try {
      // Try to extract JSON from the response
      const jsonMatch = raw_output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      return {
        success: false,
        raw_output,
        validation_pass: false,
        validation_errors: [`Failed to parse JSON response: ${(parseError as Error).message}`],
        tokens_in: llmResponse.usage?.promptTokens,
        tokens_out: llmResponse.usage?.completionTokens,
        cost_estimate: this.estimateCost(
          prompt.llm_config.provider,
          prompt.llm_config.model,
          llmResponse.usage?.promptTokens || 0,
          llmResponse.usage?.completionTokens || 0
        ),
        latency_ms,
      };
    }

    return {
      success: true,
      data: parsedData,
      raw_output,
      validation_pass: true, // Will be validated by SchemaValidator
      tokens_in: llmResponse.usage?.promptTokens,
      tokens_out: llmResponse.usage?.completionTokens,
      cost_estimate: this.estimateCost(
        prompt.llm_config.provider,
        prompt.llm_config.model,
        llmResponse.usage?.promptTokens || 0,
        llmResponse.usage?.completionTokens || 0
      ),
      latency_ms,
    };
  }

  /**
   * Execute a code function
   */
  private async executeCode(
    prompt: PromptDefinition,
    data: Record<string, unknown>,
    startTime: number
  ): Promise<ExecutionOutput> {
    if (!prompt.code_function) {
      throw new Error('code_function is required for executor_type: code');
    }

    const codeFunction = getCodeFunction(prompt.code_function);
    if (!codeFunction) {
      throw new Error(`Code function not found: ${prompt.code_function}`);
    }

    // Create a minimal context for code functions
        const context: ExecutionContext = {
          run_id: data.run_id as string || 'unknown',
          pipeline_id: data.pipeline_id as string || 'unknown',
          lane: (data.lane as Lane) || 'A',
          ticker: data.ticker as string || 'unknown',
          date: data.date as string || new Date().toISOString().split('T')[0],
        };

    const result = await codeFunction(context, data);

    return {
      success: true,
      data: result,
      validation_pass: true,
      latency_ms: Date.now() - startTime,
    };
  }

  /**
   * Execute a hybrid prompt (pre-process → LLM → post-process)
   */
  private async executeHybrid(
    prompt: PromptDefinition,
    data: Record<string, unknown>,
    startTime: number
  ): Promise<ExecutionOutput> {
    let processedData = data;

    // Pre-process if defined
    if (prompt.pre_process_function) {
      const preProcess = getCodeFunction(prompt.pre_process_function);
      if (preProcess) {
        const preContext: ExecutionContext = {
          run_id: data.run_id as string || 'unknown',
          pipeline_id: data.pipeline_id as string || 'unknown',
          lane: (data.lane as Lane) || 'A',
          ticker: data.ticker as string || 'unknown',
          date: data.date as string || new Date().toISOString().split('T')[0],
        };
        processedData = await preProcess(preContext, data) as Record<string, unknown>;
      }
    }

    // Execute LLM
    const llmResult = await this.executeLLM(prompt, processedData, startTime);

    if (!llmResult.success) {
      return llmResult;
    }

    // Post-process if defined
    if (prompt.post_process_function && llmResult.data) {
      const postProcess = getCodeFunction(prompt.post_process_function);
      if (postProcess) {
        const postContext: ExecutionContext = {
          run_id: data.run_id as string || 'unknown',
          pipeline_id: data.pipeline_id as string || 'unknown',
          lane: (data.lane as Lane) || 'A',
          ticker: data.ticker as string || 'unknown',
          date: data.date as string || new Date().toISOString().split('T')[0],
        };
        llmResult.data = await postProcess(postContext, llmResult.data as Record<string, unknown>);
      }
    }

    return llmResult;
  }

  /**
   * Extract system and user prompts from template
   */
  private extractPrompts(template: string): { systemPrompt: string; userPrompt: string } {
    // Check for SYSTEM: / USER: markers
    const systemMatch = template.match(/SYSTEM:\s*([\s\S]*?)(?=USER:|$)/i);
    const userMatch = template.match(/USER:\s*([\s\S]*?)$/i);

    if (systemMatch && userMatch) {
      return {
        systemPrompt: systemMatch[1].trim(),
        userPrompt: userMatch[1].trim(),
      };
    }

    // If no markers, treat the whole template as user prompt
    return {
      systemPrompt: 'You are a helpful assistant. Respond in valid JSON format.',
      userPrompt: template.trim(),
    };
  }

  /**
   * Estimate cost based on provider and model
   */
  private estimateCost(
    provider: string,
    model: string,
    tokensIn: number,
    tokensOut: number
  ): number {
    // Pricing per 1M tokens (approximate)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.5, output: 10 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'gpt-4-turbo': { input: 10, output: 30 },
      'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
      'claude-sonnet-4-20250514': { input: 3, output: 15 },
      'claude-3-opus-20240229': { input: 15, output: 75 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
      'sonar-pro': { input: 3, output: 15 },
      'sonar': { input: 1, output: 1 },
    };

    const modelPricing = pricing[model] || { input: 5, output: 15 };
    
    return (
      (tokensIn / 1_000_000) * modelPricing.input +
      (tokensOut / 1_000_000) * modelPricing.output
    );
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let executorInstance: PromptExecutor | null = null;

export function getPromptExecutor(): PromptExecutor {
  if (!executorInstance) {
    executorInstance = new PromptExecutor();
  }
  return executorInstance;
}

export function resetPromptExecutor(): void {
  executorInstance = null;
}
