/**
 * ARC Investment Factory - Instrumented Wrappers
 * 
 * Wrappers para LLM Client e Data Sources que registram telemetria
 * sem modificar os pacotes originais.
 * 
 * Uso:
 * - Em vez de usar LLMClient diretamente, use InstrumentedLLMClient
 * - Em vez de usar PolygonClient diretamente, use InstrumentedPolygonClient
 * - etc.
 */

import { telemetry } from '@arc/database';
import type { LLMClient, LLMRequest, LLMResponse, LLMProvider } from '@arc/llm-client';
import { PolygonClient, FMPClient, getFREDClient } from '@arc/retriever';

// ============================================================================
// INSTRUMENTED LLM CLIENT
// ============================================================================

export class InstrumentedLLMClient implements LLMClient {
  private client: LLMClient;
  private providerName: string;
  private modelName: string;

  constructor(client: LLMClient, provider: string, model: string) {
    this.client = client;
    this.providerName = provider;
    this.modelName = model;
  }

  getProvider(): LLMProvider {
    return this.client.getProvider();
  }

  getModel(): string {
    return this.client.getModel();
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    let success = false;
    let errorMessage: string | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;

    try {
      const response = await this.client.complete(request);
      success = true;
      inputTokens = response.usage?.promptTokens || 0;
      outputTokens = response.usage?.completionTokens || 0;
      totalTokens = response.usage?.totalTokens || 0;
      return response;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;
      
      // Log telemetry asynchronously (non-blocking)
      telemetry.logLLMCall({
        provider: this.providerName,
        model: this.modelName,
        success,
        latencyMs,
        inputTokens,
        outputTokens,
        totalTokens,
        errorMessage,
        fallbackUsed: false,
      }).catch(err => console.error('[InstrumentedLLMClient] Telemetry error:', err));
    }
  }
}

/**
 * Wrap an existing LLM client with telemetry
 */
export function wrapLLMClient(client: LLMClient, provider: string, model: string): LLMClient {
  return new InstrumentedLLMClient(client, provider, model);
}

// ============================================================================
// INSTRUMENTED POLYGON CLIENT
// ============================================================================

export class InstrumentedPolygonClient {
  private client: PolygonClient;

  constructor(apiKey?: string) {
    this.client = new PolygonClient(apiKey);
  }

  private async withTelemetry<T>(
    endpoint: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let errorMessage: string | undefined;
    let rateLimited = false;

    try {
      const result = await operation();
      // Check if result indicates success
      if (result && typeof result === 'object' && 'success' in result) {
        success = (result as any).success;
        if (!success && 'error' in result) {
          errorMessage = (result as any).error;
        }
      } else {
        success = result !== null && result !== undefined;
      }
      return result;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
        rateLimited = true;
      }
      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;
      
      telemetry.logDataSourceHealth({
        sourceName: 'polygon',
        endpoint,
        success,
        latencyMs,
        errorMessage,
        rateLimited,
      }).catch(err => console.error('[InstrumentedPolygonClient] Telemetry error:', err));
    }
  }

  async getDailyPrices(ticker: string, from: string, to: string) {
    return this.withTelemetry(`/aggs/${ticker}`, () => 
      this.client.getDailyPrices(ticker, from, to)
    );
  }

  async getLatestPrice(ticker: string) {
    return this.withTelemetry(`/quote/${ticker}`, () => 
      this.client.getLatestPrice(ticker)
    );
  }

  async getTickerDetails(ticker: string) {
    return this.withTelemetry(`/ticker/${ticker}`, () => 
      this.client.getTickerDetails(ticker)
    );
  }

  async getNews(ticker: string, limit?: number) {
    return this.withTelemetry(`/news/${ticker}`, () => 
      this.client.getNews(ticker, limit)
    );
  }

  async getTickers(params: any) {
    return this.withTelemetry('/tickers', () => 
      this.client.getTickers(params)
    );
  }

  async getMarketStatus() {
    return this.withTelemetry('/market-status', () => 
      this.client.getMarketStatus()
    );
  }
}

// ============================================================================
// INSTRUMENTED FMP CLIENT
// ============================================================================

export class InstrumentedFMPClient {
  private client: FMPClient;

  constructor(apiKey?: string) {
    this.client = new FMPClient(apiKey);
  }

