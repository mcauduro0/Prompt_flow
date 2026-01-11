/**
 * ARC Investment Factory - Daily Discovery Run (Lane A) - V2 CORRECTED
 * 
 * CRITICAL FIX: Novelty shortlist computed BEFORE LLM generation
 * This protects novelty intent and controls LLM cost.
 * 
 * CORRECTED FLOW ORDER:
 * 1. fetch_universe - Get tickers from FMP screener
 * 2. compute_novelty_shortlist - Build shortlist biased by novelty FIRST (before LLM)
 * 3. generate_ideas - LLM enrichment ONLY on shortlist (up to 200 cap)
 * 4. run_gates - Apply 5 gates (data_sufficiency, coherence, edge_claim, downside_shape, style_fit)
 * 5. score_and_rank - Calculate weighted scores
 * 6. style_mix_adjust - Adjust for style quotas
 * 7. select_top_n - Select top 120 ideas
 * 8. persist_inbox - Save to database with immutable versions
 * 9. notify_user - Send notification via email/WhatsApp
 * 
 * Schedule: 06:00 America/Sao_Paulo, weekdays only (Mon-Fri)
 */

import { DAGRunner, createDAGRunner, type DAGContext, type DAGNode } from './dag-runner.js';
import { createDataAggregator, type DataAggregator } from '@arc/retriever';
import { createResilientClient, type ResilientLLMClient } from '@arc/llm-client';
import {
  IdeaCardSchema,
  validateWithRetry,
  type IdeaCard,
  type IdeaCardCreate,
} from '@arc/core';
import {
  ideasRepository,
  noveltyStateRepository,
  styleMixStateRepository,
  runsRepository,
  type NewIdea,
} from '@arc/database';
import {
  OPERATING_PARAMETERS,
  NOVELTY_SCORING,
  GATES,
  LANE_A_DAILY_LIMIT,
  SYSTEM_TIMEZONE,
  SCHEDULES,
  REJECTION_SHADOW,
  WHATS_NEW_CONFIG,
  type EdgeType,
  type StyleTag,
} from '@arc/shared';

// ============================================================================
// TYPES
// ============================================================================

interface NoveltyShortlistItem {
  ticker: string;
  companyName: string;
  sector: string;
  industry: string;
  marketCap: number;
  noveltyScore: number;
  isNew: boolean;
  hasNewEdge: boolean;
  repetitionPenalty: number;
  isExploration: boolean;
  priorRejection: RejectionShadow | null;
  whatsNewSinceLastTime: string[];
}

interface RejectionShadow {
  rejectedAt: Date;
  reason: string;
  isBlocking: boolean;
}

interface DiscoveryContextV2 extends DAGContext {
  data: {
    universe: UniverseTicker[];
    noveltyShortlist: NoveltyShortlistItem[];
    rawIdeas: IdeaCardCreate[];
    gatedIdeas: IdeaCardCreate[];
    scoredIdeas: IdeaCardCreate[];
    styleMixAdjustedIdeas: IdeaCardCreate[];
    selectedIdeas: IdeaCardCreate[];
    persistedIdeas: IdeaCard[];
    asOf: string;
    gateStats: Record<string, { passed: number; failed: number }>;
  };
}

interface UniverseTicker {
  ticker: string;
  companyName: string;
  sector: string;
  industry: string;
  marketCap: number;
  exchange: string;
  country: string;
}

// ============================================================================
// PROMPTS
// ============================================================================

const IDEA_GENERATION_SYSTEM_PROMPT = `You are an expert equity research analyst generating investment idea cards.

CRITICAL: Focus on NOVEL insights. The tickers you receive have been pre-selected for novelty.
Avoid generic observations. Be specific about numbers, timing, and mechanisms.

For each company, generate a structured IdeaCard with:
1. A one-sentence hypothesis capturing the core investment thesis (max 500 chars)
2. The mechanism explaining WHY this hypothesis should play out (detailed)
3. Edge type: variant_perception, unit_economics_inflection, mispriced_risk, reinvestment_runway, rerating_catalyst, or underfollowed
4. Style tag: quality_compounder, garp, or cigar_butt
5. 2-4 specific signposts to monitor with thresholds
6. 1-3 catalysts with timing windows and probabilities
7. Quick metrics with actual numbers
8. Score components (0-20 for edge_clarity, 0-15 for business_quality, etc.)

Output ONLY valid JSON matching the IdeaCard schema.`;

