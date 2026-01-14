/**
 * Lane 0 - Substack Ingestor
 * 
 * Módulo responsável por:
 * 1. Autenticar no Substack via cookies de sessão
 * 2. Buscar posts recentes das newsletters assinadas
 * 3. Extrair ideias de investimento usando LLM
 * 4. Retornar ideias brutas normalizadas
 */

import type { LLMClient, LLMRequest } from '@arc/llm-client';
import { Lane0StateManager } from './state-manager.js';

// Lista de newsletters de investimento do Substack
export const INVESTMENT_NEWSLETTERS = [
  { slug: 'compoundingquality', name: 'Compounding Quality', priority: 1 },
  { slug: 'capitalistletters', name: 'Capitalist Letters', priority: 1 },
  { slug: 'citriniresearch', name: 'Citrini Research', priority: 1 },
  { slug: 'schwarcapital', name: 'Schwar Capital Research', priority: 1 },
  { slug: 'doomberg', name: 'Doomberg', priority: 2 },
  { slug: 'a16z', name: 'a16z', priority: 2 },
  { slug: 'semianalysis', name: 'SemiAnalysis', priority: 1 },
  { slug: 'theaimaker', name: 'The AI Maker', priority: 3 },
  { slug: 'aimadessimple', name: 'AI Made Simple', priority: 3 },
  { slug: 'marketsentiment', name: 'Market Sentiment', priority: 2 },
];

// Interface para ideia bruta extraída
export interface RawIdea {
  ticker: string;
  companyName?: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  thesis: string;
  source: {
    type: 'substack' | 'reddit';
    name: string;
    url: string;
    author: string;
    publishedAt: Date;
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  extractedAt: Date;
  rawQuote?: string;
}

// Interface para post do Substack
export interface SubstackPost {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  publishedAt: Date;
  author: string;
  newsletter: string;
  url: string;
  content: string;
}

// Prompt para extração de ideias
const IDEA_EXTRACTION_PROMPT = `You are an expert investment analyst tasked with extracting actionable investment ideas from newsletter content.

IMPORTANT RULES:
- Only extract ideas where there is a clear investment thesis or recommendation
- Do NOT extract generic market commentary without specific stock mentions
- Do NOT extract ideas that are purely educational without actionable insights
- If no clear investment ideas are present, return an empty array
- Be conservative - only extract ideas with genuine investment merit

Newsletter: {{newsletter}}
Author: {{author}}
Title: {{title}}

Content:
{{content}}

For each idea, identify:
1. The ticker symbol (if mentioned or can be inferred)
2. The company name
3. The direction (LONG for bullish, SHORT for bearish, NEUTRAL for informational)
4. A concise thesis summarizing the investment case
5. Your confidence level based on how explicit the recommendation is

Respond in JSON format:
{
  "ideas": [
    {
      "ticker": "AAPL",
      "companyName": "Apple Inc.",
      "direction": "LONG",
      "thesis": "Strong services growth and AI integration position Apple for continued outperformance",
      "confidence": "HIGH",
      "rawQuote": "Exact quote from the article supporting this idea"
    }
  ]
}

If no investment ideas are found, respond with: {"ideas": []}`;

export class SubstackIngestor {
  private stateManager: Lane0StateManager;
  private llmClient: LLMClient;
  private sessionCookie: string | null = null;

  constructor(stateManager: Lane0StateManager, llmClient: LLMClient) {
    this.stateManager = stateManager;
    this.llmClient = llmClient;
  }

  /**
   * Configura o cookie de sessão do Substack
   */
  setSessionCookie(cookie: string): void {
    this.sessionCookie = cookie;
  }

  /**
   * Busca posts recentes de uma newsletter via RSS
   */
  async fetchNewsletterPosts(newsletter: typeof INVESTMENT_NEWSLETTERS[0]): Promise<SubstackPost[]> {
    const posts: SubstackPost[] = [];
    
    try {
      const rssUrl = `https://${newsletter.slug}.substack.com/feed`;
      
      const response = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'AIGO-Lane0/1.0',
        },
      });

      if (!response.ok) {
        console.error(`[SubstackIngestor] Error fetching ${newsletter.name}: ${response.status}`);
        return posts;
      }

      const xml = await response.text();
      
      // Parse RSS XML simples
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
      
