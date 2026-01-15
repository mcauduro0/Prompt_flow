/**
 * Lane 0 - Reddit Ingestor
 * 
 * Módulo responsável por:
 * 1. Buscar posts e comentários de subreddits de investimento
 * 2. Filtrar conteúdo de qualidade (upvotes, awards, etc.)
 * 3. Extrair ideias de investimento usando LLM com abordagem MODERADA
 * 4. Retornar ideias brutas normalizadas
 * 
 * ATUALIZADO: Filtros menos conservadores para capturar mais ideias
 */

import type { LLMClient, LLMRequest } from '@arc/llm-client';
import { Lane0StateManager } from './state-manager.js';
import type { RawIdea } from './substack-ingestor.js';

// Subreddits de investimento ordenados por qualidade/relevância
// ATUALIZADO: Reduzido minUpvotes em ~50% para capturar mais conteúdo
export const INVESTMENT_SUBREDDITS = [
  { name: 'ValueInvesting', priority: 1, minUpvotes: 20 },
  { name: 'SecurityAnalysis', priority: 1, minUpvotes: 15 },
  { name: 'InvestmentClub', priority: 1, minUpvotes: 10 },
  { name: 'stocks', priority: 2, minUpvotes: 50 },
  { name: 'investing', priority: 2, minUpvotes: 50 },
  { name: 'StockMarket', priority: 2, minUpvotes: 35 },
  { name: 'dividends', priority: 2, minUpvotes: 25 },
  { name: 'wallstreetbets', priority: 3, minUpvotes: 200 },
  { name: 'options', priority: 3, minUpvotes: 50 },
  { name: 'semiconductor', priority: 4, minUpvotes: 15 },
  { name: 'energy_stocks', priority: 4, minUpvotes: 10 },
  { name: 'biotech', priority: 4, minUpvotes: 15 },
];

// Interface para post do Reddit
export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  score: number;
  numComments: number;
  createdUtc: number;
  url: string;
  permalink: string;
  awards: number;
  flairText?: string;
  isDD?: boolean;
}

// Prompt MODERADO para extração de ideias do Reddit
// ATUALIZADO: Menos restritivo, aceita mais tipos de conteúdo
const REDDIT_IDEA_EXTRACTION_PROMPT = `You are an investment analyst reviewing Reddit posts for potential investment ideas.

Your goal is to extract investment ideas that could be worth researching further. Be MODERATELY selective - we want quality ideas but don't want to miss good opportunities.

Extract an idea if ANY of the following criteria are met:
1. A specific ticker is mentioned with an investment thesis (bullish or bearish)
2. The post discusses company fundamentals, valuation, or competitive position
3. The post mentions a stock as part of a portfolio, watchlist, or investment idea
4. There is discussion of catalysts, earnings, or business developments
5. The post provides sector/industry analysis with specific stock mentions

You MAY extract ideas that:
- Are part of a list of stocks or portfolio discussion
- Mention stocks for 2025/2026 watchlists or predictions
- Discuss turnaround stories or special situations
- Include technical analysis IF combined with fundamental reasoning
- Are questions that contain investment theses

DO NOT extract ideas that are:
- Pure pump-and-dump style posts with no substance
- Meme stocks mentioned only as jokes
- Posts asking basic questions without any analysis
- Pure options plays without underlying thesis

Subreddit: {{subreddit}}
Post Score: {{score}} upvotes
Awards: {{awards}}
Flair: {{flair}}

Title: {{title}}

Content:
{{content}}

Respond in JSON format:
{
  "ideas": [
    {
      "ticker": "AAPL",
      "companyName": "Apple Inc.",
      "direction": "LONG",
      "thesis": "Summary of the investment case",
      "confidence": "MEDIUM",
      "qualityScore": 5,
      "rawQuote": "Key quote from the post"
    }
  ],
  "rejectionReason": "If no ideas extracted, explain why"
}

Quality Score Guidelines:
- 8-10: Exceptional DD with comprehensive analysis
- 6-7: Good analysis with solid reasoning
- 4-5: Decent idea worth researching further
- 3: Marginal idea, minimal analysis
- Below 3: Do not extract

Minimum quality score to extract: 4

If no investment ideas meet the criteria, respond with: {"ideas": [], "rejectionReason": "explanation"}`;