// ============================================================================
// NODE 1: FETCH UNIVERSE
// ============================================================================

function createFetchUniverseNode(aggregator: DataAggregator): DAGNode {
  return {
    id: 'fetch_universe',
    name: 'Fetch Universe',
    dependencies: [],
    timeout: 120000,
    retries: 2,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContextV2;
      console.log('[fetch_universe] Fetching investment universe...');

      const [usLargeCap, usMidCap, usSmallCap, international] = await Promise.all([
        aggregator.screenTickers({
          marketCapMin: 10_000_000_000,
          country: 'US',
          limit: 500,
        }),
        aggregator.screenTickers({
          marketCapMin: 2_000_000_000,
          marketCapMax: 10_000_000_000,
          country: 'US',
          limit: 300,
        }),
        aggregator.screenTickers({
          marketCapMin: 500_000_000,
          marketCapMax: 2_000_000_000,
          country: 'US',
          limit: 200,
        }),
        aggregator.screenTickers({
          marketCapMin: 5_000_000_000,
          countries: ['CA', 'GB', 'DE', 'FR', 'JP', 'AU'],
          limit: 200,
        }),
      ]);

      // Combine all tickers with metadata
      const allTickers = [...usLargeCap, ...usMidCap, ...usSmallCap, ...international];
      
      // Dedupe by ticker
      const tickerMap = new Map<string, UniverseTicker>();
      for (const t of allTickers) {
        if (!tickerMap.has(t.ticker)) {
          tickerMap.set(t.ticker, t);
        }
      }

      ctx.data.universe = Array.from(tickerMap.values());
      ctx.data.asOf = new Date().toISOString().split('T')[0];

      console.log(`[fetch_universe] Found ${ctx.data.universe.length} unique tickers`);
    },
  };
}

// ============================================================================
// NODE 2: COMPUTE NOVELTY SHORTLIST (BEFORE LLM!)
// ============================================================================