      for (const item of items.slice(0, 5)) { // Últimos 5 posts
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || 
                     item.match(/<title>(.*?)<\/title>/)?.[1] || '';
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
        const description = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] || 
                           item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
        const author = item.match(/<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>/)?.[1] || newsletter.name;

        if (title && link) {
          posts.push({
            id: link.split('/').pop() || '',
            title,
            slug: link.split('/').pop() || '',
            publishedAt: new Date(pubDate),
            author,
            newsletter: newsletter.name,
            url: link,
            content: description.replace(/<[^>]*>/g, ''), // Remove HTML tags
          });
        }
      }
    } catch (error) {
      console.error(`[SubstackIngestor] Error fetching ${newsletter.name}:`, error);
    }

    return posts;
  }

  /**
   * Extrai ideias de investimento de um post usando LLM
   */
  async extractIdeasFromPost(post: SubstackPost): Promise<RawIdea[]> {
    const ideas: RawIdea[] = [];
    
    // Verificar se o post já foi processado
    const cursor = await this.stateManager.getCursor('substack', post.newsletter);
    if (cursor && cursor.processedIds?.includes(post.id)) {
      console.log(`[SubstackIngestor] Post already processed: ${post.id}`);
      return ideas;
    }

    // Preparar prompt com dados do post
    const userPrompt = IDEA_EXTRACTION_PROMPT
      .replace('{{newsletter}}', post.newsletter)
      .replace('{{author}}', post.author)
      .replace('{{title}}', post.title)
      .replace('{{content}}', post.content.substring(0, 12000));

    try {
      const request: LLMRequest = {
        messages: [
          { role: 'system', content: 'You are an expert investment analyst. Extract investment ideas from newsletter content.' },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        jsonMode: true
      };

      const response = await this.llmClient.complete(request);
      const result = JSON.parse(response.content);
      
      if (result.ideas && Array.isArray(result.ideas)) {
        for (const idea of result.ideas) {
          if (idea.ticker && idea.thesis) {
            ideas.push({
              ticker: idea.ticker.toUpperCase(),
              companyName: idea.companyName,
              direction: idea.direction || 'NEUTRAL',
              thesis: idea.thesis,
              source: {
                type: 'substack',
                name: post.newsletter,
                url: post.url,
                author: post.author,
                publishedAt: post.publishedAt,
              },
              confidence: idea.confidence || 'MEDIUM',
              extractedAt: new Date(),
              rawQuote: idea.rawQuote,
            });
          }
        }
      }

      // Atualizar cursor
      const currentCursor = await this.stateManager.getCursor('substack', post.newsletter);
      const processedIds = currentCursor?.processedIds || [];
      processedIds.push(post.id);
      
      if (processedIds.length > 100) {
        processedIds.splice(0, processedIds.length - 100);
      }

      await this.stateManager.updateCursor('substack', post.newsletter, {
        lastProcessedId: post.id,
        lastProcessedAt: new Date(),
        lastSuccessAt: new Date(),
        processedIds: processedIds,
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SubstackIngestor] Error extracting ideas from ${post.id}:`, error);
      
      await this.stateManager.updateCursor('substack', post.newsletter, {
        lastProcessedId: post.id,
        lastProcessedAt: new Date(),
        lastError: errorMessage,
      });
    }

    return ideas;
  }

  /**
   * Executa ingestão completa do Substack
   */
  async ingest(): Promise<RawIdea[]> {
    console.log('[SubstackIngestor] Starting Substack ingestion...');
    
    const allIdeas: RawIdea[] = [];
    
    // Ordenar newsletters por prioridade
    const sortedNewsletters = [...INVESTMENT_NEWSLETTERS].sort((a, b) => a.priority - b.priority);
    
    for (const newsletter of sortedNewsletters) {
      console.log(`[SubstackIngestor] Processing ${newsletter.name}...`);
      
      try {
        const posts = await this.fetchNewsletterPosts(newsletter);
        console.log(`[SubstackIngestor] Found ${posts.length} posts from ${newsletter.name}`);
        
        for (const post of posts) {
          const ideas = await this.extractIdeasFromPost(post);
          allIdeas.push(...ideas);
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`[SubstackIngestor] Error processing ${newsletter.name}:`, error);
      }
      
      // Pausa entre newsletters
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`[SubstackIngestor] Extracted ${allIdeas.length} ideas from Substack`);
    
    return allIdeas;
  }
}

export default SubstackIngestor;
