/**
 * ARC Investment Factory - LLM Client Types
 */

export type LLMProvider = 'openai' | 'anthropic' | 'google';

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
  openai: 'gpt-5.2',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.5-flash',
} as const;

// Token limits
export const TOKEN_LIMITS = {
  // GPT-5 Series
  'gpt-5.2-pro': 256000,
  'gpt-5.2': 256000,
  'gpt-5.1': 256000,
  'gpt-5-pro': 256000,
  'gpt-5': 256000,
  'gpt-5-mini': 128000,
  'gpt-5-nano': 64000,
  // GPT-4 Series
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  // Anthropic
  'claude-sonnet-4-20250514': 200000,
  'claude-3-opus-20240229': 200000,
  // Google
  'gemini-2.5-flash': 1000000,
  'gemini-2.5-pro': 2000000,
} as const;