function createComputeNoveltyShortlistNode(): DAGNode {
  return {
    id: 'compute_novelty_shortlist',
    name: 'Compute Novelty Shortlist',
    dependencies: ['fetch_universe'],
    timeout: 180000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContextV2;
      console.log('[compute_novelty_shortlist] Computing novelty-biased shortlist BEFORE LLM...');

      const now = new Date();
      const llmCap = OPERATING_PARAMETERS.LANE_A_LLM_ENRICHMENT_CAP;
      const explorationRate = OPERATING_PARAMETERS.LANE_A_EXPLORATION_RATE;

      // Get novelty states for all tickers
      const tickers = ctx.data.universe.map(t => t.ticker);
      const noveltyStates = await noveltyStateRepository.getByTickers(tickers);
      const noveltyMap = new Map(noveltyStates.map(s => [s.ticker, s]));

      // Get rejection history
      const rejectionHistory = await ideasRepository.getRejectionHistory(tickers);
      const rejectionMap = new Map(rejectionHistory.map(r => [r.ticker, r]));

      // Calculate novelty scores for all tickers
      const shortlistItems: NoveltyShortlistItem[] = [];

      for (const ticker of ctx.data.universe) {
        const state = noveltyMap.get(ticker.ticker);
        const rejection = rejectionMap.get(ticker.ticker);

        // Check if blocked by rejection shadow
        if (rejection && REJECTION_SHADOW.blocking_reasons.includes(rejection.reason as any)) {
          continue; // Skip blocked tickers
        }

        // Calculate novelty score
        let noveltyScore = 0;
        let isNew = true;
        let hasNewEdge = false;
        let repetitionPenalty = 0;
        const whatsNewSinceLastTime: string[] = [];

        if (state) {
          const daysSinceLastSeen = Math.floor(
            (now.getTime() - new Date(state.lastSeen).getTime()) / (24 * 60 * 60 * 1000)
          );

          // Ticker is "new" if not seen in 90 days
          isNew = daysSinceLastSeen >= NOVELTY_SCORING.TICKER_NEW_IF_NOT_SEEN_DAYS;

          if (isNew) {
            noveltyScore += NOVELTY_SCORING.TICKER_NEW_BONUS;
            whatsNewSinceLastTime.push(`Not seen in ${daysSinceLastSeen} days`);
          } else {
            // Check for repetition penalty (seen in last 30 days with no new edge)
            if (daysSinceLastSeen < NOVELTY_SCORING.REPETITION_PENALTY_WINDOW_DAYS) {
              // We don't know if there's a new edge yet, so assume no
              repetitionPenalty = NOVELTY_SCORING.SEEN_IN_LAST_30_DAYS_NO_NEW_EDGE_PENALTY;
              
              // Additional penalty if seen more than 3 times in 90 days
              if ((state.seenCount ?? 0) > 3) {
                repetitionPenalty += NOVELTY_SCORING.SEEN_MORE_THAN_3_TIMES_IN_90_DAYS_PENALTY;
              }
            }
          }

          // Check for style tag change
          if (state.lastStyleTag) {
            // We'll check this after LLM generates the idea
          }
        } else {
          // Never seen before - maximum novelty
          noveltyScore = NOVELTY_SCORING.TICKER_NEW_BONUS;
          isNew = true;
          whatsNewSinceLastTime.push('First time in universe');
        }

        // Apply penalties
        noveltyScore += repetitionPenalty; // repetitionPenalty is already negative

        // Apply floor
        noveltyScore = Math.max(noveltyScore, NOVELTY_SCORING.MIN_NOVELTY_SCORE * 100);

        shortlistItems.push({
          ticker: ticker.ticker,
          companyName: ticker.companyName,
          sector: ticker.sector,
          industry: ticker.industry,
          marketCap: ticker.marketCap,
          noveltyScore,
          isNew,
          hasNewEdge,
          repetitionPenalty,
          isExploration: false,
          priorRejection: rejection ? {
            rejectedAt: rejection.rejectedAt,
            reason: rejection.reason,
            isBlocking: REJECTION_SHADOW.blocking_reasons.includes(rejection.reason as any),
          } : null,
          whatsNewSinceLastTime,
        });
      }

      // Sort by novelty score (descending)
      shortlistItems.sort((a, b) => b.noveltyScore - a.noveltyScore);

      // Calculate slots
      const explorationSlots = Math.floor(llmCap * explorationRate);
      const noveltySlots = llmCap - explorationSlots;

      // Take top novelty-ranked tickers
      const noveltySelected = shortlistItems.slice(0, noveltySlots);

      // Random exploration from remaining
      const remaining = shortlistItems.slice(noveltySlots);
      const explorationSelected: NoveltyShortlistItem[] = [];

      if (remaining.length > 0 && explorationSlots > 0) {
        const shuffled = [...remaining].sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(explorationSlots, shuffled.length); i++) {
          shuffled[i].isExploration = true;
          explorationSelected.push(shuffled[i]);
        }
      }

      ctx.data.noveltyShortlist = [...noveltySelected, ...explorationSelected];

      console.log(`[compute_novelty_shortlist] Shortlist: ${noveltySelected.length} novelty + ${explorationSelected.length} exploration = ${ctx.data.noveltyShortlist.length} total`);
      console.log(`[compute_novelty_shortlist] Top 5 by novelty: ${noveltySelected.slice(0, 5).map(i => `${i.ticker}(${i.noveltyScore.toFixed(0)})`).join(', ')}`);
    },
  };
}

// ============================================================================
// NODE 3: GENERATE IDEAS (ONLY ON SHORTLIST)
// ============================================================================

