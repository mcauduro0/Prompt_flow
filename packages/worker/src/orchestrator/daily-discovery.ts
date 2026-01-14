/**
 * ARC Investment Factory - Lane A Daily Discovery Run
 * Schedule: 06:00 America/Sao_Paulo, weekdays only
 * 
 * Pipeline: fetch_universe → generate_ideas → gates → scoring → novelty_filter → persist
 * 
 * Data Sources:
 * - FMP: Company fundamentals, financial metrics, screening
 * - Polygon: Real-time prices, market data, news sentiment
 * 
 * NEW: When USE_PROMPT_LIBRARY=true, uses the Prompt Library system with:
 * - Structured prompts from prompts.json
 * - Schema validation on outputs
 * - Telemetry and budget tracking
 * - Quarantine for invalid outputs
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LANE_A_DAILY_LIMIT,
  LANE_A_DAILY_CAP,
  NOVELTY_NEW_TICKER_DAYS,
  NOVELTY_PENALTY_WINDOW_DAYS,
  SYSTEM_TIMEZONE,
} from '@arc/shared';
import { createFMPClient, createPolygonClient, getDataRetrieverHub, type SocialSentimentData } from '@arc/retriever';
import { createResilientClient, type LLMClient } from '@arc/llm-client';
import { ideasRepository, runsRepository, memoryRepository } from '@arc/database';
import {
  isPromptLibraryEnabled,
  executeLaneAWithLibrary,
  initializePromptSystem,
  type LaneAResult,
} from '../prompts/index.js';

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
  telemetry?: {
    total_cost: number;
    total_latency_ms: number;
    prompts_executed: number;
    total_tokens?: number;
    provider?: string;
    model?: string;
  };
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
  catalysts?: Array<{ name: string; window: string; probability?: string }>;
  keyRisks?: string[];
  timeHorizon?: string;
  conviction?: number;
  // Financial metrics from FMP
  evToEbitda?: number | null;
  pe?: number | null;
  fcfYield?: number | null;
  ebitMargin?: number | null;
  netDebtToEbitda?: number | null;
  revenueCagr3y?: number | null;
  roic?: number | null;
  roe?: number | null;
}

interface EnrichedStock {
  socialSentiment?: SocialSentimentData | null;
  ticker: string;
  profile: any;
  metrics: any;
  price: any;
  news: any[];
}

// ============================================================================
// DATA FETCHING (Shared between old and new pipeline)
// ============================================================================

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
 * Enrich stock data from FMP, Polygon, and Reddit
 */
async function enrichStockData(tickers: string[]): Promise<EnrichedStock[]> {
  const fmp = createFMPClient();
  const polygon = createPolygonClient();
  const dataHub = getDataRetrieverHub();
  const enriched: EnrichedStock[] = [];

  for (const ticker of tickers) {
    try {
      // Fetch from all sources in parallel
      const [profileResult, metricsResult, priceResult, newsResult, sentimentResult] = await Promise.all([
        fmp.getProfile(ticker),
        fmp.getKeyMetrics(ticker),
        polygon.getLatestPrice(ticker),
        polygon.getNews(ticker, 5),
        dataHub.getRedditSentiment(ticker),
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
        socialSentiment: sentimentResult.success ? (sentimentResult.data as SocialSentimentData) : null,
      });

      // Log social sentiment if available
      if (sentimentResult.success && sentimentResult.data) {
        console.log(`[Lane A] Reddit sentiment for ${ticker}: score=${(sentimentResult.data as SocialSentimentData).reddit_sentiment?.toFixed(2) || 'N/A'}, mentions=${(sentimentResult.data as SocialSentimentData).reddit_mentions_24h || 0}`);
      }

      // Rate limiting - be gentle with APIs
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.warn(`[Lane A] Error enriching ${ticker}:`, (error as Error).message);
    }
  }

  return enriched;
}

// ============================================================================
// NEW PIPELINE (Prompt Library)
// ============================================================================

/**
 * Run Lane A using the new Prompt Library system
 */
