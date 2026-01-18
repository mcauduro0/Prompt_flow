/**
 * ARC Investment Factory - OpenAI Provider
 * OpenAI API client implementation
 * Updated to use max_completion_tokens for GPT-5.x compatibility
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

  /**
   * Check if the model requires max_completion_tokens instead of max_tokens
   * GPT-5.x and newer models use max_completion_tokens
   */
  private useMaxCompletionTokens(): boolean {
    const model = this.model.toLowerCase();
    // GPT-5.x, o1, o3 models require max_completion_tokens
    return model.startsWith('gpt-5') || 
           model.startsWith('o1') || 
           model.startsWith('o3') ||
           model.includes('gpt-5');
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const messages = request.messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const maxTokensValue = request.maxTokens ?? this.defaultMaxTokens;
    
    // Build request params based on model compatibility
    const requestParams: OpenAI.Chat.ChatCompletionCreateParams = {
      model: this.model,
      messages,
      temperature: request.temperature ?? this.defaultTemperature,
      response_format: request.jsonMode ? { type: 'json_object' } : undefined,
    };

    // Use max_completion_tokens for GPT-5.x and newer models
    if (this.useMaxCompletionTokens()) {
      requestParams.max_completion_tokens = maxTokensValue;
    } else {
      requestParams.max_tokens = maxTokensValue;
    }

    const response = await this.client.chat.completions.create(requestParams);
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