function createGenerateIdeasNode(
  aggregator: DataAggregator,
  llmClient: ResilientLLMClient
): DAGNode {
  return {
    id: 'generate_ideas',
    name: 'Generate Ideas',
    dependencies: ['compute_novelty_shortlist'],
    timeout: 600000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContextV2;
      console.log('[generate_ideas] Generating ideas from novelty shortlist...');

      const rawIdeas: IdeaCardCreate[] = [];
      const batchSize = 10;

      for (let i = 0; i < ctx.data.noveltyShortlist.length; i += batchSize) {
        const batch = ctx.data.noveltyShortlist.slice(i, i + batchSize);
        console.log(`[generate_ideas] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ctx.data.noveltyShortlist.length / batchSize)}`);

        const batchResults = await Promise.all(
          batch.map(async (item) => {
            try {
              const companyData = await aggregator.getCompanyData(item.ticker, {
                includeFinancials: true,
                includeNews: true,
                includeFilings: false,
              });

              if (!companyData.profile || !companyData.metrics) {
                return null;
              }

              // Include novelty context in prompt
              const noveltyContext = item.whatsNewSinceLastTime.length > 0
                ? `\nNOVELTY CONTEXT: ${item.whatsNewSinceLastTime.join('; ')}`
                : '';

              const priorRejectionContext = item.priorRejection
                ? `\nPRIOR REJECTION: ${item.priorRejection.reason} on ${item.priorRejection.rejectedAt.toISOString().split('T')[0]}. Focus on what has changed.`
                : '';

              const userPrompt = `Analyze this company and generate an IdeaCard:

COMPANY: ${item.ticker} - ${item.companyName}
SECTOR: ${item.sector}
INDUSTRY: ${item.industry}
MARKET CAP: $${(item.marketCap / 1_000_000_000).toFixed(1)}B
NOVELTY SCORE: ${item.noveltyScore.toFixed(0)} (${item.isExploration ? 'exploration pick' : item.isNew ? 'new ticker' : 'returning ticker'})
${noveltyContext}
${priorRejectionContext}

PROFILE: ${JSON.stringify(companyData.profile, null, 2)}
METRICS: ${JSON.stringify(companyData.metrics, null, 2)}
RECENT NEWS: ${JSON.stringify(companyData.news?.slice(0, 5) ?? [], null, 2)}

If no compelling thesis exists, return: {"skip": true, "reason": "..."}

Otherwise, return a complete IdeaCard JSON.`;

              const response = await llmClient.complete({
                messages: [
                  { role: 'system', content: IDEA_GENERATION_SYSTEM_PROMPT },
                  { role: 'user', content: userPrompt },
                ],
                maxTokens: 2500,
                temperature: 0.7,
                jsonMode: true,
              });

              const parsed = JSON.parse(response.content);

              if (parsed.skip) {
                console.log(`[generate_ideas] Skipped ${item.ticker}: ${parsed.reason}`);
                return null;
              }

              // Add metadata
              parsed.idea_id = crypto.randomUUID();
              parsed.as_of = ctx.data.asOf;
              parsed.status = 'new';
              parsed.novelty_score = item.noveltyScore.toFixed(2);
              parsed.is_new_ticker = item.isNew;
              parsed.is_exploration = item.isExploration;
              parsed.whats_new_since_last_time = item.whatsNewSinceLastTime;
              parsed.rejection_shadow = item.priorRejection;

              return parsed as IdeaCardCreate;
            } catch (error) {
              console.error(`[generate_ideas] Error processing ${item.ticker}:`, error);
              return null;
            }
          })
        );

        rawIdeas.push(...batchResults.filter((idea): idea is IdeaCardCreate => idea !== null));
      }

      ctx.data.rawIdeas = rawIdeas;
      console.log(`[generate_ideas] Generated ${rawIdeas.length} raw ideas from ${ctx.data.noveltyShortlist.length} shortlist`);
    },
  };
}

// ============================================================================
// NODE 4: RUN GATES (ENFORCED)
// ============================================================================

