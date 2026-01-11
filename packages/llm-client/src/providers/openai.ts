/**
 * ARC Investment Factory - OpenAI Provider
 * OpenAI API client implementation
 */

import OpenAI from 'openai';
import type { LLMClient, LLMConfig, LLMRequest, LLMResponse } from '../types.js';
import { DEFAULT_MODELS } from '../types.js';

export class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private model: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: Partial<LLMConfig> = {}) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl ?? process.env.OPENAI_API_BASE,
    });
    this.model = config.model ?? DEFAULT_MODELS.openai;
    this.defaultMaxTokens = config.maxTokens ?? 4096;
    this.defaultTemperature = config.temperature ?? 0.7;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const messages = request.messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: request.maxTokens ?? this.defaultMaxTokens,
      temperature: request.temperature ?? this.defaultTemperature,
      response_format: request.jsonMode ? { type: 'json_object' } : undefined,
    });

    const choice = response.choices[0];
    
    return {
      content: choice.message.content ?? '',
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      finishReason: choice.finish_reason ?? 'stop',
    };
  }

  getProvider(): 'openai' {
    return 'openai';
  }

  getModel(): string {
    return this.model;
  }
}

/**
 * Create OpenAI client with default configuration
 */
export function createOpenAIClient(config?: Partial<LLMConfig>): OpenAIClient {
  return new OpenAIClient(config);
}
