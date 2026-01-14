/**
 * ARC Investment Factory - FRED API Client with Intelligent Caching
 * 
 * Federal Reserve Economic Data (FRED) API client for macroeconomic indicators.
 * Implements intelligent caching based on each indicator's update frequency.
 * Documentation: https://fred.stlouisfed.org/docs/api/fred/
 */

// ============================================================================
// TYPES
// ============================================================================

export interface FREDSeries {
  id: string;
  title: string;
  observation_start: string;
  observation_end: string;
  frequency: string;
  units: string;
  seasonal_adjustment: string;
}

export interface FREDObservation {
  date: string;
  value: string;
}

export interface FREDSeriesData {
  series: FREDSeries;
  observations: FREDObservation[];
}

export interface MacroIndicators {
  gdp_growth?: number;
  gdp_growth_date?: string;
  unemployment_rate?: number;
  unemployment_date?: string;
  inflation_cpi?: number;
  inflation_date?: string;
  fed_funds_rate?: number;
  fed_funds_date?: string;
  treasury_10y?: number;
  treasury_10y_date?: string;
  treasury_2y?: number;
  treasury_2y_date?: string;
  yield_curve_spread?: number;
  consumer_sentiment?: number;
  consumer_sentiment_date?: string;
  industrial_production?: number;
  industrial_production_date?: string;
  housing_starts?: number;
  housing_starts_date?: string;
  retail_sales_growth?: number;
  retail_sales_date?: string;
  sp500?: number;
  sp500_date?: string;
  vix?: number;
  vix_date?: string;
}

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface SeriesCacheConfig {
  seriesId: string;
  name: string;
  updateFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  cacheTTLMinutes: number;
}

// Cache TTL based on update frequency
// Daily data: cache for 4 hours (market data updates throughout day)
// Weekly data: cache for 24 hours
// Monthly data: cache for 7 days
// Quarterly data: cache for 30 days
const SERIES_CACHE_CONFIG: SeriesCacheConfig[] = [
  // Daily indicators
  { seriesId: 'DGS10', name: 'Treasury 10Y', updateFrequency: 'daily', cacheTTLMinutes: 240 },
  { seriesId: 'DGS2', name: 'Treasury 2Y', updateFrequency: 'daily', cacheTTLMinutes: 240 },
  { seriesId: 'FEDFUNDS', name: 'Fed Funds Rate', updateFrequency: 'daily', cacheTTLMinutes: 240 },
  { seriesId: 'SP500', name: 'S&P 500', updateFrequency: 'daily', cacheTTLMinutes: 240 },
  { seriesId: 'VIXCLS', name: 'VIX', updateFrequency: 'daily', cacheTTLMinutes: 240 },
  
  // Monthly indicators
  { seriesId: 'UNRATE', name: 'Unemployment Rate', updateFrequency: 'monthly', cacheTTLMinutes: 10080 }, // 7 days
  { seriesId: 'CPIAUCSL', name: 'CPI', updateFrequency: 'monthly', cacheTTLMinutes: 10080 },
  { seriesId: 'UMCSENT', name: 'Consumer Sentiment', updateFrequency: 'monthly', cacheTTLMinutes: 10080 },
  { seriesId: 'INDPRO', name: 'Industrial Production', updateFrequency: 'monthly', cacheTTLMinutes: 10080 },
  { seriesId: 'HOUST', name: 'Housing Starts', updateFrequency: 'monthly', cacheTTLMinutes: 10080 },
  { seriesId: 'RSXFS', name: 'Retail Sales', updateFrequency: 'monthly', cacheTTLMinutes: 10080 },
  
  // Quarterly indicators
  { seriesId: 'A191RL1Q225SBEA', name: 'GDP Growth', updateFrequency: 'quarterly', cacheTTLMinutes: 43200 }, // 30 days
];

// ============================================================================
// FRED CLIENT WITH INTELLIGENT CACHE
// ============================================================================

export class FREDClient {
  private apiKey: string;
  private baseUrl = 'https://api.stlouisfed.org/fred';
  
  // In-memory cache
  private cache: Map<string, CacheEntry<any>> = new Map();
  