async function runWithPromptLibrary(
  enrichedStocks: EnrichedStock[],
  config: DiscoveryConfig
): Promise<{
  ideas: RawIdea[];
  telemetry: { total_cost: number; total_latency_ms: number; prompts_executed: number };
}> {
  await initializePromptSystem();
  
  const ideas: RawIdea[] = [];
  let totalCost = 0;
  let totalLatency = 0;
  let totalPrompts = 0;

  for (const stock of enrichedStocks) {
    try {
      const result = await executeLaneAWithLibrary(stock.ticker);
      
      // Aggregate telemetry
      if (result.telemetry) {
        totalCost += result.telemetry.total_cost;
        totalLatency += result.telemetry.total_latency_ms;
        totalPrompts += result.telemetry.prompts_executed;
      }

      // Check if idea passed all gates and has potential
      if (result.hasInvestmentPotential && result.thesis) {
        // Extract metrics from enriched stock data
        const metrics = stock.metrics || {};
        
        ideas.push({
          ticker: stock.ticker,
          companyName: stock.profile.companyName,
          thesis: result.thesis,
          styleTag: (result.styleTag as 'quality_compounder' | 'garp' | 'cigar_butt') || 'garp',
          mechanism: result.mechanism || 'Value realization',
          edgeType: result.edgeType || ['analytical'],
          marketCap: stock.profile.marketCap,
          sector: stock.profile.sector,
          currentPrice: stock.price?.close || null,
          priceChange1D: null,
          volume: stock.price?.volume || null,
          catalysts: result.catalysts,
          keyRisks: result.keyRisks,
          timeHorizon: result.timeHorizon,
          conviction: result.conviction,
          // Financial metrics from FMP
          evToEbitda: metrics.evToEbitda ?? null,
          pe: metrics.pe ?? null,
          fcfYield: metrics.fcfYield ?? null,
          ebitMargin: metrics.ebitMargin ?? null,
          netDebtToEbitda: metrics.netDebtToEbitda ?? null,
          revenueCagr3y: metrics.revenueCagr3y ?? null,
          roic: metrics.roic ?? null,
          roe: metrics.roe ?? null,
        });
        console.log(`[Lane A/Library] Generated idea for ${stock.ticker} (conviction: ${result.conviction}, P/E: ${metrics.pe?.toFixed(1) || 'N/A'})`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.warn(`[Lane A/Library] Error processing ${stock.ticker}:`, (error as Error).message);
    }
  }

  return {
    ideas,
    telemetry: {
      total_cost: totalCost,
      total_latency_ms: totalLatency,
      prompts_executed: totalPrompts,
    },
  };
}

// ============================================================================
// LEGACY PIPELINE (Hardcoded prompts)
// ============================================================================

/**
 * Generate investment ideas using LLM with enriched data (legacy)
 * Now includes telemetry tracking for tokens, cost, and latency
 */
async function generateIdeasLegacy(
  stocks: EnrichedStock[],
  llm: LLMClient
): Promise<{ ideas: RawIdea[]; telemetry: { total_tokens: number; total_cost: number; total_latency_ms: number; llm_calls: number; provider: string; model: string } }> {
  const ideas: RawIdea[] = [];
  
  // Telemetry tracking
  let totalTokens = 0;
  let totalCost = 0;
  let totalLatency = 0;
  let llmCalls = 0;
  const provider = 'openai';
  const model = 'gpt-5.2-chat-latest';

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

Social Sentiment (Reddit):
${stock.socialSentiment ? `- Reddit Mentions (24h): ${stock.socialSentiment.reddit_mentions_24h || 0}
- Sentiment Score: ${stock.socialSentiment.reddit_sentiment?.toFixed(2) || 'N/A'} (-1 to 1 scale)
- Key Themes: ${stock.socialSentiment.key_themes?.join(', ') || 'N/A'}` : 'No social sentiment data available'}

Based on this information, provide your analysis:
1. Does this company have investment potential? Consider quality of business, valuation, catalysts, and social sentiment (if available - high Reddit interest may indicate retail momentum or crowded trade).
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

      const callStart = Date.now();
      const response = await llm.complete({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });
      const callLatency = Date.now() - callStart;
      
      // Track telemetry
      llmCalls++;
      totalLatency += callLatency;
      const promptTokens = response.usage?.promptTokens || 0;
      const completionTokens = response.usage?.completionTokens || 0;
      totalTokens += promptTokens + completionTokens;
      // Cost estimation: GPT-5.2 ~$0.01/1K input, $0.03/1K output
      totalCost += (promptTokens * 0.00001) + (completionTokens * 0.00003);

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
            conviction: analysis.conviction,
            // Financial metrics from FMP
            evToEbitda: metrics?.evToEbitda ?? null,
            pe: metrics?.pe ?? null,
            fcfYield: metrics?.fcfYield ?? null,
            ebitMargin: metrics?.ebitMargin ?? null,
            netDebtToEbitda: metrics?.netDebtToEbitda ?? null,
            revenueCagr3y: null, // Requires separate calculation
            roic: metrics?.roic ?? null,
            roe: metrics?.roe ?? null,
          });
          console.log(`[Lane A] Generated idea for ${ticker} (conviction: ${analysis.conviction}, P/E: ${metrics?.pe?.toFixed(1) || 'N/A'})`);
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

  return {
    ideas,
    telemetry: {
      total_tokens: totalTokens,
      total_cost: totalCost,
      total_latency_ms: totalLatency,
      llm_calls: llmCalls,
      provider,
      model,
    },
  };
}

// ============================================================================
// SHARED LOGIC
// ============================================================================

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
    // If conviction is available (from new pipeline), use it
    if (a.conviction !== undefined && b.conviction !== undefined) {
      if (b.conviction !== a.conviction) {
        return b.conviction - a.conviction;
      }
    }

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

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Main daily discovery run
 */
