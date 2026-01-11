/**
 * ARC Investment Factory - FMP Data Source
 * Financial Modeling Prep API client
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
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return {
          success: false,
          error: `FMP API error: ${response.status} ${response.statusText}`,
          source: 'fmp',
          retrievedAt: new Date().toISOString(),
        };
      }
      const data = await response.json();
      return {
        success: true,
        data,
        source: 'fmp',
        retrievedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `FMP fetch error: ${(error as Error).message}`,
        source: 'fmp',
        retrievedAt: new Date().toISOString(),
      };
    }
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
        targetPriceLow: e.estimatedRevenueLow, // FMP doesn't have target price in this endpoint
        targetPriceHigh: e.estimatedRevenueHigh,
        targetPriceAvg: e.estimatedRevenueAvg,
        numberOfAnalysts: e.numberAnalystsEstimatedRevenue,
        recommendationScore: 3, // Default neutral
      },
      source: 'fmp',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get price target consensus
   */
  async getPriceTarget(ticker: string): Promise<RetrieverResult<AnalystEstimate>> {
    const result = await this.fetch<any[]>(`/price-target-consensus/${ticker}`);

    if (!result.success || !result.data?.[0]) {
      return { ...result, data: undefined };
    }

    const t = result.data[0];
    return {
      success: true,
      data: {
        ticker,
        asOf: new Date().toISOString().split('T')[0],
        targetPriceLow: t.targetLow,
        targetPriceHigh: t.targetHigh,
        targetPriceAvg: t.targetConsensus,
        numberOfAnalysts: t.targetMedian ? 1 : 0, // FMP doesn't provide count here
        recommendationScore: 3,
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
      endpoint = `${endpoint}?year=${year}&quarter=${quarter}`;
    }

    const result = await this.fetch<any[]>(endpoint);

    if (!result.success || !result.data) {
      return { ...result, data: undefined };
    }

    return {
      success: true,
      data: result.data.map((item) => ({
        ticker,
        fiscalYear: item.year,
        fiscalQuarter: item.quarter,
        date: item.date,
        content: item.content,
        participants: [], // FMP doesn't separate participants
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
    sector?: string;
    country?: string;
    exchange?: string;
    limit?: number;
  }): Promise<RetrieverResult<string[]>> {
    const queryParams = new URLSearchParams();
    if (params.marketCapMoreThan) queryParams.set('marketCapMoreThan', params.marketCapMoreThan.toString());
    if (params.marketCapLowerThan) queryParams.set('marketCapLowerThan', params.marketCapLowerThan.toString());
    if (params.sector) queryParams.set('sector', params.sector);
    if (params.country) queryParams.set('country', params.country);
    if (params.exchange) queryParams.set('exchange', params.exchange);
    if (params.limit) queryParams.set('limit', params.limit.toString());

    const result = await this.fetch<any[]>(`/stock-screener?${queryParams.toString()}`);

    if (!result.success || !result.data) {
      return { ...result, data: undefined };
    }

    return {
      success: true,
      data: result.data.map((item) => item.symbol),
      source: 'fmp',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate revenue CAGR from historical data
   */
  async calculateRevenueCagr(ticker: string, years = 3): Promise<number | null> {
    const result = await this.getIncomeStatements(ticker, 'annual', years + 1);
    if (!result.success || !result.data || result.data.length < 2) {
      return null;
    }

    const sorted = result.data.sort((a, b) => a.fiscalYear - b.fiscalYear);
    const oldest = sorted[0].revenue;
    const newest = sorted[sorted.length - 1].revenue;
    const actualYears = sorted.length - 1;

    if (oldest <= 0 || newest <= 0) return null;

    return Math.pow(newest / oldest, 1 / actualYears) - 1;
  }
}

/**
 * Create FMP client with default configuration
 */
export function createFMPClient(apiKey?: string): FMPClient {
  return new FMPClient(apiKey);
}
