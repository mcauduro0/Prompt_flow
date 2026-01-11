/**
 * ARC Investment Factory - LLM Client Types
 */

export type LLMProvider = 'openai' | 'anthropic';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export interface LLMClient {
  complete(request: LLMRequest): Promise<LLMResponse>;
  getProvider(): LLMProvider;
  getModel(): string;
}

export interface PromptTemplate {
  name: string;
  version: number;
  systemPrompt: string;
  userPromptTemplate: string;
  outputSchema?: string;
}

// Default models following Build Pack
export const DEFAULT_MODELS = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
} as const;

// Token limits
export const TOKEN_LIMITS = {
  'gpt-4o': 128000,
  'claude-sonnet-4-20250514': 200000,
} as const;
