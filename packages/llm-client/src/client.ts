/**
 * ARC Investment Factory - Unified LLM Client
 * Factory for creating LLM clients with provider abstraction
 */

import type { LLMClient, LLMConfig, LLMProvider, LLMRequest, LLMResponse } from './types.js';
import { OpenAIClient } from './providers/openai.js';
import { AnthropicClient } from './providers/anthropic.js';
import { GeminiClient } from './providers/gemini.js';

/**
 * Create an LLM client based on configuration
 */
export function createLLMClient(config: LLMConfig): LLMClient {
  switch (config.provider) {
    case 'openai':
      return new OpenAIClient(config);
    case 'anthropic':
      return new AnthropicClient(config);
    case 'google':
      return new GeminiClient(config);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

/**
 * Create default LLM client (OpenAI gpt-5.2 - uses DEFAULT_MODELS from types.ts)
 */
export function createDefaultClient(): LLMClient {
  return new OpenAIClient();
}

/**
 * LLM client with automatic retry and fallback
 */
export class ResilientLLMClient implements LLMClient {
  private primaryClient: LLMClient;
  private fallbackClient?: LLMClient;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(options: {
    primary: LLMConfig;
    fallback?: LLMConfig;
    maxRetries?: number;
    retryDelayMs?: number;
  }) {
    this.primaryClient = createLLMClient(options.primary);
    this.fallbackClient = options.fallback
      ? createLLMClient(options.fallback)
      : undefined;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    let lastError: Error | undefined;

    // Try primary client with retries
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.primaryClient.complete(request);
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `LLM request failed (attempt ${attempt + 1}/${this.maxRetries}):`,
          error
        );

        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }

    // Try fallback client if available
    if (this.fallbackClient) {
      console.warn('Primary LLM failed, trying fallback...');
      try {
        return await this.fallbackClient.complete(request);
      } catch (error) {
        console.error('Fallback LLM also failed:', error);
        throw lastError ?? error;
      }
    }

    throw lastError ?? new Error('LLM request failed');
  }

  getProvider(): LLMProvider {
    return this.primaryClient.getProvider();
  }

  getModel(): string {
    return this.primaryClient.getModel();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a resilient LLM client with OpenAI primary and Anthropic fallback
 */
export function createResilientClient(): ResilientLLMClient {
  return new ResilientLLMClient({
    primary: { provider: 'openai', model: 'gpt-5.2' },
    fallback: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    maxRetries: 3,
    retryDelayMs: 1000,
  });
}
