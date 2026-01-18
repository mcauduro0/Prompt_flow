/**
 * ARC Investment Factory - Polygon Data Source
 * Polygon.io API client for market data and news
 * INSTRUMENTED with telemetry for QA Framework v2.0
 */
import type { StockPrice, NewsArticle, RetrieverResult } from '../types.js';

const POLYGON_BASE_URL = 'https://api.polygon.io';

// Telemetry interface for data source health (to avoid circular dependency)
interface DataSourceHealthEvent {
  sourceName: string;
  endpoint?: string;
  success: boolean;
  latencyMs?: number;
  errorMessage?: string;
  rateLimited?: boolean;
}

// Global telemetry reference (lazy loaded to avoid circular dependency)
let telemetryInstance: { logDataSourceHealth: (event: DataSourceHealthEvent) => Promise<void> } | null = null;

async function loadTelemetry() {
  if (!telemetryInstance) {
    try {
      // Dynamic import to avoid circular dependency
      // @ts-ignore - dynamic import of workspace package
      const dbModule = await import('@arc/database');
      telemetryInstance = dbModule.telemetry;
    } catch (error) {
      // Telemetry is optional - silently ignore if not available
    }
  }
  return telemetryInstance;
}

export class PolygonClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.POLYGON_API_KEY ?? '';
    if (!this.apiKey) {
      console.warn('Polygon API key not configured');
    }
  }

  private async fetch<T>(endpoint: string): Promise<RetrieverResult<T>> {
    const url = `${POLYGON_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}apiKey=${this.apiKey}`;
    const startTime = Date.now();
    let success = false;
    let errorMessage: string | undefined;
    let rateLimited = false;
    
    try {
      const response = await fetch(url);
      
      // Check for rate limiting
      if (response.status === 429) {
        rateLimited = true;
        errorMessage = 'Rate limited by Polygon API';
        return {
          success: false,
          error: errorMessage,
          source: 'polygon',
          retrievedAt: new Date().toISOString(),
        };
      }
      
      if (!response.ok) {
        errorMessage = `Polygon API error: ${response.status} ${response.statusText}`;
        return {
          success: false,
          error: errorMessage,
          source: 'polygon',
          retrievedAt: new Date().toISOString(),
        };
      }
      
      const data = await response.json() as T;
      success = true;
      
      return {
        success: true,
        data: data as T,
        source: 'polygon',
        retrievedAt: new Date().toISOString(),
      };
    } catch (error) {
      errorMessage = `Polygon fetch error: ${(error as Error).message}`;
      return {
        success: false,
        error: errorMessage,
        source: 'polygon',
        retrievedAt: new Date().toISOString(),
      };
    } finally {
      // Log telemetry asynchronously (non-blocking)
      const latencyMs = Date.now() - startTime;
      this.logTelemetryAsync({
        sourceName: 'polygon',
        endpoint: endpoint.split('?')[0], // Remove query params for cleaner logging
        success,
        latencyMs,
        errorMessage,
        rateLimited,
      });
    }
  }

  private logTelemetryAsync(event: DataSourceHealthEvent): void {
    loadTelemetry()
      .then(telemetry => {
        if (telemetry) {
          return telemetry.logDataSourceHealth(event);
        }
      })
      .catch(err => console.error('[PolygonClient] Telemetry error:', err));
  }

  /**
   * Get historical stock prices (daily bars)
   */
  async getDailyPrices(
    ticker: string,
    from: string,
    to: string
  ): Promise<RetrieverResult<StockPrice[]>> {
    const result = await this.fetch<any>(
      `/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc`
    );
    if (!result.success || !result.data?.results) {
      return { ...result, data: undefined };
    }
    return {
      success: true,
      data: result.data.results.map((bar: any) => ({
        ticker,
        date: new Date(bar.t).toISOString().split('T')[0],
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
        adjustedClose: bar.c, // Already adjusted
      })),
      source: 'polygon',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get latest stock price
   */
  async getLatestPrice(ticker: string): Promise<RetrieverResult<StockPrice>> {
    const result = await this.fetch<any>(`/v2/aggs/ticker/${ticker}/prev`);
    if (!result.success || !result.data?.results?.[0]) {
      return { ...result, data: undefined };
    }
    const bar = result.data.results[0];
    return {
      success: true,
      data: {
        ticker,
        date: new Date(bar.t).toISOString().split('T')[0],
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
        adjustedClose: bar.c,
      },
      source: 'polygon',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get ticker details
   */
  async getTickerDetails(ticker: string): Promise<RetrieverResult<any>> {
    const result = await this.fetch<any>(`/v3/reference/tickers/${ticker}`);
    if (!result.success || !result.data?.results) {
      return { ...result, data: undefined };
    }
    return {
      success: true,
      data: result.data.results,
      source: 'polygon',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get news articles for a ticker
   */
  async getNews(
    ticker?: string,
    limit = 10
  ): Promise<RetrieverResult<NewsArticle[]>> {
    let endpoint = `/v2/reference/news?limit=${limit}&order=desc`;
    if (ticker) {
      endpoint += `&ticker=${ticker}`;
    }
    const result = await this.fetch<any>(endpoint);
    if (!result.success || !result.data?.results) {
      return { ...result, data: undefined };
    }
    return {
      success: true,
      data: result.data.results.map((article: any) => ({
        id: article.id,
        title: article.title,
        summary: article.description ?? '',
        source: article.publisher?.name ?? 'Unknown',
        publishedAt: article.published_utc,
        url: article.article_url,
        tickers: article.tickers ?? [],
        sentiment: mapSentiment(article.insights?.[0]?.sentiment),
      })),
      source: 'polygon',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get all tickers (paginated)
   */
  async getTickers(params: {
    market?: 'stocks' | 'crypto' | 'fx';
    exchange?: string;
    type?: string;
    active?: boolean;
    limit?: number;
  } = {}): Promise<RetrieverResult<string[]>> {
    const queryParams = new URLSearchParams();
    if (params.market) queryParams.set('market', params.market);
    if (params.exchange) queryParams.set('exchange', params.exchange);
    if (params.type) queryParams.set('type', params.type);
    if (params.active !== undefined) queryParams.set('active', params.active.toString());
    queryParams.set('limit', (params.limit ?? 100).toString());

    const result = await this.fetch<any>(`/v3/reference/tickers?${queryParams.toString()}`);
    if (!result.success || !result.data?.results) {
      return { ...result, data: undefined };
    }
    return {
      success: true,
      data: result.data.results.map((t: any) => t.ticker),
      source: 'polygon',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get market status
   */
  async getMarketStatus(): Promise<RetrieverResult<{
    market: string;
    serverTime: string;
    exchanges: Record<string, string>;
  }>> {
    const result = await this.fetch<any>('/v1/marketstatus/now');
    if (!result.success || !result.data) {
      return { ...result, data: undefined };
    }
    return {
      success: true,
      data: {
        market: result.data.market,
        serverTime: result.data.serverTime,
        exchanges: result.data.exchanges,
      },
      source: 'polygon',
      retrievedAt: new Date().toISOString(),
    };
  }
}

/**
 * Map Polygon sentiment to our format
 */
function mapSentiment(sentiment?: string): 'positive' | 'negative' | 'neutral' | undefined {
  if (!sentiment) return undefined;
  const lower = sentiment.toLowerCase();
  if (lower === 'positive' || lower === 'bullish') return 'positive';
  if (lower === 'negative' || lower === 'bearish') return 'negative';
  return 'neutral';
}

/**
 * Create Polygon client with default configuration
 */
export function createPolygonClient(apiKey?: string): PolygonClient {
  return new PolygonClient(apiKey);
}