function createRunGatesNode(): DAGNode {
  return {
    id: 'run_gates',
    name: 'Run Gates',
    dependencies: ['generate_ideas'],
    timeout: 120000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContextV2;
      console.log('[run_gates] Running gates on ideas...');

      const gatedIdeas: IdeaCardCreate[] = [];
      const gateStats: Record<string, { passed: number; failed: number }> = {
        gate_0_data_sufficiency: { passed: 0, failed: 0 },
        gate_1_coherence: { passed: 0, failed: 0 },
        gate_2_edge_claim: { passed: 0, failed: 0 },
        gate_3_downside_shape: { passed: 0, failed: 0 },
        gate_4_style_fit: { passed: 0, failed: 0 },
      };

      for (const idea of ctx.data.rawIdeas) {
        // Gate 0: Data Sufficiency
        if (!checkGate0DataSufficiency(idea)) {
          gateStats.gate_0_data_sufficiency.failed++;
          continue;
        }
        gateStats.gate_0_data_sufficiency.passed++;

        // Gate 1: Coherence
        if (!checkGate1Coherence(idea)) {
          gateStats.gate_1_coherence.failed++;
          continue;
        }
        gateStats.gate_1_coherence.passed++;

        // Gate 2: Edge Claim
        if (!checkGate2EdgeClaim(idea)) {
          gateStats.gate_2_edge_claim.failed++;
          continue;
        }
        gateStats.gate_2_edge_claim.passed++;

        // Gate 3: Downside Shape (ENFORCED)
        if (!checkGate3DownsideShape(idea)) {
          gateStats.gate_3_downside_shape.failed++;
          continue;
        }
        gateStats.gate_3_downside_shape.passed++;

        // Gate 4: Style Fit (ENFORCED)
        if (!checkGate4StyleFit(idea)) {
          gateStats.gate_4_style_fit.failed++;
          continue;
        }
        gateStats.gate_4_style_fit.passed++;

        // All gates passed
        gatedIdeas.push({
          ...idea,
          gate_results: {
            gate_0_data_sufficiency: 'pass',
            gate_1_coherence: 'pass',
            gate_2_edge_claim: 'pass',
            gate_3_downside_shape: 'pass',
            gate_4_style_fit: 'pass',
          },
        } as IdeaCardCreate);
      }

      ctx.data.gatedIdeas = gatedIdeas;
      ctx.data.gateStats = gateStats;

      console.log('[run_gates] Gate results:');
      for (const [gate, stats] of Object.entries(gateStats)) {
        console.log(`  ${gate}: ${stats.passed} passed, ${stats.failed} failed`);
      }
      console.log(`[run_gates] ${gatedIdeas.length}/${ctx.data.rawIdeas.length} ideas passed all gates`);
    },
  };
}

// Gate helper functions
function checkGate0DataSufficiency(idea: IdeaCardCreate): boolean {
  const config = GATES.gate_0_data_sufficiency;
  
  if (!idea.one_sentence_hypothesis || idea.one_sentence_hypothesis.length < config.min_hypothesis_length) return false;
  if (!idea.mechanism || idea.mechanism.length < config.min_mechanism_length) return false;
  if (!idea.signposts || idea.signposts.length < config.min_signposts) return false;
  if (!idea.catalysts || idea.catalysts.length < config.min_catalysts) return false;
  
  // Check required metrics
  for (const metric of config.required_metrics) {
    if (!idea.quick_metrics?.[metric as keyof typeof idea.quick_metrics]) return false;
  }
  
  return true;
}

function checkGate1Coherence(idea: IdeaCardCreate): boolean {
  const config = GATES.gate_1_coherence;
  const hypothesisLength = idea.one_sentence_hypothesis?.length || 0;
  const mechanismLength = idea.mechanism?.length || 0;
  
  return mechanismLength >= hypothesisLength * config.mechanism_hypothesis_ratio;
}

function checkGate2EdgeClaim(idea: IdeaCardCreate): boolean {
  const config = GATES.gate_2_edge_claim;
  
  if (!idea.edge_type || idea.edge_type.length === 0) return false;
  return idea.edge_type.every(e => config.valid_edge_types.includes(e as any));
}

function checkGate3DownsideShape(idea: IdeaCardCreate): boolean {
  const config = GATES.gate_3_downside_shape;
  const metrics = idea.quick_metrics;
  
  if (!metrics) return false;
  
  const netDebtToEbitda = metrics.net_debt_to_ebitda;
  if (netDebtToEbitda !== undefined && netDebtToEbitda !== null) {
    const maxAllowed = idea.style_tag === 'cigar_butt'
      ? config.cigar_butt_max_net_debt_to_ebitda
      : config.max_net_debt_to_ebitda;
    
    if (netDebtToEbitda > maxAllowed) return false;
  }
  
  const currentRatio = metrics.current_ratio;
  if (currentRatio !== undefined && currentRatio !== null && currentRatio < 0.5) {
    return false;
  }
  
  return true;
}