interface RedditApiResponse {
  data?: {
    children?: Array<{
      data: {
        id: string;
        title: string;
        selftext?: string;
        author: string;
        subreddit: string;
        score: number;
        num_comments: number;
        created_utc: number;
        permalink: string;
        total_awards_received?: number;
        link_flair_text?: string;
      };
    }>;
  };
}

export class RedditIngestor {
  private stateManager: Lane0StateManager;
  private llmClient: LLMClient;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  private clientId: string;
  private clientSecret: string;
  private userAgent: string;

  constructor(stateManager: Lane0StateManager, llmClient: LLMClient) {
    this.stateManager = stateManager;
    this.llmClient = llmClient;
    
    this.clientId = process.env.REDDIT_CLIENT_ID || '';
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
    this.userAgent = process.env.REDDIT_USER_AGENT || 'AIGO-Lane0/1.0';
  }

  /**
   * Obtém token de acesso do Reddit
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Reddit auth failed: ${response.status}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);
    
    return this.accessToken;
  }

  /**
   * Busca posts de um subreddit
   */
  async fetchSubredditPosts(
    subreddit: string, 
    sort: 'hot' | 'new' | 'top' = 'hot',
    limit: number = 50, // ATUALIZADO: Aumentado de 25 para 50
    timeframe: 'day' | 'week' = 'week' // ATUALIZADO: Aumentado de 'day' para 'week'
  ): Promise<RedditPost[]> {
    const posts: RedditPost[] = [];
    
    try {
      const token = await this.getAccessToken();
      
      const url = `https://oauth.reddit.com/r/${subreddit}/${sort}?limit=${limit}&t=${timeframe}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        console.error(`[RedditIngestor] Error fetching r/${subreddit}: ${response.status}`);
        return posts;
      }

      const data = await response.json() as RedditApiResponse;
      
      if (data.data && data.data.children) {
        for (const child of data.data.children) {
          const post = child.data;
          
          posts.push({
            id: post.id,
            title: post.title,
            selftext: post.selftext || '',
            author: post.author,
            subreddit: post.subreddit,
            score: post.score,
            numComments: post.num_comments,
            createdUtc: post.created_utc,
            url: `https://reddit.com${post.permalink}`,
            permalink: post.permalink,
            awards: post.total_awards_received || 0,
            flairText: post.link_flair_text,
            isDD: post.link_flair_text?.toLowerCase().includes('dd') || 
                  post.link_flair_text?.toLowerCase().includes('due diligence') ||
                  post.title.toLowerCase().includes('[dd]'),
          });
        }
      }
    } catch (error) {
      console.error(`[RedditIngestor] Error fetching r/${subreddit}:`, error);
    }

    return posts;
  }

  /**
   * Filtra posts por qualidade
   * ATUALIZADO: Filtros menos conservadores
   */
  private filterHighQualityPosts(posts: RedditPost[], subredditConfig: typeof INVESTMENT_SUBREDDITS[0]): RedditPost[] {
    return posts.filter(post => {
      // Sempre aceitar posts marcados como DD
      if (post.isDD) return true;
      
      // Verificar upvotes mínimos
      if (post.score < subredditConfig.minUpvotes) return false;
      
      // ATUALIZADO: Reduzido de 200 para 100 caracteres
      if (post.selftext.length < 100) return false;
      
      // ATUALIZADO: Reduzido de 5 para 2 comentários
      if (post.numComments < 2) return false;
      
      return true;
    });
  }

  /**
   * Extrai ideias de investimento de um post usando LLM
   */
  async extractIdeasFromPost(post: RedditPost): Promise<RawIdea[]> {
    const ideas: RawIdea[] = [];
    
    const cursor = await this.stateManager.getCursor('reddit', post.subreddit);
    if (cursor && cursor.processedIds?.includes(post.id)) {
      console.log(`[RedditIngestor] Post already processed: ${post.id}`);
      return ideas;
    }

    const userPrompt = REDDIT_IDEA_EXTRACTION_PROMPT
      .replace('{{subreddit}}', post.subreddit)
      .replace('{{score}}', post.score.toString())
      .replace('{{awards}}', post.awards.toString())
      .replace('{{flair}}', post.flairText || 'None')
      .replace('{{title}}', post.title)
      .replace('{{content}}', post.selftext.substring(0, 8000));

    try {
      const request: LLMRequest = {
        messages: [
          { role: 'system', content: 'You are an investment analyst. Extract investment ideas from Reddit content. Be moderately selective - capture quality ideas without being overly restrictive.' },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        jsonMode: true
      };

      const response = await this.llmClient.complete(request);
      const result = JSON.parse(response.content) as { 
        ideas?: Array<{ 
          ticker: string; 
          companyName?: string; 
          direction?: string; 
          thesis: string; 
          qualityScore?: number; 
          rawQuote?: string;
        }>; 
        rejectionReason?: string;
      };
      
      if (result.ideas && Array.isArray(result.ideas)) {
        for (const idea of result.ideas) {
          // ATUALIZADO: Reduzido qualityScore mínimo de 6 para 4
          if (idea.ticker && idea.thesis && (idea.qualityScore || 0) >= 4) {
            ideas.push({
              ticker: idea.ticker.toUpperCase(),
              companyName: idea.companyName,
              direction: (idea.direction as 'LONG' | 'SHORT' | 'NEUTRAL') || 'NEUTRAL',
              thesis: idea.thesis,
              source: {
                type: 'reddit',
                name: `r/${post.subreddit}`,
                url: post.url,
                author: post.author,
                publishedAt: new Date(post.createdUtc * 1000),
              },
              confidence: this.mapQualityToConfidence(idea.qualityScore || 0),
              extractedAt: new Date(),
              rawQuote: idea.rawQuote,
            });
          }
        }
      }

      if (result.rejectionReason && ideas.length === 0) {
        console.log(`[RedditIngestor] Rejected post ${post.id}: ${result.rejectionReason}`);
      }

      const currentCursor = await this.stateManager.getCursor('reddit', post.subreddit);
      const processedIds = currentCursor?.processedIds || [];
      processedIds.push(post.id);
      
      if (processedIds.length > 1000) {
        processedIds.splice(0, processedIds.length - 1000);
      }

      await this.stateManager.updateCursor('reddit', post.subreddit, {
        lastProcessedId: post.id,
        lastProcessedAt: new Date(),
        lastSuccessAt: new Date(),
        processedIds: processedIds,
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[RedditIngestor] Error extracting ideas from ${post.id}:`, error);
      
      await this.stateManager.updateCursor('reddit', post.subreddit, {
        lastProcessedId: post.id,
        lastProcessedAt: new Date(),
        lastError: errorMessage,
      });
    }

    return ideas;
  }

  private mapQualityToConfidence(qualityScore: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (qualityScore >= 7) return 'HIGH';
    if (qualityScore >= 5) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Executa ingestão completa do Reddit
   */
  async ingest(): Promise<RawIdea[]> {
    console.log('[RedditIngestor] Starting Reddit ingestion (MODERATE filtering)...');
    
    const allIdeas: RawIdea[] = [];
    
    for (const subredditConfig of INVESTMENT_SUBREDDITS) {
      console.log(`[RedditIngestor] Processing r/${subredditConfig.name}...`);
      
      try {
        // ATUALIZADO: Buscar mais posts e de período maior
        const hotPosts = await this.fetchSubredditPosts(subredditConfig.name, 'hot', 50);
        const topPosts = await this.fetchSubredditPosts(subredditConfig.name, 'top', 50, 'week');
        const newPosts = await this.fetchSubredditPosts(subredditConfig.name, 'new', 25);
        
        const allPosts = [...hotPosts];
        for (const post of [...topPosts, ...newPosts]) {
          if (!allPosts.find(p => p.id === post.id)) {
            allPosts.push(post);
          }
        }
        
        const qualityPosts = this.filterHighQualityPosts(allPosts, subredditConfig);
        
        console.log(`[RedditIngestor] r/${subredditConfig.name}: ${allPosts.length} posts, ${qualityPosts.length} passed filters`);
        
        for (const post of qualityPosts) {
          const ideas = await this.extractIdeasFromPost(post);
          allIdeas.push(...ideas);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
      } catch (error) {
        console.error(`[RedditIngestor] Error processing r/${subredditConfig.name}:`, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`[RedditIngestor] Extracted ${allIdeas.length} ideas from Reddit`);
    
    return allIdeas;
  }
}

export default RedditIngestor;
