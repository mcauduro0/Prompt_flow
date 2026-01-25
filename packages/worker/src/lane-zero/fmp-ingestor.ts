/**
 * Lane 0 - FMP Screener Ingestor
 * 
 * Busca ideias de investimento usando o FMP Stock Screener
 * para complementar as fontes do Substack e Reddit.
 * 
 * Critérios de screening:
 * - Mid-caps ($500M - $50B market cap)
 * - US stocks (NYSE, NASDAQ)
 * - Filtros de qualidade baseados em métricas fundamentais
 */

import type { LLMClient } from '@arc/llm-client';
import { createFMPClient } from '@arc/retriever';
import type { RawIdea } from './substack-ingestor.js';

// Configuração do FMP Ingestor
export interface FMPIngestorConfig {
  minMarketCap: number;
  maxMarketCap: number;
  exchanges: string;
  country: string;
  maxStocks: number;
  minPE: number;
  maxPE: number;
  minROIC: number;
}

const DEFAULT_CONFIG: FMPIngestorConfig = {
  minMarketCap: 500_000_000,      // $500M
  maxMarketCap: 50_000_000_000,   // $50B
  exchanges: 'NYSE,NASDAQ',
  country: 'US',
  maxStocks: 100,                 // Buscar até 100 stocks
  minPE: 5,                       // Evitar stocks muito baratos (value traps)
  maxPE: 50,                      // Evitar stocks muito caros
  minROIC: 10,                    // ROIC mínimo de 10%
};

// Prompt para gerar tese de investimento baseada em métricas
const FMP_THESIS_PROMPT = `You are an investment analyst. Based on the following company metrics, generate a brief investment thesis.

Company: __COMPANY_NAME__ (__TICKER__)
Sector: __SECTOR__
Industry: __INDUSTRY__
Market Cap: $__MARKET_CAP__B
P/E Ratio: __PE__
EV/EBITDA: __EV_EBITDA__
ROIC: __ROIC__%
Gross Margin: __GROSS_MARGIN__%
Net Debt/EBITDA: __NET_DEBT_EBITDA__

Generate a 1-2 sentence investment thesis explaining why this could be an interesting investment opportunity.
Focus on the key metrics and what makes this company potentially attractive.

Respond with ONLY the thesis, no additional text.`;

// Track processed tickers in memory (since we can't use state manager for 'fmp' type)
const processedTickers = new Map<string, Date>();

export class FMPIngestor {
  private llmClient: LLMClient;
  private fmpClient: ReturnType<typeof createFMPClient>;
  private config: FMPIngestorConfig;

