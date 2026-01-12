/**
 * ARC Investment Factory - Twitter/X API Client
 * 
 * Twitter API client for social sentiment analysis.
 * Note: Uses Perplexity API as fallback for Twitter data since direct API access is limited.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Tweet {
  id: string;
  text: string;
  author_id: string;
  author_username?: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  sentiment?: 'bullish' | 'bearish' | 'neutral';
}

export interface TwitterSentiment {
  ticker: string;
  timestamp: string;
  tweet_count_24h: number;
  sentiment_score: number; // -1 to 1
  bullish_percentage: number;
  bearish_percentage: number;
  neutral_percentage: number;
  top_tweets: Tweet[];
  influential_accounts: string[];
  trending_hashtags: string[];
}

// ============================================================================
// TWITTER CLIENT
// ============================================================================

export class TwitterClient {
  private bearerToken: string;
  private perplexityKey: string;

  constructor(bearerToken?: string) {
    this.bearerToken = bearerToken || process.env.TWITTER_BEARER_TOKEN || '';
    this.perplexityKey = process.env.SONAR_API_KEY || '';

    if (!this.bearerToken && !this.perplexityKey) {
      console.warn('[TwitterClient] No API credentials configured');
    }
  }

  /**
   * Search tweets for a ticker (uses Perplexity as fallback)
   */
  async searchTicker(ticker: string): Promise<TwitterSentiment> {
    // If we have Twitter API access, use it
    if (this.bearerToken) {
      return this.searchWithTwitterAPI(ticker);
    }

    // Otherwise, use Perplexity to get Twitter sentiment summary
    if (this.perplexityKey) {
      return this.searchWithPerplexity(ticker);
    }

    // Return empty result if no API available
    return this.getEmptySentiment(ticker);
  }

  /**
   * Search using Twitter API directly
   */
  private async searchWithTwitterAPI(ticker: string): Promise<TwitterSentiment> {
    try {
      const query = encodeURIComponent(`$${ticker} OR #${ticker} -is:retweet lang:en`);
      const response = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=100&tweet.fields=created_at,public_metrics,author_id`,
        {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const data = await response.json() as { data?: Tweet[] };
      const tweets: Tweet[] = data.data || [];

      return this.analyzeTweets(ticker, tweets);
    } catch (error) {
      console.error(`[TwitterClient] API error for ${ticker}:`, error);
      return this.getEmptySentiment(ticker);
    }
  }

  /**
   * Search using Perplexity API as fallback
   */
  private async searchWithPerplexity(ticker: string): Promise<TwitterSentiment> {
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
              content: 'You are a financial analyst. Analyze Twitter/X sentiment for stocks. Return JSON only.',
            },
            {
              role: 'user',
              content: `Analyze the current Twitter/X sentiment for ${ticker} stock. Return a JSON object with:
{
  "tweet_count_estimate": number (estimated tweets in last 24h),
  "sentiment_score": number (-1 to 1, where -1 is very bearish, 1 is very bullish),
  "bullish_percentage": number (0-100),
  "bearish_percentage": number (0-100),
  "neutral_percentage": number (0-100),
  "key_themes": string[] (main topics being discussed),
  "influential_accounts": string[] (notable accounts discussing this stock),
  "trending_hashtags": string[] (related hashtags)
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
        return this.getEmptySentiment(ticker);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        ticker,
        timestamp: new Date().toISOString(),
        tweet_count_24h: parsed.tweet_count_estimate || 0,
        sentiment_score: parsed.sentiment_score || 0,
        bullish_percentage: parsed.bullish_percentage || 33,
        bearish_percentage: parsed.bearish_percentage || 33,
        neutral_percentage: parsed.neutral_percentage || 34,
        top_tweets: [],
        influential_accounts: parsed.influential_accounts || [],
        trending_hashtags: parsed.trending_hashtags || [],
      };
    } catch (error) {
      console.error(`[TwitterClient] Perplexity error for ${ticker}:`, error);
      return this.getEmptySentiment(ticker);
    }
  }

  /**
   * Analyze tweets and calculate sentiment
   */
  private analyzeTweets(ticker: string, tweets: Tweet[]): TwitterSentiment {
    let bullish = 0;
    let bearish = 0;
    let neutral = 0;

    const bullishTerms = [
      'buy', 'long', 'bullish', 'moon', 'rocket', 'calls', 'breakout',
      'undervalued', 'strong', 'growth', 'accumulate', 'oversold',
    ];

    const bearishTerms = [
      'sell', 'short', 'bearish', 'crash', 'puts', 'dump', 'overvalued',
      'weak', 'decline', 'avoid', 'overbought', 'bubble',
    ];

    for (const tweet of tweets) {
      const text = tweet.text.toLowerCase();
      let bullishScore = 0;
      let bearishScore = 0;

      for (const term of bullishTerms) {
        if (text.includes(term)) bullishScore++;
      }
      for (const term of bearishTerms) {
        if (text.includes(term)) bearishScore++;
      }

      if (bullishScore > bearishScore) {
        bullish++;
        tweet.sentiment = 'bullish';
      } else if (bearishScore > bullishScore) {
        bearish++;
        tweet.sentiment = 'bearish';
      } else {
        neutral++;
        tweet.sentiment = 'neutral';
      }
    }

    const total = tweets.length || 1;
    const sentimentScore = (bullish - bearish) / total;

    // Extract hashtags
    const hashtagRegex = /#(\w+)/g;
    const hashtags = new Map<string, number>();
    for (const tweet of tweets) {
      const matches = tweet.text.matchAll(hashtagRegex);
      for (const match of matches) {
        const tag = match[1].toLowerCase();
        hashtags.set(tag, (hashtags.get(tag) || 0) + 1);
      }
    }

    const trendingHashtags = Array.from(hashtags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => `#${tag}`);

    return {
      ticker,
      timestamp: new Date().toISOString(),
      tweet_count_24h: tweets.length,
      sentiment_score: sentimentScore,
      bullish_percentage: (bullish / total) * 100,
      bearish_percentage: (bearish / total) * 100,
      neutral_percentage: (neutral / total) * 100,
      top_tweets: tweets
        .sort((a, b) => (b.public_metrics?.like_count || 0) - (a.public_metrics?.like_count || 0))
        .slice(0, 10),
      influential_accounts: [],
      trending_hashtags: trendingHashtags,
    };
  }

  /**
   * Get empty sentiment result
   */
  private getEmptySentiment(ticker: string): TwitterSentiment {
    return {
      ticker,
      timestamp: new Date().toISOString(),
      tweet_count_24h: 0,
      sentiment_score: 0,
      bullish_percentage: 0,
      bearish_percentage: 0,
      neutral_percentage: 0,
      top_tweets: [],
      influential_accounts: [],
      trending_hashtags: [],
    };
  }

  /**
   * Search tweets (alias for searchTicker for hub compatibility)
   */
  async searchTweets(
    query: string,
    limit: number = 100
  ): Promise<{ success: boolean; data?: TwitterSentiment; error?: string }> {
    try {
      // Extract ticker from query (remove $ prefix if present)
      const ticker = query.replace(/^\$/, '').toUpperCase();
      const data = await this.searchTicker(ticker);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if the client is configured
   */
  isConfigured(): boolean {
    return !!this.bearerToken || !!this.perplexityKey;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let clientInstance: TwitterClient | null = null;

export function getTwitterClient(): TwitterClient {
  if (!clientInstance) {
    clientInstance = new TwitterClient();
  }
  return clientInstance;
}

export function resetTwitterClient(): void {
  clientInstance = null;
}
