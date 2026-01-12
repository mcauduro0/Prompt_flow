/**
 * ARC Investment Factory - Data Retriever Hub
 * 
 * Centralized data access layer with caching, fallback, and unified interface
 * for all data sources: FMP, Polygon, SEC EDGAR, FRED, Reddit, Social Trends.
 */

import { FMPClient } from './sources/fmp.js';
import { PolygonClient } from './sources/polygon.js';
import { SECEdgarClient } from './sources/sec-edgar.js';
import { FREDClient } from './sources/fred.js';
import { RedditClient } from './sources/reddit.js';
import { SocialTrendsClient } from './sources/social-trends.js';
import type { RetrieverResult, CompanyProfile, FinancialMetrics, StockPrice, SECFiling } from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface HubConfig {
  cacheTTL?: {
    profile?: number;
    financials?: number;
    prices?: number;
    news?: number;
    filings?: number;
    macro?: number;
    social?: number;
  };
  enableCache?: boolean;
}

export interface DataSourceStatus {
  name: string;
  configured: boolean;
  lastSuccess?: Date;
  lastError?: string;
  avgLatencyMs?: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function makeResult<T>(success: boolean, source: string, data?: T, error?: string): RetrieverResult<T> {
  return {
    success,
    data,
    error,
    source,
    retrievedAt: new Date().toISOString(),
  };
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_TTL = {
  profile: 24 * 60 * 60 * 1000,      // 24 hours
  financials: 6 * 60 * 60 * 1000,    // 6 hours
  prices: 5 * 60 * 1000,             // 5 minutes
  news: 15 * 60 * 1000,              // 15 minutes
  filings: 60 * 60 * 1000,           // 1 hour
  macro: 60 * 60 * 1000,             // 1 hour
  social: 10 * 60 * 1000,            // 10 minutes
};

// ============================================================================
// DATA RETRIEVER HUB
// ============================================================================

export class DataRetrieverHub {
  private fmp: FMPClient;
  private polygon: PolygonClient;
  private sec: SECEdgarClient;
  private fred: FREDClient;
  private reddit: RedditClient;
  private socialTrends: SocialTrendsClient;
  
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: Required<HubConfig>;
  private sourceStatus: Map<string, DataSourceStatus> = new Map();

  constructor(config: HubConfig = {}) {
    this.fmp = new FMPClient();
    this.polygon = new PolygonClient();
    this.sec = new SECEdgarClient();
    this.fred = new FREDClient();
    this.reddit = new RedditClient();
    this.socialTrends = new SocialTrendsClient();

    this.config = {
      cacheTTL: { ...DEFAULT_TTL, ...config.cacheTTL },
      enableCache: config.enableCache ?? true,
    };

    this.initializeSourceStatus();
  }

  private initializeSourceStatus(): void {
    const sources = [
      { name: 'FMP', key: 'FMP_API_KEY' },
      { name: 'Polygon', key: 'POLYGON_API_KEY' },
      { name: 'SEC EDGAR', key: null },
      { name: 'FRED', key: 'FRED_API_KEY' },
      { name: 'Reddit', key: 'REDDIT_CLIENT_ID' },
      { name: 'Social Trends', key: 'SONAR_API_KEY' },
    ];

    for (const source of sources) {
      this.sourceStatus.set(source.name, {
        name: source.name,
        configured: source.key === null || !!process.env[source.key],
      });
    }
  }

  // --------------------------------------------------------------------------
  // CACHE MANAGEMENT
  // --------------------------------------------------------------------------

  private getCacheKey(source: string, method: string, params: Record<string, unknown>): string {
    return `${source}:${method}:${JSON.stringify(params)}`;
  }

  private getFromCache<T>(key: string): T | null {
    if (!this.config.enableCache) return null;

    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    if (!this.config.enableCache) return;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  // --------------------------------------------------------------------------
  // SOURCE STATUS
  // --------------------------------------------------------------------------

  private updateSourceStatus(name: string, success: boolean, error?: string, latencyMs?: number): void {
    const status = this.sourceStatus.get(name);
    if (status) {
      if (success) {
        status.lastSuccess = new Date();
        if (latencyMs) {
          status.avgLatencyMs = status.avgLatencyMs 
            ? (status.avgLatencyMs + latencyMs) / 2 
            : latencyMs;
        }
      } else {
        status.lastError = error;
      }
      this.sourceStatus.set(name, status);
    }
  }

  public getSourceStatus(): DataSourceStatus[] {
    return Array.from(this.sourceStatus.values());
  }

  // --------------------------------------------------------------------------
  // COMPANY DATA (FMP + Polygon)
  // --------------------------------------------------------------------------

  async getCompanyProfile(ticker: string): Promise<RetrieverResult<CompanyProfile>> {
    const cacheKey = this.getCacheKey('fmp', 'profile', { ticker });
    const cached = this.getFromCache<CompanyProfile>(cacheKey);
    if (cached) return makeResult(true, 'FMP (cached)', cached);

    const startTime = Date.now();
    const result = await this.fmp.getProfile(ticker);
    const latency = Date.now() - startTime;

    this.updateSourceStatus('FMP', result.success, result.error, latency);

    if (result.success && result.data) {
      this.setCache(cacheKey, result.data, this.config.cacheTTL.profile!);
    }

    return result;
  }

  async getFinancialMetrics(ticker: string): Promise<RetrieverResult<FinancialMetrics>> {
    const cacheKey = this.getCacheKey('fmp', 'metrics', { ticker });
    const cached = this.getFromCache<FinancialMetrics>(cacheKey);
    if (cached) return makeResult(true, 'FMP (cached)', cached);

    const startTime = Date.now();
    const result = await this.fmp.getKeyMetrics(ticker);
    const latency = Date.now() - startTime;

    this.updateSourceStatus('FMP', result.success, result.error, latency);

    if (result.success && result.data) {
      this.setCache(cacheKey, result.data, this.config.cacheTTL.financials!);
    }

    return result;
  }

  async getIncomeStatements(ticker: string, period: 'annual' | 'quarter' = 'annual', limit = 5): Promise<RetrieverResult<unknown[]>> {
    const cacheKey = this.getCacheKey('fmp', 'income', { ticker, period, limit });
    const cached = this.getFromCache<unknown[]>(cacheKey);
    if (cached) return makeResult(true, 'FMP (cached)', cached);

    const result = await this.fmp.getIncomeStatements(ticker, period, limit);
    if (result.success && result.data) {
      this.setCache(cacheKey, result.data, this.config.cacheTTL.financials!);
    }
    return result;
  }

  async getBalanceSheets(ticker: string, period: 'annual' | 'quarter' = 'annual', limit = 5): Promise<RetrieverResult<unknown[]>> {
    const cacheKey = this.getCacheKey('fmp', 'balance', { ticker, period, limit });
    const cached = this.getFromCache<unknown[]>(cacheKey);
    if (cached) return makeResult(true, 'FMP (cached)', cached);

    const result = await this.fmp.getBalanceSheets(ticker, period, limit);
    if (result.success && result.data) {
      this.setCache(cacheKey, result.data, this.config.cacheTTL.financials!);
    }
    return result;
  }

  async getCashFlowStatements(ticker: string, period: 'annual' | 'quarter' = 'annual', limit = 5): Promise<RetrieverResult<unknown[]>> {
    const cacheKey = this.getCacheKey('fmp', 'cashflow', { ticker, period, limit });
    const cached = this.getFromCache<unknown[]>(cacheKey);
    if (cached) return makeResult(true, 'FMP (cached)', cached);

    const result = await this.fmp.getCashFlowStatements(ticker, period, limit);
    if (result.success && result.data) {
      this.setCache(cacheKey, result.data, this.config.cacheTTL.financials!);
    }
    return result;
  }

  async screenStocks(params: {
    marketCapMoreThan?: number;
    marketCapLowerThan?: number;
    sector?: string;
    industry?: string;
    limit?: number;
  }): Promise<RetrieverResult<unknown[]>> {
    const cacheKey = this.getCacheKey('fmp', 'screen', params);
    const cached = this.getFromCache<unknown[]>(cacheKey);
    if (cached) return makeResult(true, 'FMP (cached)', cached);

    const result = await this.fmp.screenStocks(params);
    if (result.success && result.data) {
      this.setCache(cacheKey, result.data, this.config.cacheTTL.profile!);
    }
    return result;
  }

  // --------------------------------------------------------------------------
  // PRICE DATA (Polygon primary, FMP fallback)
  // --------------------------------------------------------------------------

  async getPriceHistory(ticker: string, days = 365): Promise<RetrieverResult<StockPrice[]>> {
    const cacheKey = this.getCacheKey('polygon', 'prices', { ticker, days });
    const cached = this.getFromCache<StockPrice[]>(cacheKey);
    if (cached) return makeResult(true, 'Polygon (cached)', cached);

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const startTime = Date.now();
    const result = await this.polygon.getDailyPrices(
      ticker,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    const latency = Date.now() - startTime;

    this.updateSourceStatus('Polygon', result.success, result.error, latency);

    if (result.success && result.data) {
      this.setCache(cacheKey, result.data, this.config.cacheTTL.prices!);
    }

    return result;
  }

  async getLatestPrice(ticker: string): Promise<RetrieverResult<StockPrice>> {
    const cacheKey = this.getCacheKey('polygon', 'latest', { ticker });
    const cached = this.getFromCache<StockPrice>(cacheKey);
    if (cached) return makeResult(true, 'Polygon (cached)', cached);

    const startTime = Date.now();
    const result = await this.polygon.getLatestPrice(ticker);
    const latency = Date.now() - startTime;

    this.updateSourceStatus('Polygon', result.success, result.error, latency);

    if (result.success && result.data) {
      this.setCache(cacheKey, result.data, this.config.cacheTTL.prices!);
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // NEWS (Polygon)
  // --------------------------------------------------------------------------

  async getNews(ticker?: string, limit = 10): Promise<RetrieverResult<unknown[]>> {
    const cacheKey = this.getCacheKey('polygon', 'news', { ticker, limit });
    const cached = this.getFromCache<unknown[]>(cacheKey);
    if (cached) return makeResult(true, 'Polygon (cached)', cached);

    const startTime = Date.now();
    const result = await this.polygon.getNews(ticker, limit);
    const latency = Date.now() - startTime;

    this.updateSourceStatus('Polygon', result.success, result.error, latency);

    if (result.success && result.data) {
      this.setCache(cacheKey, result.data, this.config.cacheTTL.news!);
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // SEC FILINGS
  // --------------------------------------------------------------------------

  async getSECFilings(ticker: string, formType?: string, limit = 10): Promise<RetrieverResult<SECFiling[]>> {
    const cacheKey = this.getCacheKey('sec', 'filings', { ticker, formType, limit });
    const cached = this.getFromCache<SECFiling[]>(cacheKey);
    if (cached) return makeResult(true, 'SEC EDGAR (cached)', cached);

    const startTime = Date.now();
    const formTypes = formType ? [formType] : undefined;
    const result = await this.sec.getFilings(ticker, formTypes, limit);
    const latency = Date.now() - startTime;

    this.updateSourceStatus('SEC EDGAR', result.success, result.error, latency);

    if (result.success && result.data) {
      this.setCache(cacheKey, result.data, this.config.cacheTTL.filings!);
    }

    return result;
  }

  async get10K(ticker: string, limit = 5): Promise<RetrieverResult<SECFiling[]>> {
    return this.sec.get10K(ticker, limit);
  }

  async get10Q(ticker: string, limit = 8): Promise<RetrieverResult<SECFiling[]>> {
    return this.sec.get10Q(ticker, limit);
  }

  async get8K(ticker: string, limit = 10): Promise<RetrieverResult<SECFiling[]>> {
    return this.sec.get8K(ticker, limit);
  }

  async getInsiderTransactions(ticker: string, limit = 20): Promise<RetrieverResult<SECFiling[]>> {
    return this.sec.getInsiderTransactions(ticker, limit);
  }

  // --------------------------------------------------------------------------
  // MACRO DATA (FRED)
  // --------------------------------------------------------------------------

  async getMacroSeries(seriesId: string): Promise<RetrieverResult<unknown>> {
    const cacheKey = this.getCacheKey('fred', 'series', { seriesId });
    const cached = this.getFromCache<unknown>(cacheKey);
    if (cached) return makeResult(true, 'FRED (cached)', cached);

    const startTime = Date.now();
    const result = await this.fred.getSeries(seriesId);
    const latency = Date.now() - startTime;

    this.updateSourceStatus('FRED', result.success, result.error, latency);

    if (result.success && result.data) {
      this.setCache(cacheKey, result.data, this.config.cacheTTL.macro!);
      return makeResult(true, 'FRED', result.data);
    }

    return makeResult(false, 'FRED', undefined, result.error);
  }

  async getGDP(): Promise<RetrieverResult<unknown>> {
    return this.getMacroSeries('GDP');
  }

  async getInflation(): Promise<RetrieverResult<unknown>> {
    return this.getMacroSeries('CPIAUCSL');
  }

  async getUnemployment(): Promise<RetrieverResult<unknown>> {
    return this.getMacroSeries('UNRATE');
  }

  async getFedFundsRate(): Promise<RetrieverResult<unknown>> {
    return this.getMacroSeries('FEDFUNDS');
  }

  async getTreasuryYields(): Promise<RetrieverResult<unknown>> {
    return this.getMacroSeries('DGS10');
  }

  async getMacroSnapshot(): Promise<RetrieverResult<{
    gdp: unknown;
    inflation: unknown;
    unemployment: unknown;
    fedFunds: unknown;
    treasury10y: unknown;
  }>> {
    const [gdp, inflation, unemployment, fedFunds, treasury10y] = await Promise.all([
      this.getGDP(),
      this.getInflation(),
      this.getUnemployment(),
      this.getFedFundsRate(),
      this.getTreasuryYields(),
    ]);

    return makeResult(true, 'FRED', {
      gdp: gdp.data,
      inflation: inflation.data,
      unemployment: unemployment.data,
      fedFunds: fedFunds.data,
      treasury10y: treasury10y.data,
    });
  }

  // --------------------------------------------------------------------------
  // SOCIAL SENTIMENT (Reddit, Social Trends)
  // --------------------------------------------------------------------------

  async getRedditSentiment(ticker: string): Promise<RetrieverResult<unknown>> {
    const cacheKey = this.getCacheKey('reddit', 'sentiment', { ticker });
    const cached = this.getFromCache<unknown>(cacheKey);
    if (cached) return makeResult(true, 'Reddit (cached)', cached);

    const startTime = Date.now();
    const result = await this.reddit.getTickerMentions(ticker);
    const latency = Date.now() - startTime;

    this.updateSourceStatus('Reddit', result.success, result.error, latency);

    if (result.success && result.data) {
      this.setCache(cacheKey, result.data, this.config.cacheTTL.social!);
      return makeResult(true, 'Reddit', result.data);
    }

    return makeResult(false, 'Reddit', undefined, result.error);
  }

  async getWSBTrending(): Promise<RetrieverResult<unknown>> {
    const cacheKey = this.getCacheKey('reddit', 'wsb', {});
    const cached = this.getFromCache<unknown>(cacheKey);
    if (cached) return makeResult(true, 'Reddit (cached)', cached);

    const result = await this.reddit.getSubredditPosts('wallstreetbets', 'hot', 25);
    if (result.success && result.data) {
      this.setCache(cacheKey, result.data, this.config.cacheTTL.social!);
      return makeResult(true, 'Reddit', result.data);
    }
    return makeResult(false, 'Reddit', undefined, result.error);
  }

  async getSocialTrendsSentiment(ticker: string): Promise<RetrieverResult<unknown>> {
    const cacheKey = this.getCacheKey('social-trends', 'sentiment', { ticker });
    const cached = this.getFromCache<unknown>(cacheKey);
    if (cached) return makeResult(true, 'Social Trends (cached)', cached);

    const startTime = Date.now();
    const result = await this.socialTrends.searchSocialTrends(`$${ticker}`, 100);
    const latency = Date.now() - startTime;

    this.updateSourceStatus('Social Trends', result.success, result.error, latency);

    if (result.success && result.data) {
      this.setCache(cacheKey, result.data, this.config.cacheTTL.social!);
      return makeResult(true, 'Social Trends', result.data);
    }

    return makeResult(false, 'Social Trends', undefined, result.error);
  }

  // --------------------------------------------------------------------------
  // AGGREGATED DATA
  // --------------------------------------------------------------------------

  async getFullCompanyData(ticker: string): Promise<RetrieverResult<{
    profile: CompanyProfile | null;
    metrics: FinancialMetrics | null;
    prices: StockPrice[] | null;
    filings: SECFiling[] | null;
    news: unknown[] | null;
    socialSentiment: unknown | null;
  }>> {
    const [profile, metrics, prices, filings, news, reddit] = await Promise.all([
      this.getCompanyProfile(ticker),
      this.getFinancialMetrics(ticker),
      this.getPriceHistory(ticker, 365),
      this.getSECFilings(ticker, undefined, 10),
      this.getNews(ticker, 10),
      this.getRedditSentiment(ticker),
    ]);

    return makeResult(true, 'Multiple', {
      profile: profile.data || null,
      metrics: metrics.data || null,
      prices: prices.data || null,
      filings: filings.data || null,
      news: news.data || null,
      socialSentiment: reddit.data || null,
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let hubInstance: DataRetrieverHub | null = null;

export function getDataRetrieverHub(): DataRetrieverHub {
  if (!hubInstance) {
    hubInstance = new DataRetrieverHub();
  }
  return hubInstance;
}
