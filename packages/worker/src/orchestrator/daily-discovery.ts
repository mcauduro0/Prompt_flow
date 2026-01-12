/**
 * ARC Investment Factory - Lane A Daily Discovery Run
 * Schedule: 06:00 America/Sao_Paulo, weekdays only
 * 
 * Pipeline: fetch_universe → generate_ideas → gates → scoring → novelty_filter → persist
 * 
 * Data Sources:
 * - FMP: Company fundamentals, financial metrics, screening
 * - Polygon: Real-time prices, market data, news sentiment
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LANE_A_DAILY_LIMIT,
  LANE_A_DAILY_CAP,
  NOVELTY_NEW_TICKER_DAYS,
  NOVELTY_PENALTY_WINDOW_DAYS,
  SYSTEM_TIMEZONE,
} from '@arc/shared';
import { createFMPClient, createPolygonClient } from '@arc/retriever';
import { createResilientClient, type LLMClient } from '@arc/llm-client';
import { ideasRepository, runsRepository, memoryRepository } from '@arc/database';

export interface DiscoveryConfig {
  dryRun?: boolean;
  maxIdeas?: number;
}

export interface DiscoveryResult {
  success: boolean;
  ideasGenerated: number;
  ideasPassed: number;
  ideasInbox: number;
  errors: string[];
  duration_ms: number;
}

interface RawIdea {
  ticker: string;
  companyName: string;
  thesis: string;
  styleTag: 'quality_compounder' | 'garp' | 'cigar_butt';
  mechanism: string;
  edgeType: string[];
  marketCap: number | null;
  sector: string | null;
  currentPrice: number | null;
  priceChange1D: number | null;
  volume: number | null;
}

interface EnrichedStock {
  ticker: string;
  profile: any;
  metrics: any;
  price: any;
  news: any[];
}

/**
 * Fetch universe of stocks to analyze using FMP screener
 */
async function fetchUniverse(): Promise<string[]> {
  const fmp = createFMPClient();
  
  // Get US stocks with market cap between $500M and $50B (mid-cap focus)
  const result = await fmp.screenStocks({
    marketCapMoreThan: 500_000_000,
    marketCapLowerThan: 50_000_000_000,
    country: 'US',
    exchange: 'NYSE,NASDAQ',
    limit: 500,
  });

  if (!result.success || !result.data) {
    console.error('[Lane A] Failed to fetch universe:', result.error);
    return [];
  }

  // Shuffle and take a sample for daily analysis
  const shuffled = result.data.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 30); // Analyze 30 stocks per day
}

/**
 * Enrich stock data from both FMP and Polygon
 */
async function enrichStockData(tickers: string[]): Promise<EnrichedStock[]> {
  const fmp = createFMPClient();
  const polygon = createPolygonClient();
  const enriched: EnrichedStock[] = [];

  for (const ticker of tickers) {
    try {
      // Fetch from both sources in parallel
      const [profileResult, metricsResult, priceResult, newsResult] = await Promise.all([
        fmp.getProfile(ticker),
        fmp.getKeyMetrics(ticker),
        polygon.getLatestPrice(ticker),
        polygon.getNews(ticker, 5),
      ]);

      if (!profileResult.success || !profileResult.data) {
        console.warn(`[Lane A] Skipping ${ticker} - no profile data`);
        continue;
      }

      enriched.push({
        ticker,
        profile: profileResult.data,
        metrics: metricsResult.data,
        price: priceResult.data,
        news: newsResult.data || [],
      });

      // Rate limiting - be gentle with APIs
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.warn(`[Lane A] Error enriching ${ticker}:`, (error as Error).message);
    }
  }

  return enriched;
}

/**
 * Generate investment ideas using LLM with enriched data
 */