function checkGate4StyleFit(idea: IdeaCardCreate): boolean {
  const config = GATES.gate_4_style_fit;
  const metrics = idea.quick_metrics;
  
  if (!metrics || !idea.style_tag) return false;
  
  switch (idea.style_tag) {
    case 'quality_compounder': {
      const styleConfig = config.quality_compounder;
      if (metrics.ebit_margin !== undefined && metrics.ebit_margin < styleConfig.min_ebit_margin) return false;
      if (metrics.roic !== undefined && metrics.roic < styleConfig.min_roic) return false;
      break;
    }
    case 'garp': {
      const styleConfig = config.garp;
      if (metrics.pe !== undefined && metrics.pe > styleConfig.max_pe) return false;
      if (metrics.ev_to_ebitda !== undefined && metrics.ev_to_ebitda > styleConfig.max_ev_to_ebitda) return false;
      break;
    }
    case 'cigar_butt': {
      const styleConfig = config.cigar_butt;
      if (metrics.ev_to_ebitda !== undefined && metrics.ev_to_ebitda > styleConfig.max_ev_to_ebitda) return false;
      if (metrics.price_to_book !== undefined && metrics.price_to_book > styleConfig.max_price_to_book) return false;
      break;
    }
  }
  
  return true;
}

// ============================================================================
// NODE 5: SCORE AND RANK
// ============================================================================

function createScoreAndRankNode(): DAGNode {
  return {
    id: 'score_and_rank',
    name: 'Score and Rank',
    dependencies: ['run_gates'],
    timeout: 60000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContextV2;
      console.log('[score_and_rank] Scoring ideas...');

      const scoredIdeas = ctx.data.gatedIdeas.map((idea) => {
        const score = calculateScore(idea);
        const noveltyScore = parseFloat(idea.novelty_score ?? '0');
        
        // Calculate rank score with novelty weight
        const normalizedNovelty = (noveltyScore / 60) * 100;
        const noveltyWeight = 0.45;
        const fundamentalWeight = 1 - noveltyWeight;
        const rankScore = (score.total * fundamentalWeight) + (normalizedNovelty * noveltyWeight);

        return {
          ...idea,
          score,
          rank_score: rankScore.toFixed(6),
        } as IdeaCardCreate;
      });

      scoredIdeas.sort((a, b) => parseFloat(b.rank_score ?? '0') - parseFloat(a.rank_score ?? '0'));

      ctx.data.scoredIdeas = scoredIdeas;
      console.log(`[score_and_rank] Scored ${scoredIdeas.length} ideas`);
    },
  };
}

function calculateScore(idea: IdeaCardCreate): {
  total: number;
  edge_clarity: number;
  business_quality_prior: number;
  financial_resilience_prior: number;
  valuation_tension: number;
  catalyst_clarity: number;
  information_availability: number;
  complexity_penalty: number;
  disclosure_friction_penalty: number;
} {
  const metrics = idea.quick_metrics;

  // Edge clarity (0-20)
  const edgeClarity = Math.min(
    (idea.edge_type?.length ?? 0) * 5 + (idea.mechanism?.length ?? 0 > 200 ? 10 : 5),
    20
  );

  // Business quality prior (0-15)
  let businessQuality = 7;
  if (metrics?.ebit_margin && metrics.ebit_margin > 0.2) businessQuality += 4;
  if (metrics?.revenue_cagr_3y && metrics.revenue_cagr_3y > 0.1) businessQuality += 4;

  // Financial resilience prior (0-15)
  let financialResilience = 7;
  if (metrics?.net_debt_to_ebitda && metrics.net_debt_to_ebitda < 2) financialResilience += 4;
  if (metrics?.fcf_yield && metrics.fcf_yield > 0.05) financialResilience += 4;

  // Valuation tension (0-15)
  let valuationTension = 7;
  if (metrics?.ev_to_ebitda && metrics.ev_to_ebitda < 10) valuationTension += 4;
  if (metrics?.pe && metrics.pe < 20) valuationTension += 4;

  // Catalyst clarity (0-10)
  const catalystClarity = Math.min((idea.catalysts?.length ?? 0) * 3, 10);

  // Information availability (0-10)
  const infoAvailability = Math.min((idea.evidence_refs?.length ?? 0) * 2, 10);

  // Complexity penalty (0-10)
  const complexityPenalty = idea.mechanism?.length ?? 0 > 1000 ? 3 : 0;

  // Disclosure friction penalty (0-5)
  const disclosurePenalty = 0;

  const total =
    edgeClarity + businessQuality + financialResilience + valuationTension +
    catalystClarity + infoAvailability - complexityPenalty - disclosurePenalty;

  return {
    total: Math.max(0, Math.min(100, total)),
    edge_clarity: edgeClarity,
    business_quality_prior: businessQuality,
    financial_resilience_prior: financialResilience,
    valuation_tension: valuationTension,
    catalyst_clarity: catalystClarity,
    information_availability: infoAvailability,
    complexity_penalty: complexityPenalty,
    disclosure_friction_penalty: disclosurePenalty,
  };
}

