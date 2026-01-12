/**
 * ARC Investment Factory - Gemini LLM Provider
 * Google Gemini API client implementation
 */

import type { LLMClient, LLMConfig, LLMProvider, LLMRequest, LLMResponse } from '../types.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiClient implements LLMClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config?: Partial<LLMConfig>) {
    this.apiKey = config?.apiKey || process.env.GEMINI_API_KEY || '';
    this.model = config?.model || 'gemini-2.5-flash';
    this.baseUrl = config?.baseUrl || GEMINI_API_BASE;

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is required for Gemini provider');
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    // Convert messages to Gemini format
    const contents = this.convertMessages(request.messages);
    
    // Build system instruction if present
    const systemMessage = request.messages.find(m => m.role === 'system');
    
    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.2,
        maxOutputTokens: request.maxTokens ?? 4000,
        topP: 0.95,
        topK: 40,
      },
    };

    // Add system instruction if present
    if (systemMessage) {
      requestBody.systemInstruction = {
        parts: [{ text: systemMessage.content }],
      };
    }

    // Enable JSON mode if requested
    if (request.jsonMode) {
      requestBody.generationConfig.responseMimeType = 'application/json';
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as GeminiResponse;

    // Extract content from response
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract usage metadata
    const usage = data.usageMetadata || {};

    return {
      content,
      model: this.model,
      usage: {
        promptTokens: usage.promptTokenCount || 0,
        completionTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0,
      },
      finishReason: data.candidates?.[0]?.finishReason || 'STOP',
    };
  }

  getProvider(): LLMProvider {
    return 'google' as LLMProvider;
  }

  getModel(): string {
    return this.model;
  }

  /**
   * Convert OpenAI-style messages to Gemini format
   */
  private convertMessages(messages: LLMRequest['messages']): GeminiContent[] {
    const contents: GeminiContent[] = [];
    
    for (const message of messages) {
      // Skip system messages (handled separately)
      if (message.role === 'system') continue;
      
      contents.push({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      });
    }

    return contents;
  }
}

// Gemini API types
interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text: string }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}
