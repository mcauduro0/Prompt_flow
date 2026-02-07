/**
 * ARC Investment Factory - FMP Data Source
 * Financial Modeling Prep API client
 * INSTRUMENTED with telemetry for QA Framework v2.0
 */
import type {
  CompanyProfile,
  FinancialMetrics,
  IncomeStatement,
  BalanceSheet,
  CashFlowStatement,
  AnalystEstimate,
  EarningsTranscript,
  RetrieverResult,
} from '../types.js';

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

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

export class FMPClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.FMP_API_KEY ?? '';
    if (!this.apiKey) {
      console.warn('FMP API key not configured');
    }
  }

  private async fetch<T>(endpoint: string): Promise<RetrieverResult<T>> {
    const url = `${FMP_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${this.apiKey}`;
    const startTime = Date.now();
    let success = false;
    let errorMessage: string | undefined;
    let rateLimited = false;
    
    try {
      const response = await fetch(url);
      
      // Check for rate limiting
      if (response.status === 429) {
        rateLimited = true;
        errorMessage = 'Rate limited by FMP API';
        return {
          success: false,
          error: errorMessage,
          source: 'fmp',
          retrievedAt: new Date().toISOString(),
        };
      }
      
      if (!response.ok) {
        errorMessage = `FMP API error: ${response.status} ${response.statusText}`;
        return {
          success: false,
          error: errorMessage,
          source: 'fmp',
          retrievedAt: new Date().toISOString(),
        };
      }
      
      const data = await response.json() as T;
      success = true;
      
      return {
        success: true,
        data: data as T,
        source: 'fmp',
        retrievedAt: new Date().toISOString(),
      };
    } catch (error) {
      errorMessage = `FMP fetch error: ${(error as Error).message}`;
      return {
        success: false,
        error: errorMessage,
        source: 'fmp',
        retrievedAt: new Date().toISOString(),
      };
    } finally {
      // Log telemetry asynchronously (non-blocking)
      const latencyMs = Date.now() - startTime;
      this.logTelemetryAsync({
        sourceName: 'fmp',
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
      .catch(err => console.error('[FMPClient] Telemetry error:', err));
  }

  /**
   * Get company profile
   */
  async getProfile(ticker: string): Promise<RetrieverResult<CompanyProfile>> {
    const result = await this.fetch<any[]>(`/profile/${ticker}`);
    if (!result.success || !result.data?.[0]) {
      return { ...result, data: undefined };
    }
    const p = result.data[0];
    return {
      success: true,
      data: {
        ticker: p.symbol,
        companyName: p.companyName,
        exchange: p.exchangeShortName,
        sector: p.sector,
        industry: p.industry,
        country: p.country,
        currency: p.currency,
        marketCap: p.mktCap,
        description: p.description,
        website: p.website,
        ceo: p.ceo,
        employees: p.fullTimeEmployees,
      },
      source: 'fmp',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get key financial metrics
   */
  async getKeyMetrics(ticker: string): Promise<RetrieverResult<FinancialMetrics>> {
    const [metricsResult, ratiosResult] = await Promise.all([
      this.fetch<any[]>(`/key-metrics-ttm/${ticker}`),
      this.fetch<any[]>(`/ratios-ttm/${ticker}`),
    ]);

    if (!metricsResult.success || !metricsResult.data?.[0]) {
      return { ...metricsResult, data: undefined };
    }

    const m = metricsResult.data[0];
    const r = ratiosResult.data?.[0] ?? {};

    return {
      success: true,
      data: {
        ticker,
        asOf: new Date().toISOString().split('T')[0],
        marketCapUsd: m.marketCapTTM,
        evToEbitda: m.enterpriseValueOverEBITDATTM,
        pe: m.peRatioTTM,
        fcfYield: m.freeCashFlowYieldTTM,
        revenueCagr3y: null, // Need to calculate from historical data
        ebitMargin: r.operatingProfitMarginTTM,
        netDebtToEbitda: m.netDebtToEBITDATTM,
        grossMargin: r.grossProfitMarginTTM,
        roic: m.roicTTM,
        roe: r.returnOnEquityTTM,
        currentRatio: r.currentRatioTTM,
        quickRatio: r.quickRatioTTM,
      },
      source: 'fmp',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get income statements
   */
  async getIncomeStatements(
    ticker: string,
    period: 'annual' | 'quarter' = 'annual',
    limit = 5
  ): Promise<RetrieverResult<IncomeStatement[]>> {
    const result = await this.fetch<any[]>(
      `/income-statement/${ticker}?period=${period}&limit=${limit}`
    );
    if (!result.success || !result.data) {
      return { ...result, data: undefined };
    }
    return {
      success: true,
      data: result.data.map((item) => ({
        ticker,
        fiscalYear: parseInt(item.calendarYear),
        fiscalQuarter: period === 'quarter' ? parseInt(item.period.replace('Q', '')) : undefined,
        revenue: item.revenue,
        grossProfit: item.grossProfit,
        operatingIncome: item.operatingIncome,
        netIncome: item.netIncome,
        ebitda: item.ebitda,
        eps: item.eps,
        dilutedEps: item.epsdiluted,
      })),
      source: 'fmp',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get balance sheets
   */
  async getBalanceSheets(
    ticker: string,
    period: 'annual' | 'quarter' = 'annual',
    limit = 5
  ): Promise<RetrieverResult<BalanceSheet[]>> {
    const result = await this.fetch<any[]>(
      `/balance-sheet-statement/${ticker}?period=${period}&limit=${limit}`
    );
    if (!result.success || !result.data) {
      return { ...result, data: undefined };
    }
    return {
      success: true,
      data: result.data.map((item) => ({
        ticker,
        fiscalYear: parseInt(item.calendarYear),
        fiscalQuarter: period === 'quarter' ? parseInt(item.period.replace('Q', '')) : undefined,
        totalAssets: item.totalAssets,
        totalLiabilities: item.totalLiabilities,
        totalEquity: item.totalStockholdersEquity,
        cash: item.cashAndCashEquivalents,
        totalDebt: item.totalDebt,
        netDebt: item.netDebt,
      })),
      source: 'fmp',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get cash flow statements
   */
  async getCashFlowStatements(
    ticker: string,
    period: 'annual' | 'quarter' = 'annual',
    limit = 5
  ): Promise<RetrieverResult<CashFlowStatement[]>> {
    const result = await this.fetch<any[]>(
      `/cash-flow-statement/${ticker}?period=${period}&limit=${limit}`
    );
    if (!result.success || !result.data) {
      return { ...result, data: undefined };
    }
    return {
      success: true,
      data: result.data.map((item) => ({
        ticker,
        fiscalYear: parseInt(item.calendarYear),
        fiscalQuarter: period === 'quarter' ? parseInt(item.period.replace('Q', '')) : undefined,
        operatingCashFlow: item.operatingCashFlow,
        capitalExpenditure: item.capitalExpenditure,
        freeCashFlow: item.freeCashFlow,
        dividendsPaid: item.dividendsPaid,
        shareRepurchases: item.commonStockRepurchased,
      })),
      source: 'fmp',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get analyst estimates
   */
  async getAnalystEstimates(ticker: string): Promise<RetrieverResult<AnalystEstimate>> {
    const result = await this.fetch<any[]>(`/analyst-estimates/${ticker}?limit=1`);
    if (!result.success || !result.data?.[0]) {
      return { ...result, data: undefined };
    }
    const e = result.data[0];
    return {
      success: true,
      data: {
        ticker,
        asOf: e.date,
        targetPriceLow: e.estimatedRevenueLow,
        targetPriceHigh: e.estimatedRevenueHigh,
        targetPriceAvg: e.estimatedRevenueAvg,
        numberOfAnalysts: e.numberAnalystsEstimatedRevenue,
        recommendationScore: 3, // Default neutral score
      },
      source: 'fmp',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get earnings call transcripts
   */
  async getEarningsTranscripts(
    ticker: string,
    year?: number,
    quarter?: number
  ): Promise<RetrieverResult<EarningsTranscript[]>> {
    let endpoint = `/earning_call_transcript/${ticker}`;
    if (year && quarter) {
      endpoint += `?year=${year}&quarter=${quarter}`;
    }
    const result = await this.fetch<any[]>(endpoint);
    if (!result.success || !result.data) {
      return { ...result, data: undefined };
    }
    return {
      success: true,
      data: result.data.map((t) => ({
        ticker,
        fiscalYear: t.year,
        fiscalQuarter: t.quarter,
        date: t.date,
        content: t.content,
        participants: [], // FMP doesn't provide participants
      })),
      source: 'fmp',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get stock screener results
   */
  async screenStocks(params: {
    marketCapMoreThan?: number;
    marketCapLowerThan?: number;
    priceMoreThan?: number;
    priceLowerThan?: number;
    betaMoreThan?: number;
    betaLowerThan?: number;
    volumeMoreThan?: number;
    volumeLowerThan?: number;
    dividendMoreThan?: number;
    dividendLowerThan?: number;
    isEtf?: boolean;
    isActivelyTrading?: boolean;
    sector?: string;
    industry?: string;
    country?: string;
    exchange?: string;
    limit?: number;
  } = {}): Promise<RetrieverResult<any[]>> {
    const queryParams = new URLSearchParams();
    
    if (params.marketCapMoreThan) queryParams.set('marketCapMoreThan', params.marketCapMoreThan.toString());
    if (params.marketCapLowerThan) queryParams.set('marketCapLowerThan', params.marketCapLowerThan.toString());
    if (params.priceMoreThan) queryParams.set('priceMoreThan', params.priceMoreThan.toString());
    if (params.priceLowerThan) queryParams.set('priceLowerThan', params.priceLowerThan.toString());
    if (params.betaMoreThan) queryParams.set('betaMoreThan', params.betaMoreThan.toString());
    if (params.betaLowerThan) queryParams.set('betaLowerThan', params.betaLowerThan.toString());
    if (params.volumeMoreThan) queryParams.set('volumeMoreThan', params.volumeMoreThan.toString());
    if (params.volumeLowerThan) queryParams.set('volumeLowerThan', params.volumeLowerThan.toString());
    if (params.dividendMoreThan) queryParams.set('dividendMoreThan', params.dividendMoreThan.toString());
    if (params.dividendLowerThan) queryParams.set('dividendLowerThan', params.dividendLowerThan.toString());
    if (params.isEtf !== undefined) queryParams.set('isEtf', params.isEtf.toString());
    if (params.isActivelyTrading !== undefined) queryParams.set('isActivelyTrading', params.isActivelyTrading.toString());
    if (params.sector) queryParams.set('sector', params.sector);
    if (params.industry) queryParams.set('industry', params.industry);
    if (params.country) queryParams.set('country', params.country);
    if (params.exchange) queryParams.set('exchange', params.exchange);
    queryParams.set('limit', (params.limit ?? 100).toString());

    const result = await this.fetch<any[]>(`/stock-screener?${queryParams.toString()}`);
    return result;
  }

  /**
   * Search for companies by name or ticker
   */
  async searchCompany(query: string, limit: number = 10): Promise<RetrieverResult<Array<{ symbol: string; name: string; currency: string; stockExchange: string; exchangeShortName: string }>>> {
    const result = await this.fetch<any[]>(`/search?query=${encodeURIComponent(query)}&limit=${limit}`);
    if (!result.success || !result.data) {
      return { ...result, data: undefined };
    }
    return {
      success: true,
      data: result.data.map((item: any) => ({
        symbol: item.symbol,
        name: item.name,
        currency: item.currency,
        stockExchange: item.stockExchange,
        exchangeShortName: item.exchangeShortName,
      })),
      source: 'fmp',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get price target (analyst estimates)
   */
  async getPriceTarget(ticker: string): Promise<RetrieverResult<AnalystEstimate>> {
    const result = await this.fetch<any[]>(`/price-target/${ticker}`);
    if (!result.success || !result.data?.[0]) {
      return { ...result, data: undefined };
    }
    const e = result.data[0];
    return {
      success: true,
      data: {
        ticker,
        asOf: e.publishedDate || new Date().toISOString().split('T')[0],
        targetPriceLow: e.adjPriceLow || e.priceLow || 0,
        targetPriceHigh: e.adjPriceHigh || e.priceHigh || 0,
        targetPriceAvg: e.adjPriceTarget || e.priceTarget || 0,
        numberOfAnalysts: e.numberOfAnalysts || 1,
        recommendationScore: 3, // Default neutral score
      },
      source: 'fmp',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate revenue CAGR over specified years
   */
  async calculateRevenueCagr(ticker: string, years: number): Promise<number | null> {
    const result = await this.getIncomeStatements(ticker, 'annual', years + 1);
    if (!result.success || !result.data || result.data.length < 2) {
      return null;
    }
    
    const sorted = result.data.sort((a, b) => a.fiscalYear - b.fiscalYear);
    const oldestRevenue = sorted[0]?.revenue;
    const newestRevenue = sorted[sorted.length - 1]?.revenue;
    
    if (!oldestRevenue || !newestRevenue || oldestRevenue <= 0) {
      return null;
    }
    
    const actualYears = sorted.length - 1;
    const cagr = Math.pow(newestRevenue / oldestRevenue, 1 / actualYears) - 1;
    return cagr * 100; // Return as percentage
  }
  /**
   * Get real-time quote for a ticker (includes price, volume, market cap, etc.)
   * This is the primary method for getting current price data
   */
  async getQuote(ticker: string): Promise<RetrieverResult<{
    ticker: string;
    price: number;
    open: number;
    high: number;
    low: number;
    previousClose: number;
    volume: number;
    avgVolume: number;
    marketCap: number;
    pe: number;
    eps: number;
    yearHigh: number;
    yearLow: number;
    priceAvg50: number;
    priceAvg200: number;
    exchange: string;
    name: string;
  }>> {
    const result = await this.fetch<any[]>(`/quote/${ticker}`);
    if (!result.success || !result.data?.[0]) {
      return { ...result, data: undefined };
    }
    const q = result.data[0];
    return {
      success: true,
      data: {
        ticker: q.symbol,
        price: q.price,
        open: q.open,
        high: q.dayHigh,
        low: q.dayLow,
        previousClose: q.previousClose,
        volume: q.volume,
        avgVolume: q.avgVolume,
        marketCap: q.marketCap,
        pe: q.pe,
        eps: q.eps,
        yearHigh: q.yearHigh,
        yearLow: q.yearLow,
        priceAvg50: q.priceAvg50,
        priceAvg200: q.priceAvg200,
        exchange: q.exchange,
        name: q.name,
      },
      source: "fmp",
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get latest stock price in StockPrice format (compatible with Polygon interface)
   * This provides a fallback when Polygon does not have data for international stocks
   */
  async getLatestPrice(ticker: string): Promise<RetrieverResult<import("../types.js").StockPrice>> {
    const quoteResult = await this.getQuote(ticker);
    if (!quoteResult.success || !quoteResult.data) {
      return { ...quoteResult, data: undefined };
    }
    const q = quoteResult.data;
    return {
      success: true,
      data: {
        ticker: q.ticker,
        date: new Date().toISOString().split("T")[0],
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.price,
        volume: q.volume,
        adjustedClose: q.price,
      },
      source: "fmp",
      retrievedAt: new Date().toISOString(),
    };
  }

}

/**
 * Create FMP client with default configuration
 */
export function createFMPClient(apiKey?: string): FMPClient {
  return new FMPClient(apiKey);
}