// ============================================================================
// NODE 6: STYLE MIX ADJUST
// ============================================================================

function createStyleMixAdjustNode(): DAGNode {
  return {
    id: 'style_mix_adjust',
    name: 'Style Mix Adjust',
    dependencies: ['score_and_rank'],
    timeout: 30000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContextV2;
      console.log('[style_mix_adjust] Adjusting for style mix...');

      const adjustments = await styleMixStateRepository.getThresholdAdjustments();

      const styleMixAdjustedIdeas = ctx.data.scoredIdeas.map((idea) => {
        const styleTag = idea.style_tag as keyof typeof adjustments;
        const adjustment = adjustments[styleTag] ?? 0;

        if (adjustment > 0) {
          const currentRank = parseFloat(idea.rank_score ?? '0');
          const adjustedRank = currentRank * (1 - adjustment / 100);
          return { ...idea, rank_score: adjustedRank.toFixed(6) } as IdeaCardCreate;
        }

        return idea;
      });

      styleMixAdjustedIdeas.sort((a, b) => parseFloat(b.rank_score ?? '0') - parseFloat(a.rank_score ?? '0'));

      ctx.data.styleMixAdjustedIdeas = styleMixAdjustedIdeas;
      console.log(`[style_mix_adjust] Adjusted ${styleMixAdjustedIdeas.length} ideas for style mix`);
    },
  };
}

// ============================================================================
// NODE 7: SELECT TOP N
// ============================================================================

function createSelectTopNNode(): DAGNode {
  return {
    id: 'select_top_n',
    name: 'Select Top N',
    dependencies: ['style_mix_adjust'],
    timeout: 10000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContextV2;
      console.log('[select_top_n] Selecting top ideas...');

      ctx.data.selectedIdeas = ctx.data.styleMixAdjustedIdeas.slice(0, LANE_A_DAILY_LIMIT);
      console.log(`[select_top_n] Selected ${ctx.data.selectedIdeas.length} ideas for inbox`);
    },
  };
}

// ============================================================================
// NODE 8: PERSIST INBOX (IMMUTABLE VERSIONS)
// ============================================================================

function createPersistInboxNode(): DAGNode {
  return {
    id: 'persist_inbox',
    name: 'Persist Inbox',
    dependencies: ['select_top_n'],
    timeout: 60000,
    retries: 2,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContextV2;
      console.log('[persist_inbox] Persisting ideas to database (immutable versions)...');

      const persistedIdeas: IdeaCard[] = [];

      for (const idea of ctx.data.selectedIdeas) {
        try {
          // Check for existing idea with same ticker
          const existing = await ideasRepository.getLatestByTicker(idea.ticker);
          
          // Create new version (never overwrite)
          const version = existing ? existing.version + 1 : 1;

          const newIdea: NewIdea = {
            ticker: idea.ticker,
            asOf: ctx.data.asOf,
            styleTag: idea.style_tag as StyleTag,
            oneSentenceHypothesis: idea.one_sentence_hypothesis,
            mechanism: idea.mechanism,
            timeHorizon: idea.time_horizon,
            edgeType: idea.edge_type,
            quickMetrics: idea.quick_metrics,
            catalysts: idea.catalysts,
            signposts: idea.signposts,
            gateResults: idea.gate_results,
            score: idea.score,
            noveltyScore: idea.novelty_score,
            repetitionPenalty: idea.repetition_penalty,
            rankScore: idea.rank_score,
            status: 'new',
            nextAction: 'monitor',
            version,
            whatsNewSinceLastTime: idea.whats_new_since_last_time,
            rejectionShadow: idea.rejection_shadow,
          };

          const persisted = await ideasRepository.create(newIdea);
          persistedIdeas.push(persisted as IdeaCard);

          // Update novelty state
          await noveltyStateRepository.upsert({
            ticker: idea.ticker,
            lastSeen: new Date(),
            lastEdgeTypes: idea.edge_type,
            lastStyleTag: idea.style_tag,
            seenCount: (existing?.seenCount ?? 0) + 1,
          });
        } catch (error) {
          console.error(`[persist_inbox] Failed to persist ${idea.ticker}:`, error);
        }
      }

      ctx.data.persistedIdeas = persistedIdeas;
      console.log(`[persist_inbox] Persisted ${persistedIdeas.length} ideas`);
    },
  };
}

