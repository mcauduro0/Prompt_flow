/**
 * ARC Investment Factory - Data Retriever Hub
 * 
 * Centralized interface for fetching data from multiple sources.
 * Implements caching, fallback, timeout, and status tracking per source.
 */

import { createHash } from 'crypto';
import { createFMPClient, type FMPClient } from './sources/fmp.js';
import { createPolygonClient, type PolygonClient } from './sources/polygon.js';
import { createSECEdgarClient, type SECEdgarClient } from './sources/sec-edgar.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SourceStatus {
  source: string;
  available: boolean;
  last_success?: Date;
  last_failure?: Date;
  failure_count: number;
  avg_latency_ms: number;
}

export interface FetchResult<T = unknown> {
  source: string;
  success: boolean;
  data?: T;
  error?: string;
  latency_ms: number;
  cached: boolean;
  cache_key?: string;
}

export interface CacheEntry {
  key: string;
  data: unknown;
  created_at: Date;
  expires_at: Date;
  source: string;
}

export interface HubConfig {
  cache_enabled: boolean;
  default_ttl_seconds: number;
  timeout_ms: number;
  max_retries: number;
  retry_delay_ms: number;
  circuit_breaker_threshold: number;
}

// ============================================================================
// DATA RETRIEVER HUB
// ============================================================================

export class DataRetrieverHub {
  private cache: Map<string, CacheEntry> = new Map();
  private sourceStatus: Map<string, SourceStatus> = new Map();
  private config: HubConfig;

  // Source clients
  private fmpClient: ReturnType<typeof createFMPClient>;
  private polygonClient: ReturnType<typeof createPolygonClient>;
  private secEdgarClient: ReturnType<typeof createSECEdgarClient>;

  constructor(config?: Partial<HubConfig>) {
    this.config = {
      cache_enabled: true,
      default_ttl_seconds: 3600, // 1 hour
      timeout_ms: 30000, // 30 seconds
      max_retries: 2,
      retry_delay_ms: 1000,
      circuit_breaker_threshold: 5,
      ...config,
    };

    // Initialize source clients
    this.fmpClient = createFMPClient();
    this.polygonClient = createPolygonClient();
    this.secEdgarClient = createSECEdgarClient();

    // Initialize source status
    this.initializeSourceStatus();
  }

  private initializeSourceStatus(): void {
    const sources = ['fmp', 'polygon', 'sec_edgar', 'perplexity', 'news'];
    for (const source of sources) {
      this.sourceStatus.set(source, {
        source,
        available: true,
        failure_count: 0,
        avg_latency_ms: 0,
      });
    }
  }

  // ============================================================================
  // CACHE METHODS
  // ============================================================================

