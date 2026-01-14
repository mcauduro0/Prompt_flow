/**
 * ARC Investment Factory - Reddit API Client
 * 
 * Reddit API client for social sentiment analysis from investment subreddits.
 * Documentation: https://www.reddit.com/dev/api/
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  url: string;
  permalink: string;
  link_flair_text?: string;
  is_self: boolean;
}

export interface RedditComment {
  id: string;
  body: string;
  author: string;
  score: number;
  created_utc: number;
  permalink: string;
}

export interface TickerMention {
  ticker: string;
  count: number;
  posts: RedditPost[];
  sentiment_score: number;
  avg_upvote_ratio: number;
  total_comments: number;
}

export interface SubredditSentiment {
  subreddit: string;
  ticker: string;
  mentions: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  sentiment_score: number; // -1 to 1
  top_posts: RedditPost[];
  sample_comments: string[];
}

export interface SocialSentimentData {
  ticker: string;
  timestamp: string;
  reddit_mentions_24h: number;
  reddit_sentiment: number;
  trending_rank?: number;
  subreddit_breakdown: SubredditSentiment[];
  top_posts: RedditPost[];
  key_themes: string[];
}

// ============================================================================
// REDDIT CLIENT
// ============================================================================

export class RedditClient {
  private clientId: string;
  private clientSecret: string;
  private userAgent: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  // Investment-focused subreddits
  private readonly INVESTMENT_SUBREDDITS = [
    // High-volume retail trading communities
    'wallstreetbets',
    'stocks',
    'stockmarket',
    'smallstreetbets',
    
    // Value investing and fundamental analysis
    'valueinvesting',
    'SecurityAnalysis',
    'ValueInvesting',
    'IntelligentInvestor',
    
    // General investing and portfolio management
    'investing',
    'portfolios',
    'Bogleheads',
    'financialindependence',
    
    // Income and dividend investing
    'dividends',
    'qyldgang',
    'dividendgang',
    
    // Options and derivatives
    'options',
    'thetagang',
    'vegagang',
    
    // Sector-specific communities
    'weedstocks',
    'biotech',
    'pennystocks',
    'spacs',
    'RobinHoodPennyStocks',
    
    // ETF and index investing
    'ETFs',
    'etfinvesting',
    
    // International markets
    'CanadianInvestor',
    'UKInvesting',
    'eupersonalfinance',
    
    // Crypto (for sentiment on crypto-related stocks)
    'CryptoCurrency',
    'Bitcoin',
  ];

  constructor(clientId?: string, clientSecret?: string, userAgent?: string) {
    this.clientId = clientId || process.env.REDDIT_CLIENT_ID || '';
    this.clientSecret = clientSecret || process.env.REDDIT_CLIENT_SECRET || '';
    this.userAgent = userAgent || process.env.REDDIT_USER_AGENT || 'ARC-Investment-Factory/1.0';

    if (!this.clientId || !this.clientSecret) {
      console.warn('[RedditClient] No API credentials configured');
    }
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    try {
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
        throw new Error(`Reddit auth error: ${response.status}`);
      }

      const data = await response.json() as { access_token: string; expires_in: number };
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

      return this.accessToken!;
    } catch (error) {
      console.error('[RedditClient] Auth error:', error);
      throw error;
    }
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest(endpoint: string): Promise<unknown> {
    const token = await this.getAccessToken();

    const response = await fetch(`https://oauth.reddit.com${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Search for posts mentioning a ticker
   */
  async searchTicker(
    ticker: string,
    options?: {
      subreddit?: string;
      time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      limit?: number;
      sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
    }
  ): Promise<RedditPost[]> {
    const subreddit = options?.subreddit || this.INVESTMENT_SUBREDDITS.join('+');
    const time = options?.time || 'week';
    const limit = options?.limit || 25;
    const sort = options?.sort || 'relevance';

    try {
      const data = await this.apiRequest(
        `/r/${subreddit}/search?q=${ticker}&restrict_sr=on&sort=${sort}&t=${time}&limit=${limit}`
      ) as { data: { children: Array<{ data: RedditPost }> } };

      return data.data.children.map((child) => child.data);
    } catch (error) {
      console.error(`[RedditClient] Search error for ${ticker}:`, error);
      return [];
    }
  }

  /**
   * Get hot posts from investment subreddits
   */
  async getHotPosts(
    subreddit?: string,
    limit: number = 25
  ): Promise<RedditPost[]> {
    const sub = subreddit || this.INVESTMENT_SUBREDDITS.join('+');

    try {
      const data = await this.apiRequest(
        `/r/${sub}/hot?limit=${limit}`
      ) as { data: { children: Array<{ data: RedditPost }> } };

      return data.data.children.map((child) => child.data);
    } catch (error) {
      console.error('[RedditClient] Hot posts error:', error);
      return [];
    }
  }

  /**
   * Get comments from a post
   */
  async getPostComments(
    subreddit: string,
    postId: string,
    limit: number = 50
  ): Promise<RedditComment[]> {
    try {
      const data = await this.apiRequest(
        `/r/${subreddit}/comments/${postId}?limit=${limit}&sort=top`
      ) as Array<{ data: { children: Array<{ data: RedditComment }> } }>;

      if (data.length < 2) return [];

      return data[1].data.children
        .filter((child) => child.data.body)
        .map((child) => child.data);
    } catch (error) {
      console.error('[RedditClient] Comments error:', error);
      return [];
    }
  }

  /**
   * Analyze sentiment of text
   */
  private analyzeSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
    const lowerText = text.toLowerCase();

    const bullishTerms = [
      'buy', 'calls', 'moon', 'rocket', 'bullish', 'long', 'undervalued',
      'breakout', 'squeeze', 'yolo', 'diamond hands', 'to the moon',
      'going up', 'strong buy', 'accumulate', 'oversold', 'bottom',
    ];

    const bearishTerms = [
      'sell', 'puts', 'short', 'bearish', 'overvalued', 'crash',
      'dump', 'tank', 'paper hands', 'bag holder', 'going down',
      'strong sell', 'overbought', 'top', 'bubble', 'avoid',
    ];

    let bullishScore = 0;
    let bearishScore = 0;

    for (const term of bullishTerms) {
      if (lowerText.includes(term)) bullishScore++;
    }

    for (const term of bearishTerms) {
      if (lowerText.includes(term)) bearishScore++;
    }

    if (bullishScore > bearishScore + 1) return 'bullish';
    if (bearishScore > bullishScore + 1) return 'bearish';
    return 'neutral';
  }

  /**
   * Get comprehensive social sentiment for a ticker
   */
  async getSocialSentiment(ticker: string): Promise<SocialSentimentData> {
    const posts = await this.searchTicker(ticker, { time: 'day', limit: 100 });

    // Group by subreddit
    const subredditMap = new Map<string, RedditPost[]>();
    for (const post of posts) {
      const sub = post.subreddit;
      if (!subredditMap.has(sub)) {
        subredditMap.set(sub, []);
      }
      subredditMap.get(sub)!.push(post);
    }

    // Analyze each subreddit
    const subredditBreakdown: SubredditSentiment[] = [];
    let totalBullish = 0;
    let totalBearish = 0;
    let totalNeutral = 0;

    for (const [subreddit, subPosts] of subredditMap) {
      let bullish = 0;
      let bearish = 0;
      let neutral = 0;

      for (const post of subPosts) {
        const sentiment = this.analyzeSentiment(post.title + ' ' + post.selftext);
        if (sentiment === 'bullish') bullish++;
        else if (sentiment === 'bearish') bearish++;
        else neutral++;
      }

      totalBullish += bullish;
      totalBearish += bearish;
      totalNeutral += neutral;

      const total = bullish + bearish + neutral;
      const sentimentScore = total > 0 ? (bullish - bearish) / total : 0;

      subredditBreakdown.push({
        subreddit,
        ticker,
        mentions: subPosts.length,
        bullish_count: bullish,
        bearish_count: bearish,
        neutral_count: neutral,
        sentiment_score: sentimentScore,
        top_posts: subPosts.slice(0, 3),
        sample_comments: [],
      });
    }

    // Calculate overall sentiment
    const totalPosts = totalBullish + totalBearish + totalNeutral;
    const overallSentiment = totalPosts > 0 ? (totalBullish - totalBearish) / totalPosts : 0;

    // Extract key themes from titles
    const themes = this.extractThemes(posts.map((p) => p.title));

    return {
      ticker,
      timestamp: new Date().toISOString(),
      reddit_mentions_24h: posts.length,
      reddit_sentiment: overallSentiment,
      subreddit_breakdown: subredditBreakdown.sort((a, b) => b.mentions - a.mentions),
      top_posts: posts.sort((a, b) => b.score - a.score).slice(0, 10),
      key_themes: themes,
    };
  }

  /**
   * Extract common themes from post titles
   */
  private extractThemes(titles: string[]): string[] {
    const themeKeywords: Record<string, string[]> = {
      'Earnings': ['earnings', 'eps', 'revenue', 'beat', 'miss', 'guidance'],
      'Options': ['calls', 'puts', 'options', 'expiry', 'strike'],
      'Short Squeeze': ['squeeze', 'short interest', 'shorts', 'gamma'],
      'Technical Analysis': ['breakout', 'support', 'resistance', 'chart', 'ta'],
      'Fundamentals': ['valuation', 'pe', 'growth', 'dividend', 'undervalued'],
      'News': ['news', 'announced', 'breaking', 'report'],
      'Momentum': ['moon', 'rocket', 'yolo', 'diamond hands'],
      'Risk': ['warning', 'careful', 'overvalued', 'bubble', 'crash'],
    };

    const themeCounts: Record<string, number> = {};
    const allText = titles.join(' ').toLowerCase();

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      for (const keyword of keywords) {
        if (allText.includes(keyword)) {
          themeCounts[theme] = (themeCounts[theme] || 0) + 1;
        }
      }
    }

    return Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme]) => theme);
  }

  /**
   * Get trending tickers from WSB and other subreddits
   */
  /**
   * Get ticker mentions (alias for getSocialSentiment for hub compatibility)
   */
  async getTickerMentions(ticker: string): Promise<{ success: boolean; data?: SocialSentimentData; error?: string }> {
    try {
      const data = await this.getSocialSentiment(ticker);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get subreddit posts (alias for getHotPosts for hub compatibility)
   */
  async getSubredditPosts(
    subreddit: string,
    sort: 'hot' | 'new' | 'top' = 'hot',
    limit: number = 25
  ): Promise<{ success: boolean; data?: RedditPost[]; error?: string }> {
    try {
      const posts = await this.getHotPosts(subreddit, limit);
      return { success: true, data: posts };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getTrendingTickers(limit: number = 20): Promise<TickerMention[]> {
    const posts = await this.getHotPosts('wallstreetbets+stocks+investing', 100);

    // Extract tickers from posts
    const tickerRegex = /\$([A-Z]{1,5})\b|\b([A-Z]{2,5})\b/g;
    const tickerCounts = new Map<string, { count: number; posts: RedditPost[] }>();

    // Common words to exclude
    const excludeWords = new Set([
      'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD',
      'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'HAS', 'HIS', 'HOW', 'ITS', 'MAY',
      'NEW', 'NOW', 'OLD', 'SEE', 'WAY', 'WHO', 'BOY', 'DID', 'GET', 'HIM',
      'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE', 'CEO', 'CFO', 'IPO', 'ETF',
      'SEC', 'FDA', 'GDP', 'ATH', 'EOD', 'IMO', 'YOLO', 'FOMO', 'DD', 'WSB',
    ]);

    for (const post of posts) {
      const text = post.title + ' ' + post.selftext;
      const matches = text.matchAll(tickerRegex);

      for (const match of matches) {
        const ticker = (match[1] || match[2]).toUpperCase();
        if (ticker.length >= 2 && ticker.length <= 5 && !excludeWords.has(ticker)) {
          if (!tickerCounts.has(ticker)) {
            tickerCounts.set(ticker, { count: 0, posts: [] });
          }
          const data = tickerCounts.get(ticker)!;
          data.count++;
          if (data.posts.length < 5) {
            data.posts.push(post);
          }
        }
      }
    }

    // Convert to array and calculate sentiment
    const mentions: TickerMention[] = [];
    for (const [ticker, data] of tickerCounts) {
      if (data.count >= 2) {
        let bullish = 0;
        let bearish = 0;
        let totalUpvoteRatio = 0;
        let totalComments = 0;

        for (const post of data.posts) {
          const sentiment = this.analyzeSentiment(post.title + ' ' + post.selftext);
          if (sentiment === 'bullish') bullish++;
          else if (sentiment === 'bearish') bearish++;
          totalUpvoteRatio += post.upvote_ratio;
          totalComments += post.num_comments;
        }

        const total = data.posts.length;
        const sentimentScore = total > 0 ? (bullish - bearish) / total : 0;

        mentions.push({
          ticker,
          count: data.count,
          posts: data.posts,
          sentiment_score: sentimentScore,
          avg_upvote_ratio: totalUpvoteRatio / total,
          total_comments: totalComments,
        });
      }
    }

    return mentions
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Check if the client is configured
   */
  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let clientInstance: RedditClient | null = null;

export function getRedditClient(): RedditClient {
  if (!clientInstance) {
    clientInstance = new RedditClient();
  }
  return clientInstance;
}

export function resetRedditClient(): void {
  clientInstance = null;
}