// ============================================================================
// NODE 9: NOTIFY USER
// ============================================================================

function createNotifyUserNode(): DAGNode {
  return {
    id: 'notify_user',
    name: 'Notify User',
    dependencies: ['persist_inbox'],
    timeout: 30000,
    retries: 2,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContextV2;
      console.log('[notify_user] Preparing notification...');

      const summary = {
        date: ctx.data.asOf,
        timezone: SYSTEM_TIMEZONE,
        universeFetched: ctx.data.universe.length,
        noveltyShortlist: ctx.data.noveltyShortlist.length,
        ideasGenerated: ctx.data.rawIdeas.length,
        ideasPassedGates: ctx.data.gatedIdeas.length,
        ideasSelected: ctx.data.selectedIdeas.length,
        ideasPersisted: ctx.data.persistedIdeas.length,
        gateStats: ctx.data.gateStats,
        byStyle: {
          quality_compounder: ctx.data.persistedIdeas.filter(i => i.styleTag === 'quality_compounder').length,
          garp: ctx.data.persistedIdeas.filter(i => i.styleTag === 'garp').length,
          cigar_butt: ctx.data.persistedIdeas.filter(i => i.styleTag === 'cigar_butt').length,
        },
        topIdeas: ctx.data.persistedIdeas.slice(0, 5).map(i => ({
          ticker: i.ticker,
          hypothesis: i.oneSentenceHypothesis?.substring(0, 100),
          noveltyScore: i.noveltyScore,
          rankScore: i.rankScore,
        })),
      };

      console.log('[notify_user] Daily Discovery Summary:', JSON.stringify(summary, null, 2));

      // TODO: Send email notification
      // TODO: Send WhatsApp notification via webhook
    },
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function createDailyDiscoveryDAGV2(): DAGRunner {
  const aggregator = createDataAggregator();
  const llmClient = createResilientClient();
  const dag = createDAGRunner('daily_discovery_v2');

  dag.addNodes([
    createFetchUniverseNode(aggregator),
    createComputeNoveltyShortlistNode(),
    createGenerateIdeasNode(aggregator, llmClient),
    createRunGatesNode(),
    createScoreAndRankNode(),
    createStyleMixAdjustNode(),
    createSelectTopNNode(),
    createPersistInboxNode(),
    createNotifyUserNode(),
  ]);

  return dag;
}

export async function runDailyDiscoveryV2(): Promise<void> {
  // Check if weekday (Mon-Fri)
  const now = new Date();
  const dayOfWeek = now.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log('[daily_discovery_v2] Skipping - not a weekday');
    return;
  }

  // Check idempotency
  const alreadyRan = await runsRepository.existsForToday('daily_discovery');
  if (alreadyRan) {
    console.log('[daily_discovery_v2] Already ran today, skipping');
    return;
  }

  const run = await runsRepository.create({
    runType: 'daily_discovery',
    status: 'running',
  });

  try {
    const dag = createDailyDiscoveryDAGV2();
    const result = await dag.run();

    await runsRepository.updateStatus(
      run.runId,
      result.status === 'completed' ? 'completed' : 'failed',
      result.errors.length > 0 ? JSON.stringify(result.errors) : undefined
    );

    await runsRepository.updatePayload(run.runId, {
      completedNodes: result.completedNodes,
      failedNodes: result.failedNodes,
      durationMs: result.durationMs,
    });
  } catch (error) {
    await runsRepository.updateStatus(run.runId, 'failed', (error as Error).message);
    throw error;
  }
}