async function generateIdeas(
  stocks: EnrichedStock[],
  llm: LLMClient
): Promise<RawIdea[]> {
  const ideas: RawIdea[] = [];

  for (const stock of stocks) {
    try {
      const { ticker, profile, metrics, price, news } = stock;

      // Build news summary
      const newsSummary = news.length > 0
        ? news.slice(0, 3).map((n: any) => `- ${n.title}`).join('\n')
        : 'No recent news';

      // Calculate price momentum
      const priceInfo = price
        ? `Current Price: $${price.close?.toFixed(2)}, Volume: ${(price.volume / 1_000_000).toFixed(2)}M`
        : 'Price data unavailable';

      // Generate idea using LLM
      const prompt = `You are a senior investment analyst at a fundamental-focused hedge fund. Analyze this company and determine if it has investment potential.

Company: ${profile.companyName} (${ticker})
Sector: ${profile.sector}
Industry: ${profile.industry}
Market Cap: $${((profile.marketCap || 0) / 1_000_000_000).toFixed(2)}B
${priceInfo}

Business Description:
${profile.description?.slice(0, 600) || 'N/A'}

Financial Metrics (TTM):
- EV/EBITDA: ${metrics?.evToEbitda?.toFixed(2) || 'N/A'}
- P/E: ${metrics?.pe?.toFixed(2) || 'N/A'}
- FCF Yield: ${metrics?.fcfYield ? (metrics.fcfYield * 100).toFixed(2) + '%' : 'N/A'}
- EBIT Margin: ${metrics?.ebitMargin ? (metrics.ebitMargin * 100).toFixed(2) + '%' : 'N/A'}
- Gross Margin: ${metrics?.grossMargin ? (metrics.grossMargin * 100).toFixed(2) + '%' : 'N/A'}
- ROIC: ${metrics?.roic ? (metrics.roic * 100).toFixed(2) + '%' : 'N/A'}
- ROE: ${metrics?.roe ? (metrics.roe * 100).toFixed(2) + '%' : 'N/A'}
- Net Debt/EBITDA: ${metrics?.netDebtToEbitda?.toFixed(2) || 'N/A'}

Recent News:
${newsSummary}

Based on this information, provide your analysis:
1. Does this company have investment potential? Consider quality of business, valuation, and catalysts.
2. A brief investment thesis (2-3 sentences max)
3. Investment style classification:
   - quality_compounder: High quality business with durable moat, strong ROIC, can compound value over time
   - garp: Growth at reasonable price - good growth prospects at fair valuation
   - cigar_butt: Deep value - trading below intrinsic value, potential catalyst for rerating
4. The mechanism - how will value be realized? (e.g., multiple expansion, earnings growth, capital return)
5. Edge types - what is the informational or analytical edge? (e.g., misunderstood business, overlooked catalyst, market overreaction)
6. Conviction level (1-10)

Respond ONLY in valid JSON format:
{
  "hasInvestmentPotential": boolean,
  "thesis": "string",
  "styleTag": "quality_compounder" | "garp" | "cigar_butt",
  "mechanism": "string",
  "edgeType": ["string"],
  "conviction": number
}`;

      const response = await llm.complete({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      try {
        // Extract JSON from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.warn(`[Lane A] No JSON found in response for ${ticker}`);
          continue;
        }
        
        const analysis = JSON.parse(jsonMatch[0]);
        
        if (analysis.hasInvestmentPotential && analysis.conviction >= 6) {
          ideas.push({
            ticker,
            companyName: profile.companyName,
            thesis: analysis.thesis,
            styleTag: analysis.styleTag as 'quality_compounder' | 'garp' | 'cigar_butt',
            mechanism: analysis.mechanism || 'Value realization through operational improvement',
            edgeType: analysis.edgeType || ['analytical'],
            marketCap: profile.marketCap,
            sector: profile.sector,
            currentPrice: price?.close || null,
            priceChange1D: null,
            volume: price?.volume || null,
          });
          console.log(`[Lane A] Generated idea for ${ticker} (conviction: ${analysis.conviction})`);
        }
      } catch (parseError) {
        console.warn(`[Lane A] Failed to parse LLM response for ${ticker}:`, (parseError as Error).message);
      }

      // Rate limiting for LLM
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.warn(`[Lane A] Error analyzing ${stock.ticker}:`, (error as Error).message);
    }
  }

  return ideas;
}

/**
 * Apply novelty filter to ideas
 */
async function applyNoveltyFilter(ideas: RawIdea[]): Promise<RawIdea[]> {
  const novelIdeas: RawIdea[] = [];

  for (const idea of ideas) {
    try {
      const lastSeen = await memoryRepository.getLastSeenDate(idea.ticker);
      
      if (!lastSeen) {
        // New ticker - always include
        novelIdeas.push(idea);
        continue;
      }

      const daysSinceLastSeen = Math.floor(
        (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Include if not seen in 90 days
      if (daysSinceLastSeen >= NOVELTY_NEW_TICKER_DAYS) {
        novelIdeas.push(idea);
      } else if (daysSinceLastSeen > NOVELTY_PENALTY_WINDOW_DAYS) {
        // Between 30-90 days - include with lower priority
        novelIdeas.push(idea);
      } else {
        console.log(`[Lane A] Filtered out ${idea.ticker} - seen ${daysSinceLastSeen} days ago`);
      }
    } catch (error) {
      // On error, include the idea
      novelIdeas.push(idea);
    }
  }

  return novelIdeas;
}

/**
 * Rank ideas based on multiple factors
 */
function rankIdeas(ideas: RawIdea[]): RawIdea[] {
  return [...ideas].sort((a, b) => {
    // Prefer mid-cap ($1B-$20B)
    const aCapScore = getMarketCapScore(a.marketCap);
    const bCapScore = getMarketCapScore(b.marketCap);
    
    // Prefer quality compounders, then GARP, then cigar butts
    const styleScores: Record<string, number> = {
      quality_compounder: 3,
      garp: 2,
      cigar_butt: 1,
    };
    const aStyleScore = styleScores[a.styleTag] || 1;
    const bStyleScore = styleScores[b.styleTag] || 1;
    
    // Combined score
    const aScore = aCapScore * 2 + aStyleScore;
    const bScore = bCapScore * 2 + bStyleScore;
    
    return bScore - aScore;
  });
}

function getMarketCapScore(marketCap: number | null): number {
  if (!marketCap) return 1;
  const capInBillions = marketCap / 1_000_000_000;
  if (capInBillions >= 1 && capInBillions <= 20) return 3;
  if (capInBillions >= 0.5 && capInBillions <= 50) return 2;
  return 1;
}

/**
 * Main daily discovery run
 */
export async function runDailyDiscovery(config: DiscoveryConfig = {}): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const runId = uuidv4();
  const errors: string[] = [];
  const asOf = new Date().toISOString().split('T')[0];

  console.log(`[Lane A] Starting daily discovery run at ${new Date().toISOString()}`);
  console.log(`[Lane A] Run ID: ${runId}`);
  console.log(`[Lane A] Timezone: ${SYSTEM_TIMEZONE}`);
  console.log(`[Lane A] Daily limit: ${LANE_A_DAILY_LIMIT}, Cap: ${LANE_A_DAILY_CAP}`);
  console.log(`[Lane A] Novelty window: ${NOVELTY_NEW_TICKER_DAYS} days, Penalty: ${NOVELTY_PENALTY_WINDOW_DAYS} days`);

  // Create run record
  await runsRepository.create({
    runId,
    runType: 'daily_discovery',
    runDate: new Date(),
    status: 'running',
  });

  if (config.dryRun) {
    console.log('[Lane A] Dry run - skipping actual processing');
    await runsRepository.updateStatus(runId, 'completed');
    await runsRepository.updatePayload(runId, { dryRun: true });
    return {
      success: true,
      ideasGenerated: 0,
      ideasPassed: 0,
      ideasInbox: 0,
      errors: [],
      duration_ms: Date.now() - startTime,
    };
  }

  try {
    // Step 1: Fetch universe from FMP
    console.log('[Lane A] Step 1: Fetching universe from FMP...');
    const universe = await fetchUniverse();
    console.log(`[Lane A] Universe size: ${universe.length} stocks`);

    if (universe.length === 0) {
      throw new Error('Failed to fetch universe - no stocks returned');
    }

    // Step 2: Enrich data from FMP + Polygon
    console.log('[Lane A] Step 2: Enriching stock data from FMP + Polygon...');
    const enrichedStocks = await enrichStockData(universe);
    console.log(`[Lane A] Enriched ${enrichedStocks.length} stocks`);

    if (enrichedStocks.length === 0) {
      throw new Error('Failed to enrich any stocks');
    }

    // Step 3: Generate ideas using LLM
    console.log('[Lane A] Step 3: Generating ideas with LLM...');
    const llm = createResilientClient();
    const rawIdeas = await generateIdeas(enrichedStocks, llm);
    console.log(`[Lane A] Generated ${rawIdeas.length} raw ideas`);

    // Step 4: Apply novelty filter
    console.log('[Lane A] Step 4: Applying novelty filter...');
    const novelIdeas = await applyNoveltyFilter(rawIdeas);
    console.log(`[Lane A] ${novelIdeas.length} ideas passed novelty filter`);

    // Step 5: Rank and cap
    console.log('[Lane A] Step 5: Ranking ideas...');
    const rankedIdeas = rankIdeas(novelIdeas);
    const cappedIdeas = rankedIdeas.slice(0, config.maxIdeas ?? LANE_A_DAILY_CAP);
    console.log(`[Lane A] Capped to ${cappedIdeas.length} ideas`);

    // Step 6: Persist to inbox
    console.log('[Lane A] Step 6: Persisting to inbox...');
    let persistedCount = 0;
    for (const idea of cappedIdeas) {
      try {
        const ideaId = uuidv4();
        await ideasRepository.create({
          ideaId,
          ticker: idea.ticker,
          companyName: idea.companyName,
          asOf,
          styleTag: idea.styleTag,
          oneSentenceHypothesis: idea.thesis,
          mechanism: idea.mechanism,
          edgeType: idea.edgeType,
          status: 'new',
          quickMetrics: {
            market_cap_usd: idea.marketCap,
            ev_to_ebitda: null,
            pe: null,
            fcf_yield: null,
            revenue_cagr_3y: null,
            ebit_margin: null,
            net_debt_to_ebitda: null,
          },
        });

        // Record in memory for novelty tracking
        await memoryRepository.recordTickerSeen(idea.ticker, ideaId);
        
        persistedCount++;
        console.log(`[Lane A] Persisted: ${idea.ticker} - ${idea.companyName}`);
      } catch (error) {
        const errMsg = `Failed to persist ${idea.ticker}: ${(error as Error).message}`;
        errors.push(errMsg);
        console.error(`[Lane A] ${errMsg}`);
      }
    }

    console.log(`[Lane A] Persisted ${persistedCount} ideas to inbox`);

    // Update run record
    await runsRepository.updateStatus(runId, 'completed');
    await runsRepository.updatePayload(runId, {
      universeSize: universe.length,
      enrichedStocks: enrichedStocks.length,
      rawIdeas: rawIdeas.length,
      passedNovelty: novelIdeas.length,
      persisted: persistedCount,
      errors: errors.length,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[Lane A] Discovery run completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    return {
      success: true,
      ideasGenerated: rawIdeas.length,
      ideasPassed: novelIdeas.length,
      ideasInbox: persistedCount,
      errors,
      duration_ms: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = (error as Error).message;
    errors.push(errorMessage);
    
    await runsRepository.updateStatus(runId, 'failed', errorMessage);

    console.error('[Lane A] Discovery run failed:', errorMessage);

    return {
      success: false,
      ideasGenerated: 0,
      ideasPassed: 0,
      ideasInbox: 0,
      errors,
      duration_ms: Date.now() - startTime,
    };
  }
}

export default { runDailyDiscovery };
