/**
 * ARC Investment Factory - Social Trends Client
 * 
 * Provides inferred social sentiment and trending topics from web sources.
 * 
 * IMPORTANT: This client does NOT access Twitter/X API directly.
 * Data is derived from Perplexity AI web search which aggregates
 * publicly available social media discussions and trends.
 * 
 * Use this for:
 * - General social sentiment inference
 * - Trending topics related to tickers
 * - Web-aggregated social discussions
 * 
 * DO NOT use this when:
 * - Direct Twitter/X API data is required
 * - Real-time tweet streams are needed
 * - Exact tweet counts or metrics are critical
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SocialPost {
  id: string;
  text: string;
  source: 'web_aggregated'; // Always web_aggregated, not direct Twitter
  author?: string;
  timestamp: string;
  engagement_estimate?: {
    likes: number;
    shares: number;
    comments: number;
  };
  sentiment?: 'bullish' | 'bearish' | 'neutral';
}

export interface SocialTrendsSentiment {
  ticker: string;
  timestamp: string;
  data_source: 'perplexity_web_inference'; // Explicit source declaration
  data_freshness: 'inferred_recent'; // Not real-time
  disclaimer: string; // Always present
  estimated_discussion_volume: number; // Estimate, not exact count
  sentiment_score: number; // -1 to 1
  bullish_percentage: number;
  bearish_percentage: number;
  neutral_percentage: number;
  key_themes: string[];
  notable_discussions: SocialPost[];
  trending_topics: string[];
}

// ============================================================================
// SOCIAL TRENDS CLIENT
// ============================================================================

export class SocialTrendsClient {
  private perplexityKey: string;
  private readonly DATA_SOURCE = 'perplexity_web_inference';
  private readonly DISCLAIMER = 'Data derived from web search aggregation, not direct social media API access. Metrics are estimates based on publicly available discussions.';

  constructor() {
    this.perplexityKey = process.env.SONAR_API_KEY || '';

    if (!this.perplexityKey) {
      console.warn('[SocialTrendsClient] No Perplexity API key configured');
    }
  }

  /**
   * Get social trends and sentiment for a ticker
   * 
   * NOTE: This uses Perplexity web search to infer social sentiment,
   * NOT direct access to any social media platform API.
   */
  async getSocialTrends(ticker: string): Promise<SocialTrendsSentiment> {
    if (!this.perplexityKey) {
      return this.getEmptyResult(ticker);
    }

    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.perplexityKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: `You are a financial analyst. Analyze publicly available social media discussions and web sentiment for stocks. 
Return JSON only. Be clear that this is aggregated web data, not direct platform API data.`,
            },
            {
              role: 'user',
              content: `Analyze the current social media sentiment and web discussions for ${ticker} stock. 
Search across Reddit, StockTwits, financial forums, and general web discussions.

Return a JSON object with:
{
  "estimated_discussion_volume": number (rough estimate of recent discussions),
  "sentiment_score": number (-1 to 1, where -1 is very bearish, 1 is very bullish),
  "bullish_percentage": number (0-100),
  "bearish_percentage": number (0-100),
  "neutral_percentage": number (0-100),
  "key_themes": string[] (main topics being discussed about this stock),
  "notable_discussions": string[] (summaries of notable recent discussions),
  "trending_topics": string[] (related trending topics)
}`,
            },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content || '{}';

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getEmptyResult(ticker);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Convert notable discussions to SocialPost format
      const notableDiscussions: SocialPost[] = (parsed.notable_discussions || [])
        .slice(0, 5)
        .map((text: string, index: number) => ({
          id: `web_${ticker}_${Date.now()}_${index}`,
          text: typeof text === 'string' ? text : String(text),
          source: 'web_aggregated' as const,
          timestamp: new Date().toISOString(),
          sentiment: 'neutral' as const,
        }));

      return {
        ticker,
        timestamp: new Date().toISOString(),
        data_source: this.DATA_SOURCE,
        data_freshness: 'inferred_recent',
        disclaimer: this.DISCLAIMER,
        estimated_discussion_volume: parsed.estimated_discussion_volume || 0,
        sentiment_score: parsed.sentiment_score || 0,
        bullish_percentage: parsed.bullish_percentage || 33,
        bearish_percentage: parsed.bearish_percentage || 33,
        neutral_percentage: parsed.neutral_percentage || 34,
        key_themes: parsed.key_themes || [],
        notable_discussions: notableDiscussions,
        trending_topics: parsed.trending_topics || [],
      };
    } catch (error) {
      console.error(`[SocialTrendsClient] Error for ${ticker}:`, error);
      return this.getEmptyResult(ticker);
    }
  }

  /**
   * Search social trends (alias for getSocialTrends for hub compatibility)
   */
  async searchSocialTrends(
    query: string,
    _limit: number = 100
  ): Promise<{ success: boolean; data?: SocialTrendsSentiment; error?: string }> {
    try {
      // Extract ticker from query (remove $ prefix if present)
      const ticker = query.replace(/^\$/, '').toUpperCase();
      const data = await this.getSocialTrends(ticker);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get empty result with proper metadata
   */
  private getEmptyResult(ticker: string): SocialTrendsSentiment {
    return {
      ticker,
      timestamp: new Date().toISOString(),
      data_source: this.DATA_SOURCE,
      data_freshness: 'inferred_recent',
      disclaimer: this.DISCLAIMER,
      estimated_discussion_volume: 0,
      sentiment_score: 0,
      bullish_percentage: 0,
      bearish_percentage: 0,
      neutral_percentage: 0,
      key_themes: [],
      notable_discussions: [],
      trending_topics: [],
    };
  }

  /**
   * Check if the client is configured
   */
  isConfigured(): boolean {
    return !!this.perplexityKey;
  }

  /**
   * Get the data source identifier
   */
  getDataSource(): string {
    return this.DATA_SOURCE;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let clientInstance: SocialTrendsClient | null = null;

export function getSocialTrendsClient(): SocialTrendsClient {
  if (!clientInstance) {
    clientInstance = new SocialTrendsClient();
  }
  return clientInstance;
}

export function resetSocialTrendsClient(): void {
  clientInstance = null;
}
