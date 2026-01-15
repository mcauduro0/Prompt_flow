/**
 * Lane 0 - Substack Ingestor
 * 
 * Módulo responsável por:
 * 1. Autenticar no Substack via cookies de sessão
 * 2. Buscar posts recentes das newsletters assinadas
 * 3. Extrair ideias de investimento usando LLM
 * 4. Retornar ideias brutas normalizadas
 * 
 * ATUALIZADO: Prompt menos conservador para aceitar listas, portfolios e watchlists
 */

import type { LLMClient, LLMRequest } from '@arc/llm-client';
import { Lane0StateManager } from './state-manager.js';

// Lista de newsletters de investimento do Substack (31 fontes)
export const INVESTMENT_NEWSLETTERS = [
  // Tier 1 - Core Value Investing & Quality
  { slug: 'deepvaluecapitalbykyler', name: 'Deep Value Capital by Kyler', priority: 1, url: 'https://deepvaluecapitalbykyler.substack.com/' },
  { slug: 'compoundingquality', name: 'Compounding Quality', priority: 1, url: 'https://www.compoundingquality.net/' },
  { slug: 'multibaggerideas', name: 'Multibagger Ideas', priority: 1, url: 'https://multibaggerideas.substack.com/' },
  { slug: 'schwarcapital', name: 'Schwar Capital', priority: 1, url: 'https://www.schwarcapital.com/' },
  { slug: 'potentialmultibaggers', name: 'Potential Multibaggers', priority: 1, url: 'https://www.potentialmultibaggers.com/' },
  { slug: 'investinassets', name: 'Invest In Assets', priority: 1, url: 'https://www.investinassets.net/' },
  { slug: 'heavymoatinvestments', name: 'Heavy Moat Investments', priority: 1, url: 'https://heavymoatinvestments.substack.com/' },
  { slug: '100baggerhunting', name: '100 Bagger Hunting', priority: 1, url: 'https://www.100baggerhunting.com/' },
  
  // Tier 2 - Growth & Tech Focus
  { slug: 'hypertechinvest', name: 'Hypertech Invest', priority: 1, url: 'https://hypertechinvest.com/' },
  { slug: 'capitalist-letters', name: 'Capitalist Letters', priority: 1, url: 'https://www.capitalist-letters.com' },
  { slug: 'asymmetricfinance', name: 'Asymmetric Finance', priority: 1, url: 'https://www.asymmetricfinance.co/' },
  { slug: 'capitalemployed', name: 'Capital Employed', priority: 1, url: 'https://www.capitalemployed.com/' },
  { slug: 'generational', name: 'Generational', priority: 1, url: 'https://www.generational.pub/' },
  
  // Tier 3 - Macro & Market Analysis
  { slug: 'variantperception', name: 'Variant Perception', priority: 2, url: 'https://blog.variantperception.com/' },
  { slug: 'fidenzamacro', name: 'Fidenza Macro', priority: 2, url: 'https://www.fidenzamacro.com/' },
  { slug: 'citriniresearch', name: 'Citrini Research', priority: 2, url: 'https://www.citriniresearch.com/' },
  { slug: 'marketsentiment', name: 'Market Sentiment', priority: 2, url: 'https://www.marketsentiment.co/' },
  
  // Tier 4 - Deep Research & Analysis
  { slug: 'quanta72', name: 'Quanta 72', priority: 1, url: 'https://quanta72.substack.com/' },
  { slug: 'stockanalysiscompilation', name: 'Stock Analysis Compilation', priority: 1, url: 'https://stockanalysiscompilation.substack.com/' },
  { slug: 'superfluousvalue', name: 'Superfluous Value', priority: 1, url: 'https://superfluousvalue.substack.com/' },
  { slug: 'hiddenvalueideas', name: 'Hidden Value Ideas', priority: 1, url: 'https://hiddenvalueideas.substack.com/' },
  { slug: 'roetheboat', name: 'ROE The Boat', priority: 1, url: 'https://www.roetheboat.com/' },
  { slug: 'valueinvestingworld', name: 'Value Investing World', priority: 1, url: 'https://valueinvestingworld.substack.com/' },
  
  // Tier 5 - Short Selling & Contrarian
  { slug: 'thebearcave', name: 'The Bear Cave', priority: 2, url: 'https://thebearcave.substack.com/' },
  
  // Tier 6 - Small Caps & Micro Caps
  { slug: 'tinytitans', name: 'Tiny Titans', priority: 1, url: 'https://tinytitans.substack.com/' },
  { slug: 'microcapinterviews', name: 'Microcap Interviews', priority: 1, url: 'https://microcapinterviews.substack.com' },
  
  // Tier 7 - Legendary Investors & Wisdom
  { slug: 'vitaliy', name: 'Vitaliy Katsenelson', priority: 2, url: 'https://vitaliy.substack.com/' },
  { slug: 'gspier', name: 'Guy Spier', priority: 2, url: 'https://gspier.substack.com/' },
  { slug: 'michaeljburry', name: 'Michael J. Burry', priority: 1, url: 'https://michaeljburry.substack.com/' },
  
  // Tier 8 - DIY & Educational
  { slug: 'diyinvestingstocks', name: 'DIY Investing Stocks', priority: 2, url: 'https://diyinvestingstocks.substack.com/' },
  { slug: 'continuouscompounding', name: 'Continuous Compounding', priority: 2, url: 'https://continuouscompounding.substack.com/' },
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

// Prompt para extração de ideias - ATUALIZADO para ser menos conservador
const IDEA_EXTRACTION_PROMPT = `You are an expert investment analyst tasked with extracting investment ideas from newsletter content.

Your goal is to capture ALL potential investment ideas mentioned in the content. Be INCLUSIVE rather than exclusive.

EXTRACT ideas in these scenarios:
1. Explicit stock recommendations with thesis
2. Stocks mentioned in portfolio updates or holdings
3. Stocks in watchlists or "stocks to watch" sections
4. 2025/2026 predictions, outlooks, or stock picks
5. Stocks mentioned as interesting opportunities
6. Stocks discussed with any fundamental or valuation commentary
7. Stocks in "best ideas" or "top picks" lists
8. Turnaround stories or special situations
9. Sector plays with specific stock mentions
10. Stocks the author is researching or considering

For PORTFOLIO/WATCHLIST posts:
- Extract EACH stock mentioned as a separate idea
- Use the context to infer the thesis (e.g., "Part of 2026 portfolio - selected for value characteristics")
- Set confidence to MEDIUM for list-based mentions without detailed thesis

For DETAILED ANALYSIS posts:
- Extract the main thesis and set confidence to HIGH

DO NOT extract:
- Generic market commentary without specific stocks
- Pure educational content without stock mentions
- Stocks mentioned only as negative examples (unless it's a short thesis)

Newsletter: {{newsletter}}
Author: {{author}}
Title: {{title}}

Content:
{{content}}

For each idea, identify:
1. The ticker symbol (if mentioned or can be inferred)
2. The company name
3. The direction (LONG for bullish, SHORT for bearish, NEUTRAL for informational/watchlist)
4. A concise thesis summarizing why this stock is mentioned
5. Your confidence level (HIGH for detailed analysis, MEDIUM for list mentions, LOW for brief mentions)

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

IMPORTANT: For portfolio/watchlist posts, extract ALL stocks mentioned, even if the thesis is brief.
If the title mentions "2026 portfolio", "2026 watchlist", "ideas for 2026", "top picks", etc., make sure to extract every stock mentioned.

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
   * ATUALIZADO: Aumentado de 5 para 10 posts por newsletter
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
      
      // ATUALIZADO: Aumentado de 5 para 10 posts
      for (const item of items.slice(0, 10)) {
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
          { role: 'system', content: 'You are an expert investment analyst. Extract ALL investment ideas from newsletter content, including those from portfolios, watchlists, and stock lists. Be inclusive rather than exclusive.' },
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
      
      // ATUALIZADO: Aumentado limite de 100 para 200 IDs
      if (processedIds.length > 200) {
        processedIds.splice(0, processedIds.length - 200);
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
    console.log('[SubstackIngestor] Starting Substack ingestion (INCLUSIVE mode)...');
    
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