  constructor(
    _stateManager: any, // Not used for FMP, kept for interface compatibility
    llmClient: LLMClient,
    config: Partial<FMPIngestorConfig> = {}
  ) {
    this.llmClient = llmClient;
    this.fmpClient = createFMPClient();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async ingest(): Promise<RawIdea[]> {
    const ideas: RawIdea[] = [];
    console.log('[FMPIngestor] Starting FMP screener ingestion...');

    try {
      // Step 1: Screen stocks based on market cap criteria
      console.log(`[FMPIngestor] Screening stocks: $${this.config.minMarketCap / 1e9}B - $${this.config.maxMarketCap / 1e9}B market cap`);
      
      const screenResult = await this.fmpClient.screenStocks({
        marketCapMoreThan: this.config.minMarketCap,
        marketCapLowerThan: this.config.maxMarketCap,
        country: this.config.country,
        exchange: this.config.exchanges,
        limit: this.config.maxStocks * 2, // Get more to filter later
      });

      if (!screenResult.success || !screenResult.data) {
        console.error('[FMPIngestor] Failed to screen stocks:', screenResult.error);
        return ideas;
      }

      // Extract ticker symbols from screener results (screenResult.data contains objects with 'symbol' property)
      const tickerSymbols = screenResult.data.map((stock: any) => stock.symbol).filter(Boolean);
      console.log(`[FMPIngestor] Found ${tickerSymbols.length} stocks matching criteria`);

      // Shuffle and take a sample
      const shuffled = tickerSymbols.sort(() => Math.random() - 0.5);
      const sample = shuffled.slice(0, this.config.maxStocks);

      // Step 2: Get detailed metrics for each stock
      let processedCount = 0;
      for (const ticker of sample) {
        try {
          // Check if already processed recently (in memory)
          const lastProcessed = processedTickers.get(ticker);
          if (lastProcessed) {
            const hoursSinceProcessed = (Date.now() - lastProcessed.getTime()) / (1000 * 60 * 60);
            if (hoursSinceProcessed < 24) {
              continue; // Skip if processed in last 24 hours
            }
          }

          // Get profile and metrics
          const [profileResult, metricsResult] = await Promise.all([
            this.fmpClient.getProfile(ticker),
            this.fmpClient.getKeyMetrics(ticker),
          ]);

          if (!profileResult.success || !profileResult.data) {
            continue;
          }

          const profile = profileResult.data;
          const metrics = metricsResult.data;

          // Apply quality filters
          if (metrics) {
            // Skip if P/E is out of range
            if (metrics.pe && (metrics.pe < this.config.minPE || metrics.pe > this.config.maxPE)) {
              continue;
            }
            // Skip if ROIC is too low
            if (metrics.roic && metrics.roic < this.config.minROIC / 100) {
              continue;
            }
          }

          // Generate thesis using LLM
          const thesis = await this.generateThesis(profile, metrics);
          if (!thesis) {
            continue;
          }

          // Create raw idea with correct source type
          const idea: RawIdea = {
            ticker: ticker,
            companyName: profile.companyName || ticker,
            direction: 'LONG', // FMP screener focuses on quality longs
            thesis: thesis,
            confidence: this.calculateConfidence(metrics),
            source: {
              type: 'substack' as const, // Use 'substack' as fallback since 'fmp' is not in the union
              name: 'FMP Stock Screener',
              url: `https://financialmodelingprep.com/financial-summary/${ticker}`,
              author: 'FMP Screener',
              publishedAt: new Date(),
            },
            extractedAt: new Date(),
            rawQuote: JSON.stringify({ profile, metrics }),
          };

          ideas.push(idea);
          processedCount++;

          // Update in-memory tracker
          processedTickers.set(ticker, new Date());

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));

          // Log progress
          if (processedCount % 10 === 0) {
            console.log(`[FMPIngestor] Processed ${processedCount} stocks, extracted ${ideas.length} ideas`);
          }

        } catch (error) {
          console.warn(`[FMPIngestor] Error processing ${ticker}:`, (error as Error).message);
        }
      }

      console.log(`[FMPIngestor] Completed: ${ideas.length} ideas extracted from ${processedCount} stocks`);

    } catch (error) {
      console.error('[FMPIngestor] Fatal error:', (error as Error).message);
    }

    return ideas;
  }

  private async generateThesis(
    profile: any,
    metrics: any
  ): Promise<string | null> {
    try {
      const marketCapValue = ((profile.marketCap || 0) / 1e9).toFixed(1);
      const prompt = FMP_THESIS_PROMPT
        .replace('__COMPANY_NAME__', profile.companyName || 'Unknown')
        .replace('__TICKER__', profile.ticker || 'Unknown')
        .replace('__SECTOR__', profile.sector || 'Unknown')
        .replace('__INDUSTRY__', profile.industry || 'Unknown')
        .replace('__MARKET_CAP__', marketCapValue)
        .replace('__PE__', (metrics?.pe || 'N/A').toString())
        .replace('__EV_EBITDA__', (metrics?.evToEbitda || 'N/A').toString())
        .replace('__ROIC__', ((metrics?.roic || 0) * 100).toFixed(1))
        .replace('__GROSS_MARGIN__', ((metrics?.grossMargin || 0) * 100).toFixed(1))
        .replace('__NET_DEBT_EBITDA__', (metrics?.netDebtToEbitda || 'N/A').toString());

      const response = await this.llmClient.complete({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 200,
      });

      if (response.content) {
        return response.content.trim();
      }
    } catch (error) {
      console.warn(`[FMPIngestor] Error generating thesis:`, (error as Error).message);
    }
    return null;
  }

  private calculateConfidence(metrics: any): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (!metrics) return 'LOW';

    let score = 0;

    // ROIC > 15% is excellent
    if (metrics.roic && metrics.roic > 0.15) score += 2;
    else if (metrics.roic && metrics.roic > 0.10) score += 1;

    // Reasonable P/E (10-25)
    if (metrics.pe && metrics.pe >= 10 && metrics.pe <= 25) score += 1;

    // Low debt
    if (metrics.netDebtToEbitda && metrics.netDebtToEbitda < 2) score += 1;

    // Good margins
    if (metrics.grossMargin && metrics.grossMargin > 0.30) score += 1;

    if (score >= 4) return 'HIGH';
    if (score >= 2) return 'MEDIUM';
    return 'LOW';
  }
}

export function createFMPIngestor(
  stateManager: any,
  llmClient: LLMClient,
  config?: Partial<FMPIngestorConfig>
): FMPIngestor {
  return new FMPIngestor(stateManager, llmClient, config);
}