  private generateCacheKey(source: string, method: string, params: Record<string, unknown>): string {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort());
    const hash = createHash('sha256')
      .update(`${source}:${method}:${paramsStr}`)
      .digest('hex')
      .substring(0, 16);
    return `${source}:${method}:${hash}`;
  }

  private getFromCache(key: string): CacheEntry | null {
    if (!this.config.cache_enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (new Date() > entry.expires_at) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  private setCache(key: string, data: unknown, source: string, ttl_seconds?: number): void {
    if (!this.config.cache_enabled) return;

    const ttl = ttl_seconds || this.config.default_ttl_seconds;
    const now = new Date();
    const expires_at = new Date(now.getTime() + ttl * 1000);

    this.cache.set(key, {
      key,
      data,
      created_at: now,
      expires_at,
      source,
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; sources: Record<string, number> } {
    const sources: Record<string, number> = {};
    for (const entry of this.cache.values()) {
      sources[entry.source] = (sources[entry.source] || 0) + 1;
    }
    return { size: this.cache.size, sources };
  }

  // ============================================================================
  // SOURCE STATUS METHODS
  // ============================================================================

  private updateSourceStatus(source: string, success: boolean, latency_ms: number): void {
    const status = this.sourceStatus.get(source);
    if (!status) return;

    if (success) {
      status.last_success = new Date();
      status.failure_count = 0;
      status.available = true;
    } else {
      status.last_failure = new Date();
      status.failure_count++;
      if (status.failure_count >= this.config.circuit_breaker_threshold) {
        status.available = false;
        console.warn(`[DataRetrieverHub] Circuit breaker opened for source: ${source}`);
      }
    }

    // Update average latency (exponential moving average)
    status.avg_latency_ms = status.avg_latency_ms * 0.8 + latency_ms * 0.2;
    this.sourceStatus.set(source, status);
  }

  getSourceStatus(source: string): SourceStatus | undefined {
    return this.sourceStatus.get(source);
  }

  getAllSourceStatus(): SourceStatus[] {
    return Array.from(this.sourceStatus.values());
  }

  resetSourceStatus(source: string): void {
    const status = this.sourceStatus.get(source);
    if (status) {
      status.available = true;
      status.failure_count = 0;
      this.sourceStatus.set(source, status);
    }
  }

  // ============================================================================
  // GENERIC FETCH WITH RETRY AND TIMEOUT
  // ============================================================================

  private async fetchWithRetry<T>(
    source: string,
    method: string,
    fetchFn: () => Promise<{ success: boolean; data?: T; error?: string }>,
    params: Record<string, unknown>,
    ttl_seconds?: number
  ): Promise<FetchResult<T>> {
    const cacheKey = this.generateCacheKey(source, method, params);
    const startTime = Date.now();

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return {
        source,
        success: true,
        data: cached.data as T,
        latency_ms: Date.now() - startTime,
        cached: true,
        cache_key: cacheKey,
      };
    }

    // Check circuit breaker
    const status = this.sourceStatus.get(source);
    if (status && !status.available) {
      return {
        source,
        success: false,
        error: `Source ${source} is unavailable (circuit breaker open)`,
        latency_ms: Date.now() - startTime,
        cached: false,
      };
    }

    // Fetch with retry
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.config.max_retries; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.config.timeout_ms)
        );

        const result = await Promise.race([fetchFn(), timeoutPromise]);
        const latency_ms = Date.now() - startTime;

        if (result.success && result.data !== undefined) {
          // Update status and cache
          this.updateSourceStatus(source, true, latency_ms);
          this.setCache(cacheKey, result.data, source, ttl_seconds);

          return {
            source,
            success: true,
            data: result.data,
            latency_ms,
            cached: false,
            cache_key: cacheKey,
          };
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.config.max_retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retry_delay_ms * (attempt + 1))
          );
        }
      }
    }

    const latency_ms = Date.now() - startTime;
    this.updateSourceStatus(source, false, latency_ms);

    return {
      source,
      success: false,
      error: lastError?.message || 'Unknown error',
      latency_ms,
      cached: false,
    };
  }

  // ============================================================================
  // FMP DATA METHODS
  // ============================================================================

  async getCompanyProfile(ticker: string): Promise<FetchResult> {
    return this.fetchWithRetry(
      'fmp',
      'getProfile',
      () => this.fmpClient.getProfile(ticker),
      { ticker },
      86400 // 24 hours
    );
  }

  async getFinancialMetrics(ticker: string): Promise<FetchResult> {
    return this.fetchWithRetry(
      'fmp',
      'getKeyMetrics',
      () => this.fmpClient.getKeyMetrics(ticker),
      { ticker },
      3600 // 1 hour
    );
  }

  async getIncomeStatement(ticker: string, period: 'annual' | 'quarter' = 'annual'): Promise<FetchResult> {
    return this.fetchWithRetry(
      'fmp',
      'getIncomeStatements',
      () => this.fmpClient.getIncomeStatements(ticker, period),
      { ticker, period },
      86400
    );
  }

  async getBalanceSheet(ticker: string, period: 'annual' | 'quarter' = 'annual'): Promise<FetchResult> {
    return this.fetchWithRetry(
      'fmp',
      'getBalanceSheets',
      () => this.fmpClient.getBalanceSheets(ticker, period),
      { ticker, period },
      86400
    );
  }

  async getCashFlowStatement(ticker: string, period: 'annual' | 'quarter' = 'annual'): Promise<FetchResult> {
    return this.fetchWithRetry(
      'fmp',
      'getCashFlowStatements',
      () => this.fmpClient.getCashFlowStatements(ticker, period),
      { ticker, period },
      86400
    );
  }

  async getStockScreener(params: {
    marketCapMoreThan?: number;
    marketCapLowerThan?: number;
    sector?: string;
    limit?: number;
  }): Promise<FetchResult> {
    return this.fetchWithRetry(
      'fmp',
      'screenStocks',
      () => this.fmpClient.screenStocks(params),
      params,
      3600
    );
  }

  // ============================================================================
  // POLYGON DATA METHODS
  // ============================================================================

  async getStockPrice(ticker: string): Promise<FetchResult> {
    return this.fetchWithRetry(
      'polygon',
      'getLatestPrice',
      () => this.polygonClient.getLatestPrice(ticker),
      { ticker },
      60 // 1 minute
    );
  }

  async getPriceHistory(
    ticker: string,
    days: number = 365
  ): Promise<FetchResult> {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - days);
    const fromStr = from.toISOString().split('T')[0];
    const toStr = today.toISOString().split('T')[0];
    
    return this.fetchWithRetry(
      'polygon',
      'getDailyPrices',
      () => this.polygonClient.getDailyPrices(ticker, fromStr, toStr),
      { ticker, days },
      3600
    );
  }

  async getTickerNews(ticker: string, limit: number = 10): Promise<FetchResult> {
    return this.fetchWithRetry(
      'polygon',
      'getNews',
      () => this.polygonClient.getNews(ticker, limit),
      { ticker, limit },
      1800 // 30 minutes
    );
  }

  // ============================================================================
  // SEC EDGAR DATA METHODS
  // ============================================================================

  async getSecFilings(ticker: string, formTypes?: string[]): Promise<FetchResult> {
    return this.fetchWithRetry(
      'sec_edgar',
      'getFilings',
      () => this.secEdgarClient.getFilings(ticker, formTypes),
      { ticker, formTypes },
      86400
    );
  }

  async get10KFiling(ticker: string): Promise<FetchResult> {
    return this.fetchWithRetry(
      'sec_edgar',
      'get10KFiling',
      () => this.secEdgarClient.getFilings(ticker, ['10-K']),
      { ticker, formType: '10-K' },
      86400
    );
  }

  async get10QFiling(ticker: string): Promise<FetchResult> {
    return this.fetchWithRetry(
      'sec_edgar',
      'get10QFiling',
      () => this.secEdgarClient.getFilings(ticker, ['10-Q']),
      { ticker, formType: '10-Q' },
      86400
    );
  }

  // ============================================================================
  // AGGREGATED DATA METHODS
  // ============================================================================

  /**
   * Fetch all data needed for Lane A discovery
   */
  async fetchLaneAData(ticker: string): Promise<{
    results: Record<string, FetchResult>;
    sources_succeeded: string[];
    sources_failed: Array<{ source: string; reason: string }>;
  }> {
    const results: Record<string, FetchResult> = {};
    const sources_succeeded: string[] = [];
    const sources_failed: Array<{ source: string; reason: string }> = [];

    // Fetch in parallel
    const [profile, metrics, price, news] = await Promise.all([
      this.getCompanyProfile(ticker),
      this.getFinancialMetrics(ticker),
      this.getStockPrice(ticker),
      this.getTickerNews(ticker, 5),
    ]);

    results.profile = profile;
    results.metrics = metrics;
    results.price = price;
    results.news = news;

    // Track successes and failures
    for (const [key, result] of Object.entries(results)) {
      if (result.success) {
        if (!sources_succeeded.includes(result.source)) {
          sources_succeeded.push(result.source);
        }
      } else {
        sources_failed.push({ source: result.source, reason: result.error || 'Unknown error' });
      }
    }

    return { results, sources_succeeded, sources_failed };
  }

  /**
   * Fetch all data needed for Lane B deep research
   */
  async fetchLaneBData(ticker: string): Promise<{
    results: Record<string, FetchResult>;
    sources_succeeded: string[];
    sources_failed: Array<{ source: string; reason: string }>;
  }> {
    const results: Record<string, FetchResult> = {};
    const sources_succeeded: string[] = [];
    const sources_failed: Array<{ source: string; reason: string }> = [];

    // Fetch in parallel
    const [
      profile,
      metrics,
      incomeAnnual,
      incomeQuarter,
      balanceAnnual,
      cashFlowAnnual,
      priceHistory,
      news,
      filings10K,
      filings10Q,
    ] = await Promise.all([
      this.getCompanyProfile(ticker),
      this.getFinancialMetrics(ticker),
      this.getIncomeStatement(ticker, 'annual'),
      this.getIncomeStatement(ticker, 'quarter'),
      this.getBalanceSheet(ticker, 'annual'),
      this.getCashFlowStatement(ticker, 'annual'),
      this.getPriceHistory(ticker, 365),
      this.getTickerNews(ticker, 20),
      this.get10KFiling(ticker),
      this.get10QFiling(ticker),
    ]);

    results.profile = profile;
    results.metrics = metrics;
    results.incomeAnnual = incomeAnnual;
    results.incomeQuarter = incomeQuarter;
    results.balanceAnnual = balanceAnnual;
    results.cashFlowAnnual = cashFlowAnnual;
    results.priceHistory = priceHistory;
    results.news = news;
    results.filings10K = filings10K;
    results.filings10Q = filings10Q;

    // Track successes and failures
    for (const [key, result] of Object.entries(results)) {
      if (result.success) {
        if (!sources_succeeded.includes(result.source)) {
          sources_succeeded.push(result.source);
        }
      } else {
        sources_failed.push({ source: result.source, reason: result.error || 'Unknown error' });
      }
    }

    return { results, sources_succeeded, sources_failed };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let hubInstance: DataRetrieverHub | null = null;

export function getDataRetrieverHub(config?: Partial<HubConfig>): DataRetrieverHub {
  if (!hubInstance) {
    hubInstance = new DataRetrieverHub(config);
  }
  return hubInstance;
}

export function resetDataRetrieverHub(): void {
  hubInstance = null;
}

export function createDataRetrieverHub(config?: Partial<HubConfig>): DataRetrieverHub {
  return new DataRetrieverHub(config);
}
