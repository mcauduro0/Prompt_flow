/**
 * ARC Investment Factory - FRED API Client
 * 
 * Federal Reserve Economic Data (FRED) API client for macroeconomic indicators.
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
// FRED CLIENT
// ============================================================================

export class FREDClient {
  private apiKey: string;
  private baseUrl = 'https://api.stlouisfed.org/fred';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FRED_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[FREDClient] No API key configured');
    }
  }

  /**
   * Get series observations
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
      const response = await fetch(`${this.baseUrl}/series/observations?${params}`);
      if (!response.ok) {
        throw new Error(`FRED API error: ${response.status}`);
      }
      const data = await response.json() as { observations?: FREDObservation[] };
      return data.observations || [];
    } catch (error) {
      console.error(`[FREDClient] Error fetching ${seriesId}:`, error);
      return [];
    }
  }

  /**
   * Get series metadata
   */
  async getSeriesInfo(seriesId: string): Promise<FREDSeries | null> {
    const params = new URLSearchParams({
      series_id: seriesId,
      api_key: this.apiKey,
      file_type: 'json',
    });

    try {
      const response = await fetch(`${this.baseUrl}/series?${params}`);
      if (!response.ok) {
        throw new Error(`FRED API error: ${response.status}`);
      }
      const data = await response.json() as { seriess?: FREDSeries[] };
      return data.seriess?.[0] || null;
    } catch (error) {
      console.error(`[FREDClient] Error fetching series info ${seriesId}:`, error);
      return null;
    }
  }

  /**
   * Get latest value for a series
   */
  async getLatestValue(seriesId: string): Promise<{ value: number; date: string } | null> {
    const observations = await this.getSeriesObservations(seriesId, { limit: 1 });
    if (observations.length === 0) return null;

    const latest = observations[0];
    const value = parseFloat(latest.value);
    if (isNaN(value)) return null;

    return { value, date: latest.date };
  }

  /**
   * Get comprehensive macro indicators
   */
  async getMacroIndicators(): Promise<MacroIndicators> {
    const indicators: MacroIndicators = {};

    // Key FRED series IDs
    const series = {
      gdp_growth: 'A191RL1Q225SBEA', // Real GDP Growth Rate
      unemployment_rate: 'UNRATE', // Unemployment Rate
      inflation_cpi: 'CPIAUCSL', // Consumer Price Index
      fed_funds_rate: 'FEDFUNDS', // Federal Funds Rate
      treasury_10y: 'DGS10', // 10-Year Treasury
      treasury_2y: 'DGS2', // 2-Year Treasury
      consumer_sentiment: 'UMCSENT', // Consumer Sentiment
      industrial_production: 'INDPRO', // Industrial Production
      housing_starts: 'HOUST', // Housing Starts
      retail_sales: 'RSXFS', // Retail Sales
      sp500: 'SP500', // S&P 500
      vix: 'VIXCLS', // VIX
    };

    // Fetch all indicators in parallel
    const results = await Promise.allSettled([
      this.getLatestValue(series.gdp_growth),
      this.getLatestValue(series.unemployment_rate),
      this.getLatestValue(series.inflation_cpi),
      this.getLatestValue(series.fed_funds_rate),
      this.getLatestValue(series.treasury_10y),
      this.getLatestValue(series.treasury_2y),
      this.getLatestValue(series.consumer_sentiment),
      this.getLatestValue(series.industrial_production),
      this.getLatestValue(series.housing_starts),
      this.getLatestValue(series.retail_sales),
      this.getLatestValue(series.sp500),
      this.getLatestValue(series.vix),
    ]);

    // Map results to indicators
    const keys = Object.keys(series) as (keyof typeof series)[];
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