  // Cache statistics
  private cacheStats = {
    hits: 0,
    misses: 0,
    apiCalls: 0,
  };

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FRED_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[FREDClient] No API key configured');
    }
  }

  /**
   * Get cache TTL for a series based on its update frequency
   */
  private getCacheTTL(seriesId: string): number {
    const config = SERIES_CACHE_CONFIG.find(c => c.seriesId === seriesId);
    if (config) {
      return config.cacheTTLMinutes * 60 * 1000; // Convert to milliseconds
    }
    // Default: 4 hours for unknown series
    return 4 * 60 * 60 * 1000;
  }

  /**
   * Get from cache if valid
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      this.cacheStats.hits++;
      console.log(`[FREDClient] Cache HIT for ${key}`);
      return entry.data as T;
    }
    if (entry) {
      // Expired, remove from cache
      this.cache.delete(key);
    }
    this.cacheStats.misses++;
    console.log(`[FREDClient] Cache MISS for ${key}`);
    return null;
  }

  /**
   * Set cache entry
   */
  private setCache<T>(key: string, data: T, seriesId: string): void {
    const ttl = this.getCacheTTL(seriesId);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    };
    this.cache.set(key, entry);
    
    const config = SERIES_CACHE_CONFIG.find(c => c.seriesId === seriesId);
    const ttlMinutes = Math.round(ttl / 60000);
    console.log(`[FREDClient] Cached ${key} (${config?.name || seriesId}) for ${ttlMinutes} minutes`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { hits: number; misses: number; hitRate: number; apiCalls: number; savedCalls: number } {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    return {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      hitRate: total > 0 ? this.cacheStats.hits / total : 0,
      apiCalls: this.cacheStats.apiCalls,
      savedCalls: this.cacheStats.hits,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[FREDClient] Cache cleared');
  }

  /**
   * Get series observations with caching
   */
  async getSeriesObservations(
    seriesId: string,
    options?: {
      observation_start?: string;
      observation_end?: string;
      limit?: number;
      sort_order?: 'asc' | 'desc';
    }
  ): Promise<FREDObservation[]> {
    const cacheKey = `obs:${seriesId}:${JSON.stringify(options || {})}`;
    
    // Check cache first
    const cached = this.getFromCache<FREDObservation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const params = new URLSearchParams({
      series_id: seriesId,
      api_key: this.apiKey,
      file_type: 'json',
      sort_order: options?.sort_order || 'desc',
      limit: String(options?.limit || 10),
    });

    if (options?.observation_start) {
      params.set('observation_start', options.observation_start);
    }
    if (options?.observation_end) {
      params.set('observation_end', options.observation_end);
    }

    try {
      this.cacheStats.apiCalls++;
      const response = await fetch(`${this.baseUrl}/series/observations?${params}`);
      if (!response.ok) {
        throw new Error(`FRED API error: ${response.status}`);
      }
      const data = await response.json() as { observations?: FREDObservation[] };
      const observations = data.observations || [];
      
      // Cache the result
      this.setCache(cacheKey, observations, seriesId);
      
      return observations;
    } catch (error) {
      console.error(`[FREDClient] Error fetching ${seriesId}:`, error);
      return [];
    }
  }

  /**
   * Get series metadata with caching
   */
  async getSeriesInfo(seriesId: string): Promise<FREDSeries | null> {
    const cacheKey = `info:${seriesId}`;
    
    // Check cache first
    const cached = this.getFromCache<FREDSeries>(cacheKey);
    if (cached) {
      return cached;
    }

    const params = new URLSearchParams({
      series_id: seriesId,
      api_key: this.apiKey,
      file_type: 'json',
    });

    try {
      this.cacheStats.apiCalls++;
      const response = await fetch(`${this.baseUrl}/series?${params}`);
      if (!response.ok) {
        throw new Error(`FRED API error: ${response.status}`);
      }
      const data = await response.json() as { seriess?: FREDSeries[] };
      const series = data.seriess?.[0] || null;
      
      if (series) {
        // Cache series info for 24 hours (metadata rarely changes)
        const entry: CacheEntry<FREDSeries> = {
          data: series,
          timestamp: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        };
        this.cache.set(cacheKey, entry);
      }
      
      return series;
    } catch (error) {
      console.error(`[FREDClient] Error fetching series info for ${seriesId}:`, error);
      return null;
    }
  }

  /**
   * Get latest value for a series with caching
   */
  async getLatestValue(seriesId: string): Promise<{ value: number; date: string } | null> {
    const cacheKey = `latest:${seriesId}`;
    
    // Check cache first
    const cached = this.getFromCache<{ value: number; date: string }>(cacheKey);
    if (cached) {
      return cached;
    }

    const observations = await this.getSeriesObservations(seriesId, { limit: 1 });
    if (observations.length === 0) {
      return null;
    }

    const latest = observations[0];
    const value = parseFloat(latest.value);
    if (isNaN(value)) {
      return null;
    }

    const result = { value, date: latest.date };
    
    // Cache is already handled by getSeriesObservations, but we cache the parsed result too
    this.setCache(cacheKey, result, seriesId);
    
    return result;
  }

  /**
   * Get all macro indicators with intelligent caching
   */
  async getMacroIndicators(): Promise<MacroIndicators> {
    const cacheKey = 'macro:all';
    
    // Check if we have a recent full macro snapshot
    const cached = this.getFromCache<MacroIndicators>(cacheKey);
    if (cached) {
      return cached;
    }

    const seriesMap: Record<string, string> = {
      'gdp_growth': 'A191RL1Q225SBEA',
      'unemployment_rate': 'UNRATE',
      'inflation_cpi': 'CPIAUCSL',
      'fed_funds_rate': 'FEDFUNDS',
      'treasury_10y': 'DGS10',
      'treasury_2y': 'DGS2',
      'consumer_sentiment': 'UMCSENT',
      'industrial_production': 'INDPRO',
      'housing_starts': 'HOUST',
      'retail_sales': 'RSXFS',
      'sp500': 'SP500',
      'vix': 'VIXCLS',
    };

    const keys = Object.keys(seriesMap);
    const seriesIds = Object.values(seriesMap);

    // Fetch all series in parallel
    const results = await Promise.allSettled(
      seriesIds.map(id => this.getLatestValue(id))
    );

    const indicators: MacroIndicators = {};

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const key = keys[index];
        switch (key) {
          case 'gdp_growth':
            indicators.gdp_growth = result.value.value;
            indicators.gdp_growth_date = result.value.date;
            break;
          case 'unemployment_rate':
            indicators.unemployment_rate = result.value.value;
            indicators.unemployment_date = result.value.date;
            break;
          case 'inflation_cpi':
            indicators.inflation_cpi = result.value.value;
            indicators.inflation_date = result.value.date;
            break;
          case 'fed_funds_rate':
            indicators.fed_funds_rate = result.value.value;
            break;
          case 'treasury_10y':
            indicators.treasury_10y = result.value.value;
            indicators.treasury_10y_date = result.value.date;
            break;
          case 'treasury_2y':
            indicators.treasury_2y = result.value.value;
            indicators.treasury_2y_date = result.value.date;
            break;
          case 'consumer_sentiment':
            indicators.consumer_sentiment = result.value.value;
            indicators.consumer_sentiment_date = result.value.date;
            break;
          case 'industrial_production':
            indicators.industrial_production = result.value.value;
            indicators.industrial_production_date = result.value.date;
            break;
          case 'housing_starts':
            indicators.housing_starts = result.value.value;
            indicators.housing_starts_date = result.value.date;
            break;
          case 'retail_sales':
            indicators.retail_sales_growth = result.value.value;
            indicators.retail_sales_date = result.value.date;
            break;
          case 'sp500':
            indicators.sp500 = result.value.value;
            indicators.sp500_date = result.value.date;
            break;
          case 'vix':
            indicators.vix = result.value.value;
            indicators.vix_date = result.value.date;
            break;
        }
      }
    });

    // Calculate yield curve spread
    if (indicators.treasury_10y !== undefined && indicators.treasury_2y !== undefined) {
      indicators.yield_curve_spread = indicators.treasury_10y - indicators.treasury_2y;
    }

    // Cache the full macro snapshot for 4 hours (minimum of daily indicators)
    const entry: CacheEntry<MacroIndicators> = {
      data: indicators,
      timestamp: Date.now(),
      expiresAt: Date.now() + 4 * 60 * 60 * 1000,
    };
    this.cache.set(cacheKey, entry);
    
    const stats = this.getCacheStats();
    console.log(`[FREDClient] Macro indicators fetched. Cache stats: ${stats.hits} hits, ${stats.misses} misses, ${stats.apiCalls} API calls`);

    return indicators;
  }

  /**
   * Get series data (alias for compatibility with hub)
   */
  async getSeries(seriesId: string): Promise<{ success: boolean; data?: FREDSeriesData; error?: string }> {
    try {
      const [info, observations] = await Promise.all([
        this.getSeriesInfo(seriesId),
        this.getSeriesObservations(seriesId, { limit: 100 }),
      ]);

      if (!info) {
        return { success: false, error: `Series ${seriesId} not found` };
      }

      return {
        success: true,
        data: {
          series: info,
          observations,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get historical data for a series
   */
  async getHistoricalData(
    seriesId: string,
    startDate: string,
    endDate?: string
  ): Promise<FREDObservation[]> {
    return this.getSeriesObservations(seriesId, {
      observation_start: startDate,
      observation_end: endDate || new Date().toISOString().split('T')[0],
      limit: 1000,
      sort_order: 'asc',
    });
  }

  /**
   * Get sector-specific indicators
   */
  async getSectorIndicators(sector: string): Promise<Record<string, unknown>> {
    const sectorSeries: Record<string, string[]> = {
      'Technology': ['NASDAQCOM', 'PCEPI'],
      'Financials': ['FEDFUNDS', 'DGS10', 'MORTGAGE30US'],
      'Consumer Discretionary': ['UMCSENT', 'RSXFS', 'PCEDG'],
      'Consumer Staples': ['CPIUFDSL', 'PCEPILFE'],
      'Healthcare': ['CUSR0000SAM2'],
      'Industrials': ['INDPRO', 'DGORDER'],
      'Energy': ['DCOILWTICO', 'GASREGW'],
      'Materials': ['PPIACO'],
      'Real Estate': ['HOUST', 'MORTGAGE30US', 'CSUSHPINSA'],
      'Utilities': ['CUSR0000SEHF'],
      'Communication Services': ['PCEPI'],
    };

    const seriesIds = sectorSeries[sector] || ['SP500'];
    const results: Record<string, unknown> = { sector };

    for (const seriesId of seriesIds) {
      const value = await this.getLatestValue(seriesId);
      if (value) {
        results[seriesId] = value;
      }
    }

    return results;
  }

  /**
   * Check if the client is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let clientInstance: FREDClient | null = null;

export function getFREDClient(): FREDClient {
  if (!clientInstance) {
    clientInstance = new FREDClient();
  }
  return clientInstance;
}

export function resetFREDClient(): void {
  clientInstance = null;
}
