/**
 * ARC Investment Factory - Data Aggregator
 * Combines data from multiple sources for comprehensive company analysis
 */
import { FMPClient, createFMPClient } from './sources/fmp.js';
import { PolygonClient, createPolygonClient } from './sources/polygon.js';
import { SECEdgarClient, createSECEdgarClient } from './sources/sec-edgar.js';
import { FREDClient, getFREDClient, type MacroIndicators } from './sources/fred.js';
import type {
  CompanyProfile,
  FinancialMetrics,
  IncomeStatement,
  BalanceSheet,
  CashFlowStatement,
  StockPrice,
  NewsArticle,
  SECFiling,
  AnalystEstimate,
  DataSourceConfig,
} from './types.js';

export interface AggregatedCompanyData {
  ticker: string;
  retrievedAt: string;
  profile?: CompanyProfile;
  metrics?: FinancialMetrics;
  incomeStatements?: IncomeStatement[];
  balanceSheets?: BalanceSheet[];
  cashFlowStatements?: CashFlowStatement[];
  latestPrice?: StockPrice;
  priceHistory?: StockPrice[];
  news?: NewsArticle[];
  filings?: SECFiling[];
  analystEstimates?: AnalystEstimate;
  macroIndicators?: MacroIndicators;
  errors: string[];
}

export class DataAggregator {
  private fmpClient: FMPClient;
  private polygonClient: PolygonClient;
  private secClient: SECEdgarClient;
  private fredClient: FREDClient;

  constructor(config: DataSourceConfig = {}) {
    this.fmpClient = createFMPClient(config.fmpApiKey);
    this.polygonClient = createPolygonClient(config.polygonApiKey);
    this.secClient = createSECEdgarClient(config.secUserAgent);
    this.fredClient = getFREDClient();
  }

  /**
   * Get comprehensive company data from all sources
   */
  async getCompanyData(
    ticker: string,
    options: {
      includeFinancials?: boolean;
      includePriceHistory?: boolean;
      includeNews?: boolean;
      includeFilings?: boolean;
      includeMacro?: boolean;
      priceHistoryDays?: number;
    } = {}
  ): Promise<AggregatedCompanyData> {
    const {
      includeFinancials = true,
      includePriceHistory = false,
      includeNews = true,
      includeFilings = true,
      includeMacro = true,
      priceHistoryDays = 365,
    } = options;

    const errors: string[] = [];
    const result: AggregatedCompanyData = {
      ticker: ticker.toUpperCase(),
      retrievedAt: new Date().toISOString(),
      errors,
    };

    // Fetch profile and metrics (always)
    const [profileResult, metricsResult, priceResult] = await Promise.all([
      this.fmpClient.getProfile(ticker),
      this.fmpClient.getKeyMetrics(ticker),
      this.polygonClient.getLatestPrice(ticker),
    ]);

    if (profileResult.success) {
      result.profile = profileResult.data;
    } else {
      errors.push(`Profile: ${profileResult.error}`);
    }

    if (metricsResult.success) {
      result.metrics = metricsResult.data;
    } else {
      errors.push(`Metrics: ${metricsResult.error}`);
    }

    // Try Polygon first, fallback to FMP for international stocks
    if (priceResult.success && priceResult.data) {
      result.latestPrice = priceResult.data;
    } else {
      // Polygon failed (common for international stocks), try FMP as fallback
      console.log(`[DataAggregator] Polygon price failed for ${ticker}, trying FMP fallback...`);
      const fmpPriceResult = await this.fmpClient.getLatestPrice(ticker);
      if (fmpPriceResult.success && fmpPriceResult.data) {
        result.latestPrice = fmpPriceResult.data;
        console.log(`[DataAggregator] FMP fallback successful for ${ticker}: price=${fmpPriceResult.data.close}`);
      } else {
        errors.push(`Price: Polygon failed (${priceResult.error}), FMP fallback also failed (${fmpPriceResult.error})`);
      }
    }

    // Fetch financials if requested
    if (includeFinancials) {
      const [incomeResult, balanceResult, cashFlowResult] = await Promise.all([
        this.fmpClient.getIncomeStatements(ticker, 'annual', 5),
        this.fmpClient.getBalanceSheets(ticker, 'annual', 5),
        this.fmpClient.getCashFlowStatements(ticker, 'annual', 5),
      ]);

      if (incomeResult.success) result.incomeStatements = incomeResult.data;
      else errors.push(`Income: ${incomeResult.error}`);

      if (balanceResult.success) result.balanceSheets = balanceResult.data;
      else errors.push(`Balance: ${balanceResult.error}`);

      if (cashFlowResult.success) result.cashFlowStatements = cashFlowResult.data;
      else errors.push(`CashFlow: ${cashFlowResult.error}`);
    }

    // Fetch price history if requested
    if (includePriceHistory) {
      const to = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - priceHistoryDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      
      const historyResult = await this.polygonClient.getDailyPrices(ticker, from, to);
      if (historyResult.success) {
        result.priceHistory = historyResult.data;
      } else {
        errors.push(`PriceHistory: ${historyResult.error}`);
      }
    }

    // Fetch news if requested
    if (includeNews) {
      const newsResult = await this.polygonClient.getNews(ticker, 10);
      if (newsResult.success) {
        result.news = newsResult.data;
      } else {
        errors.push(`News: ${newsResult.error}`);
      }
    }

    // Fetch SEC filings if requested
    if (includeFilings) {
      const filingsResult = await this.secClient.getFilings(ticker, ['10-K', '10-Q', '8-K'], 10);
      if (filingsResult.success) {
        result.filings = filingsResult.data;
      } else {
        errors.push(`Filings: ${filingsResult.error}`);
      }
    }

    // Fetch macro indicators if requested (NEW)
    if (includeMacro) {
      try {
        const macroResult = await this.fredClient.getMacroIndicators();
        result.macroIndicators = macroResult;
        console.log(`[DataAggregator] Fetched macro indicators: GDP=${macroResult.gdp_growth}%, Unemployment=${macroResult.unemployment_rate}%, Fed Funds=${macroResult.fed_funds_rate}%`);
      } catch (error) {
        errors.push(`Macro: ${(error as Error).message}`);
        console.warn(`[DataAggregator] Failed to fetch macro indicators:`, (error as Error).message);
      }
    }

    // Fetch analyst estimates
    const estimatesResult = await this.fmpClient.getPriceTarget(ticker);
    if (estimatesResult.success) {
      result.analystEstimates = estimatesResult.data;
    }

    return result;
  }