export async function runDailyDiscovery(config: DiscoveryConfig = {}): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const runId = uuidv4();
  const errors: string[] = [];
  const asOf = new Date().toISOString().split('T')[0];
  const usePromptLibrary = isPromptLibraryEnabled();

  console.log(`[Lane A] Starting daily discovery run at ${new Date().toISOString()}`);
  console.log(`[Lane A] Run ID: ${runId}`);
  console.log(`[Lane A] Timezone: ${SYSTEM_TIMEZONE}`);
  console.log(`[Lane A] Daily limit: ${LANE_A_DAILY_LIMIT}, Cap: ${LANE_A_DAILY_CAP}`);
  console.log(`[Lane A] Novelty window: ${NOVELTY_NEW_TICKER_DAYS} days, Penalty: ${NOVELTY_PENALTY_WINDOW_DAYS} days`);
  console.log(`[Lane A] Using Prompt Library: ${usePromptLibrary ? 'YES' : 'NO (legacy)'}`);

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

  let telemetry: { total_cost: number; total_latency_ms: number; prompts_executed: number; total_tokens?: number; provider?: string; model?: string } | undefined;

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

    // Step 3: Generate ideas (using new or legacy pipeline)
    let rawIdeas: RawIdea[];

    if (usePromptLibrary) {
      console.log('[Lane A] Step 3: Generating ideas with Prompt Library...');
      const result = await runWithPromptLibrary(enrichedStocks, config);
      rawIdeas = result.ideas;
      telemetry = result.telemetry;
      console.log(`[Lane A] Prompt Library telemetry: ${telemetry.prompts_executed} prompts, $${telemetry.total_cost.toFixed(4)} cost`);
    } else {
      console.log('[Lane A] Step 3: Generating ideas with LLM (legacy)...');
      const llm = createResilientClient();
      const legacyResult = await generateIdeasLegacy(enrichedStocks, llm);
      rawIdeas = legacyResult.ideas;
      // Convert legacy telemetry format to standard format
      telemetry = {
        total_cost: legacyResult.telemetry.total_cost,
        total_latency_ms: legacyResult.telemetry.total_latency_ms,
        prompts_executed: legacyResult.telemetry.llm_calls,
        total_tokens: legacyResult.telemetry.total_tokens,
        provider: legacyResult.telemetry.provider,
        model: legacyResult.telemetry.model,
      };
      console.log(`[Lane A] Legacy telemetry: ${telemetry!.prompts_executed} LLM calls, ${telemetry!.total_tokens} tokens, $${telemetry!.total_cost.toFixed(4)} cost`);
    }
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
        
        // Calculate conviction score (normalize to 0-100 scale)
        // LLM returns 1-10, we scale to 0-100 for consistency
        const convictionScore = idea.conviction ? Math.round(idea.conviction * 10) : 0;
        
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
          // Financial metrics from FMP
          quickMetrics: {
            market_cap_usd: idea.marketCap,
            ev_to_ebitda: idea.evToEbitda ?? null,
            pe: idea.pe ?? null,
            fcf_yield: idea.fcfYield ?? null,
            revenue_cagr_3y: idea.revenueCagr3y ?? null,
            ebit_margin: idea.ebitMargin ?? null,
            net_debt_to_ebitda: idea.netDebtToEbitda ?? null,
          },
          // Conviction score from LLM analysis
          score: idea.conviction ? {
            total: convictionScore,
            edge_clarity: 0,
            business_quality_prior: 0,
            financial_resilience_prior: 0,
            valuation_tension: 0,
            catalyst_clarity: 0,
            information_availability: 0,
            complexity_penalty: 0,
            disclosure_friction_penalty: 0,
          } : undefined,
          // Time horizon if available
          timeHorizon: idea.timeHorizon || '1_3_years',
          // Catalysts if available
          catalysts: idea.catalysts?.map(c => ({
            name: c.name,
            window: c.window,
            probability: parseFloat(c.probability || '0.5'),
            expected_impact: 'medium' as const,
            how_to_monitor: '',
          })),
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
      usePromptLibrary,
      telemetry,
    });

    console.log(`[Lane A] Discovery run completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    return {
      success: true,
      ideasGenerated: rawIdeas.length,
      ideasPassed: novelIdeas.length,
      ideasInbox: persistedCount,
      errors,
      duration_ms: Date.now() - startTime,
      telemetry,
    };
  } catch (error) {
    const errorMessage = (error as Error).message;
    errors.push(errorMessage);
    console.error(`[Lane A] Fatal error: ${errorMessage}`);

    await runsRepository.updateStatus(runId, 'failed');
    await runsRepository.updatePayload(runId, {
      error: errorMessage,
      errors,
      duration_ms: Date.now() - startTime,
    });

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
