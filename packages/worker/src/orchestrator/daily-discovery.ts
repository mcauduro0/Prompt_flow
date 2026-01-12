/**
 * ARC Investment Factory - Lane A Daily Discovery Run
 * Schedule: 06:00 America/Sao_Paulo, weekdays only
 * 
 * Pipeline: fetch_universe → generate_ideas → gates → scoring → novelty_filter → persist
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LANE_A_DAILY_LIMIT,
  LANE_A_DAILY_CAP,
  NOVELTY_NEW_TICKER_DAYS,
  NOVELTY_PENALTY_WINDOW_DAYS,
  SYSTEM_TIMEZONE,
} from '@arc/shared';
import { createFMPClient } from '@arc/retriever';
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
}

/**
 * Fetch universe of stocks to analyze
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
 * Generate investment ideas using LLM
 */
async function generateIdeas(
  tickers: string[],
  llm: LLMClient
): Promise<RawIdea[]> {
  const fmp = createFMPClient();
  const ideas: RawIdea[] = [];

  for (const ticker of tickers) {
    try {
      // Fetch company data
      const [profileResult, metricsResult] = await Promise.all([
        fmp.getProfile(ticker),
        fmp.getKeyMetrics(ticker),
      ]);

      if (!profileResult.success || !profileResult.data) {
        continue;
      }

      const profile = profileResult.data;
      const metrics = metricsResult.data;

      // Generate idea using LLM
      const prompt = `You are an investment analyst. Analyze this company and determine if it has investment potential.

Company: ${profile.companyName} (${ticker})
Sector: ${profile.sector}
Industry: ${profile.industry}
Market Cap: $${((profile.marketCap || 0) / 1_000_000_000).toFixed(2)}B
Description: ${profile.description?.slice(0, 500)}

Financial Metrics:
- EV/EBITDA: ${metrics?.evToEbitda?.toFixed(2) || 'N/A'}
- P/E: ${metrics?.pe?.toFixed(2) || 'N/A'}
- FCF Yield: ${metrics?.fcfYield ? (metrics.fcfYield * 100).toFixed(2) + '%' : 'N/A'}
- EBIT Margin: ${metrics?.ebitMargin ? (metrics.ebitMargin * 100).toFixed(2) + '%' : 'N/A'}
- ROIC: ${metrics?.roic ? (metrics.roic * 100).toFixed(2) + '%' : 'N/A'}
- Net Debt/EBITDA: ${metrics?.netDebtToEbitda?.toFixed(2) || 'N/A'}

Based on this information, provide:
1. A brief investment thesis (2-3 sentences)
2. Investment style classification: quality_compounder (high quality, durable moat), garp (growth at reasonable price), or cigar_butt (deep value)
3. The mechanism - how will value be realized?
4. Edge types - what is the informational or analytical edge?
5. Conviction level (1-10)

Respond in JSON format:
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
        if (!jsonMatch) continue;
        
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
          });
        }
      } catch (parseError) {
        console.warn(`[Lane A] Failed to parse LLM response for ${ticker}`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.warn(`[Lane A] Error analyzing ${ticker}:`, (error as Error).message);
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
 * Simple ranking based on market cap and sector diversity
 */
function rankIdeas(ideas: RawIdea[]): RawIdea[] {
  return [...ideas].sort((a, b) => {
    // Prefer mid-cap ($1B-$20B)
    const aCapScore = getMarketCapScore(a.marketCap);
    const bCapScore = getMarketCapScore(b.marketCap);
    return bCapScore - aCapScore;
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

  // Create run record
  await runsRepository.create({
    runId,
    runType: 'daily_discovery',
    runDate: new Date(),
    status: 'running',
  });

  if (config.dryRun) {
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
    // Step 1: Fetch universe
    console.log('[Lane A] Step 1: Fetching universe...');
    const universe = await fetchUniverse();
    console.log(`[Lane A] Universe size: ${universe.length} stocks`);

    if (universe.length === 0) {
      throw new Error('Failed to fetch universe - no stocks returned');
    }

    // Step 2: Generate ideas
    console.log('[Lane A] Step 2: Generating ideas...');
    const llm = createResilientClient();
    const rawIdeas = await generateIdeas(universe, llm);
    console.log(`[Lane A] Generated ${rawIdeas.length} raw ideas`);

    // Step 3: Apply novelty filter
    console.log('[Lane A] Step 3: Applying novelty filter...');
    const novelIdeas = await applyNoveltyFilter(rawIdeas);
    console.log(`[Lane A] ${novelIdeas.length} ideas passed novelty filter`);

    // Step 4: Rank and cap
    console.log('[Lane A] Step 4: Ranking ideas...');
    const rankedIdeas = rankIdeas(novelIdeas);
    const cappedIdeas = rankedIdeas.slice(0, config.maxIdeas ?? LANE_A_DAILY_CAP);

    // Step 5: Persist to inbox
    console.log('[Lane A] Step 5: Persisting to inbox...');
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
      } catch (error) {
        errors.push(`Failed to persist ${idea.ticker}: ${(error as Error).message}`);
      }
    }

    console.log(`[Lane A] Persisted ${persistedCount} ideas to inbox`);

    // Update run record
    await runsRepository.updateStatus(runId, 'completed');
    await runsRepository.updatePayload(runId, {
      universeSize: universe.length,
      rawIdeas: rawIdeas.length,
      passedNovelty: novelIdeas.length,
      persisted: persistedCount,
      errors: errors.length,
    });

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