  private async withTelemetry<T>(
    endpoint: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let errorMessage: string | undefined;
    let rateLimited = false;

    try {
      const result = await operation();
      // Check if result indicates success
      if (result && typeof result === 'object' && 'success' in result) {
        success = (result as any).success;
        if (!success && 'error' in result) {
          errorMessage = (result as any).error;
        }
      } else {
        success = result !== null && result !== undefined;
      }
      return result;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
        rateLimited = true;
      }
      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;
      
      telemetry.logDataSourceHealth({
        sourceName: 'fmp',
        endpoint,
        success,
        latencyMs,
        errorMessage,
        rateLimited,
      }).catch(err => console.error('[InstrumentedFMPClient] Telemetry error:', err));
    }
  }

  async getProfile(ticker: string) {
    return this.withTelemetry(`/profile/${ticker}`, () => 
      this.client.getProfile(ticker)
    );
  }

  async getKeyMetrics(ticker: string) {
    return this.withTelemetry(`/key-metrics/${ticker}`, () => 
      this.client.getKeyMetrics(ticker)
    );
  }

  async getIncomeStatements(ticker: string, period?: 'annual' | 'quarter', limit?: number) {
    return this.withTelemetry(`/income-statement/${ticker}`, () => 
      this.client.getIncomeStatements(ticker, period, limit)
    );
  }

  async getBalanceSheets(ticker: string, period?: 'annual' | 'quarter', limit?: number) {
    return this.withTelemetry(`/balance-sheet/${ticker}`, () => 
      this.client.getBalanceSheets(ticker, period, limit)
    );
  }

  async getCashFlowStatements(ticker: string, period?: 'annual' | 'quarter', limit?: number) {
    return this.withTelemetry(`/cash-flow/${ticker}`, () => 
      this.client.getCashFlowStatements(ticker, period, limit)
    );
  }

  async getAnalystEstimates(ticker: string) {
    return this.withTelemetry(`/analyst-estimates/${ticker}`, () => 
      this.client.getAnalystEstimates(ticker)
    );
  }

  async getEarningsTranscripts(ticker: string, year?: number, quarter?: number) {
    return this.withTelemetry(`/earnings-transcript/${ticker}`, () => 
      this.client.getEarningsTranscripts(ticker, year, quarter)
    );
  }

  async screenStocks(params?: any) {
    return this.withTelemetry('/stock-screener', () => 
      this.client.screenStocks(params)
    );
  }

  async getPriceTarget(ticker: string) {
    return this.withTelemetry(`/price-target/${ticker}`, () => 
      (this.client as any).getPriceTarget?.(ticker) || this.client.getAnalystEstimates(ticker)
    );
  }

  async calculateRevenueCagr(ticker: string, years: number) {
    return this.withTelemetry(`/revenue-cagr/${ticker}`, async () => {
      // Calculate CAGR from income statements
      const result = await this.client.getIncomeStatements(ticker, 'annual', years + 1);
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
    });
  }
}

// ============================================================================
// INSTRUMENTED FRED CLIENT
// ============================================================================

export class InstrumentedFREDClient {
  private client: ReturnType<typeof getFREDClient>;

  constructor() {
    this.client = getFREDClient();
  }

  private async withTelemetry<T>(
    endpoint: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let errorMessage: string | undefined;
    let rateLimited = false;

    try {
      const result = await operation();
      success = result !== null && result !== undefined;
      return result;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
        rateLimited = true;
      }
      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;
      
      telemetry.logDataSourceHealth({
        sourceName: 'fred',
        endpoint,
        success,
        latencyMs,
        errorMessage,
        rateLimited,
      }).catch(err => console.error('[InstrumentedFREDClient] Telemetry error:', err));
    }
  }

  async getMacroIndicators() {
    return this.withTelemetry('/macro-indicators', () => 
      this.client.getMacroIndicators()
    );
  }

  async getSeriesObservations(seriesId: string, options?: any) {
    return this.withTelemetry(`/series/${seriesId}`, () => 
      this.client.getSeriesObservations(seriesId, options)
    );
  }

  async getSeriesInfo(seriesId: string) {
    return this.withTelemetry(`/series-info/${seriesId}`, () => 
      this.client.getSeriesInfo(seriesId)
    );
  }

  async getLatestValue(seriesId: string) {
    return this.withTelemetry(`/latest/${seriesId}`, () => 
      this.client.getLatestValue(seriesId)
    );
  }

  async getSeries(seriesId: string) {
    return this.withTelemetry(`/series-data/${seriesId}`, () => 
      this.client.getSeries(seriesId)
    );
  }

  async getHistoricalData(seriesId: string, startDate: string, endDate?: string) {
    return this.withTelemetry(`/historical/${seriesId}`, () => 
      this.client.getHistoricalData(seriesId, startDate, endDate)
    );
  }

  async getSectorIndicators(sector: string) {
    return this.withTelemetry(`/sector/${sector}`, () => 
      this.client.getSectorIndicators(sector)
    );
  }

  getCacheStats() {
    return this.client.getCacheStats();
  }

  clearCache() {
    return this.client.clearCache();
  }

  isConfigured() {
    return this.client.isConfigured();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an instrumented Polygon client
 */
export function createInstrumentedPolygonClient(apiKey?: string): InstrumentedPolygonClient {
  return new InstrumentedPolygonClient(apiKey);
}

/**
 * Create an instrumented FMP client
 */
export function createInstrumentedFMPClient(apiKey?: string): InstrumentedFMPClient {
  return new InstrumentedFMPClient(apiKey);
}

/**
 * Create an instrumented FRED client
 */
export function createInstrumentedFREDClient(): InstrumentedFREDClient {
  return new InstrumentedFREDClient();
}