  /**
   * Get quick metrics for idea generation
   */
  async getQuickMetrics(ticker: string): Promise<{
    market_cap_usd: number | null;
    ev_to_ebitda: number | null;
    pe: number | null;
    fcf_yield: number | null;
    revenue_cagr_3y: number | null;
    ebit_margin: number | null;
    net_debt_to_ebitda: number | null;
  }> {
    const [metricsResult, cagr] = await Promise.all([
      this.fmpClient.getKeyMetrics(ticker),
      this.fmpClient.calculateRevenueCagr(ticker, 3),
    ]);

    if (!metricsResult.success || !metricsResult.data) {
      return {
        market_cap_usd: null,
        ev_to_ebitda: null,
        pe: null,
        fcf_yield: null,
        revenue_cagr_3y: null,
        ebit_margin: null,
        net_debt_to_ebitda: null,
      };
    }

    const m = metricsResult.data;
    return {
      market_cap_usd: m.marketCapUsd,
      ev_to_ebitda: m.evToEbitda,
      pe: m.pe,
      fcf_yield: m.fcfYield,
      revenue_cagr_3y: cagr,
      ebit_margin: m.ebitMargin,
      net_debt_to_ebitda: m.netDebtToEbitda,
    };
  }

  /**
   * Get tickers from a screener
   */
  async screenTickers(params: {
    marketCapMin?: number;
    marketCapMax?: number;
    sector?: string;
    country?: string;
    exchange?: string;
    limit?: number;
  }): Promise<string[]> {
    const result = await this.fmpClient.screenStocks({
      marketCapMoreThan: params.marketCapMin,
      marketCapLowerThan: params.marketCapMax,
      sector: params.sector,
      country: params.country,
      exchange: params.exchange,
      limit: params.limit ?? 100,
    });
    return result.success ? result.data ?? [] : [];
  }

  /**
   * Get recent news across multiple tickers
   */
  async getMarketNews(limit = 20): Promise<NewsArticle[]> {
    const result = await this.polygonClient.getNews(undefined, limit);
    return result.success ? result.data ?? [] : [];
  }

  /**
   * Check if market is open
   */
  async isMarketOpen(): Promise<boolean> {
    const result = await this.polygonClient.getMarketStatus();
    return result.success && result.data?.market === 'open';
  }

  /**
   * Get macro indicators only (for standalone use)
   */
  async getMacroIndicators(): Promise<MacroIndicators> {
    return this.fredClient.getMacroIndicators();
  }
}

/**
 * Create data aggregator with default configuration
 */
export function createDataAggregator(config?: DataSourceConfig): DataAggregator {
  return new DataAggregator(config);
}
