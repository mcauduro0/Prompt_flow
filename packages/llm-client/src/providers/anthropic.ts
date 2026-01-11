/**
 * ARC Investment Factory - Anthropic Provider
 * Anthropic Claude API client implementation
 */

import Anthropic from '@anthropic-ai/sdk';
import type { LLMClient, LLMConfig, LLMRequest, LLMResponse } from '../types.js';
import { DEFAULT_MODELS } from '../types.js';

export class AnthropicClient implements LLMClient {
  private client: Anthropic;
  private model: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: Partial<LLMConfig> = {}) {
    this.client = new Anthropic({
      apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
    this.model = config.model ?? DEFAULT_MODELS.anthropic;
    this.defaultMaxTokens = config.maxTokens ?? 4096;
    this.defaultTemperature = config.temperature ?? 0.7;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    // Extract system message if present
    const systemMessage = request.messages.find((m) => m.role === 'system');
    const otherMessages = request.messages.filter((m) => m.role !== 'system');

    const messages = otherMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? this.defaultMaxTokens,
      temperature: request.temperature ?? this.defaultTemperature,
      system: systemMessage?.content,
      messages,
    });

    const textContent = response.content.find((c) => c.type === 'text');
    
    return {
      content: textContent?.type === 'text' ? textContent.text : '',
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason ?? 'end_turn',
    };
  }

  getProvider(): 'anthropic' {
    return 'anthropic';
  }

  getModel(): string {
    return this.model;
  }
}

/**
 * Create Anthropic client with default configuration
 */
export function createAnthropicClient(config?: Partial<LLMConfig>): AnthropicClient {
  return new AnthropicClient(config);
}
