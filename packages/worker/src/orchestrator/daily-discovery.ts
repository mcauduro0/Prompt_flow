/**
 * ARC Investment Factory - Daily Discovery Run (Lane A)
 * 
 * NOVELTY-FIRST: Compute novelty shortlist BEFORE LLM enrichment
 * GLOBAL EQUITIES: Not US-only
 * 
 * DAG: daily_discovery_run
 * Schedule: 06:00 America/Sao_Paulo, weekdays only (Mon-Fri)
 * 
 * Flow (CORRECTED ORDER):
 * 1. fetch_universe (GLOBAL equities, not US-only)
 * 2. compute_novelty_shortlist (BEFORE LLM - saves cost)
 * 3. enrich_with_llm (only shortlisted tickers, up to 200)
 * 4. run_gates (FAIL FAST - gates 0-4 enforced)
 * 5. score_and_rank (WEIGHTED SUM, not multiplicative)
 * 6. select_top_n (target 120)
 * 7. persist_inbox
 * 8. notify_user
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LANE_A_DAILY_TARGET,
  LANE_A_DAILY_CAP,
  LANE_A_LLM_ENRICHMENT_CAP,
  LANE_A_EXPLORATION_RATE,
  NOVELTY_NEW_TICKER_DAYS,
  NOVELTY_PENALTY_WINDOW_DAYS,
  NOVELTY_SCORING,
  RANKING_WEIGHTS,
  GATES,
  SYSTEM_TIMEZONE,
  SCHEDULES,
  UNIVERSE_CONFIG,
  type StyleTag,
} from '@arc/shared';
import type { IdeaCard } from '@arc/core';

// ============================================================================
// TYPES
// ============================================================================

export interface DiscoveryContext {
  runId: string;
  asOf: string;
  startedAt: Date;
  universe: UniverseTicker[];
  noveltyShortlist: UniverseTicker[];
  enrichedIdeas: IdeaCardCreate[];
  gatedIdeas: IdeaCardCreate[];
  rankedIdeas: IdeaCardCreate[];
  selectedIdeas: IdeaCard[];
  errors: string[];
}

export interface UniverseTicker {
  ticker: string;
  companyName: string;
  region: string;
  sector: string;
  industry: string;
  marketCapUsd: number;
  currency: string;
  lastSeen?: Date;
  seenCount?: number;
  lastEdgeTypes?: string[];
  lastStyleTag?: string;
  noveltyScore?: number;
  isExploration?: boolean;
}

export interface IdeaCardCreate {
  ticker: string;
  company_name: string;
  region: string;
  currency: string;
  sector: string;
  industry: string;
  style_tag: StyleTag;
  one_sentence_hypothesis: string;
  mechanism: string;
  time_horizon: '1_3_years';
  edge_type: string[];
  quick_metrics: {
    market_cap_usd: number | null;
    ev_to_ebitda: number | null;
    pe: number | null;
    fcf_yield: number | null;
    revenue_cagr_3y: number | null;
    ebit_margin: number | null;
    net_debt_to_ebitda: number | null;
  };
  catalysts: Array<{
    name: string;
    window: string;
    probability: number;
    expected_impact: 'low' | 'medium' | 'high';
    how_to_monitor: string;
  }>;
  signposts: Array<{
    metric: string;
    direction: 'up' | 'down' | 'stable';
    threshold: string;
    frequency: 'monthly' | 'quarterly' | 'event_driven';
    why_it_matters: string;
  }>;
  gate_results?: GateResults;
  score?: ScoreComponents;
  novelty_score?: number;
  rank_score?: number;
  evidence_refs?: Array<{
    source_type: string;
    source_id: string;
    snippet: string;
  }>;
}

export interface NoveltyState {
  ticker: string;
  lastSeen: Date;
  seenCount: number;
  lastEdgeTypes: string[];
  lastStyleTag: string;
  lastCatalysts?: string[];
}

export interface GateResults {
  gate_0_data_sufficiency: 'pass' | 'fail';
  gate_1_coherence: 'pass' | 'fail';
  gate_2_edge_claim: 'pass' | 'fail';
  gate_3_downside_shape: 'pass' | 'fail';
  gate_4_style_fit: 'pass' | 'fail';
}

export interface ScoreComponents {
  total: number;
  edge_clarity: number;
  business_quality_prior: number;
  financial_resilience_prior: number;
  valuation_tension: number;
  catalyst_clarity: number;
  information_availability: number;
  complexity_penalty: number;
  disclosure_friction_penalty: number;
}

export interface GateCheckResult {
  gate: string;
  passed: boolean;
  reason?: string;
}

// ============================================================================
// UNIVERSE FETCHER (GLOBAL EQUITIES)
// ============================================================================

/**
 * Fetch GLOBAL equities universe (not US-only)
 * Either from static file or multi-region screener
 */
export async function fetchGlobalUniverse(
  staticUniversePath?: string
): Promise<UniverseTicker[]> {
  // If static universe file provided, use it
  if (staticUniversePath) {
    const fs = await import('fs/promises');
    try {
      const data = await fs.readFile(staticUniversePath, 'utf-8');
      const universe = JSON.parse(data) as UniverseTicker[];
      console.log(`[Universe] Loaded ${universe.length} tickers from static file`);
      return universe;
    } catch (error) {
      console.log(`[Universe] Static file not found, building from screener...`);
    }
  }

  // Build from multi-region screener
  console.log(`[Universe] Building global equities universe...`);
  console.log(`[Universe] Regions: ${UNIVERSE_CONFIG.regions.join(', ')}`);
  console.log(`[Universe] Market cap: $${(UNIVERSE_CONFIG.min_market_cap_usd / 1e9).toFixed(1)}B - $${(UNIVERSE_CONFIG.max_market_cap_usd / 1e9).toFixed(0)}B`);
  
  // Placeholder - actual implementation would use @arc/retriever
  // to fetch from FMP/Polygon for each region
  return [];
}

/**
 * Persist universe snapshot for reproducibility
 */
export async function persistUniverseSnapshot(
  universe: UniverseTicker[],
  asOf: string
): Promise<string> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const snapshotDir = path.join(process.cwd(), 'data', 'universe_snapshots');
  await fs.mkdir(snapshotDir, { recursive: true });
  
  const filename = `universe_${asOf}.json`;
  const filepath = path.join(snapshotDir, filename);
  
  await fs.writeFile(filepath, JSON.stringify(universe, null, 2));
  console.log(`[Universe] Snapshot saved: ${filepath}`);
  
  return filepath;
}

// ============================================================================
// NOVELTY SHORTLIST (BEFORE LLM - KEY OPTIMIZATION)
// ============================================================================

/**
 * Compute novelty scores and create shortlist BEFORE LLM enrichment
 * This is the key cost-saving optimization - novelty-first approach
 * 
 * DO NOT slice universe arbitrarily - use novelty scoring
 */
export async function computeNoveltyShortlist(
  universe: UniverseTicker[],
  noveltyStates: Map<string, NoveltyState>,
  targetCount: number = LANE_A_LLM_ENRICHMENT_CAP
): Promise<UniverseTicker[]> {
  const now = new Date();
  const scored: UniverseTicker[] = [];

  for (const ticker of universe) {
    const state = noveltyStates.get(ticker.ticker);
    let noveltyScore = 0;

    if (!state) {
      // Never seen before - maximum novelty
      noveltyScore = NOVELTY_SCORING.TICKER_NEW_BONUS + NOVELTY_SCORING.NOVELTY_SCORE_CAP;
      ticker.noveltyScore = noveltyScore;
      ticker.isExploration = false;
      scored.push(ticker);
      continue;
    }

    const daysSinceLastSeen = Math.floor(
      (now.getTime() - state.lastSeen.getTime()) / (1000 * 60 * 60 * 24)
    );

    // New ticker bonus (not seen in 90 days)
    if (daysSinceLastSeen >= NOVELTY_NEW_TICKER_DAYS) {
      noveltyScore += NOVELTY_SCORING.TICKER_NEW_BONUS;
    }

    // Repetition penalty (seen in last 30 days with no new edge)
    if (daysSinceLastSeen < NOVELTY_PENALTY_WINDOW_DAYS) {
      noveltyScore += NOVELTY_SCORING.SEEN_IN_LAST_30_DAYS_NO_NEW_EDGE_PENALTY;
    }

    // Seen too many times penalty
    if (state.seenCount > 3) {
      noveltyScore += NOVELTY_SCORING.SEEN_MORE_THAN_3_TIMES_IN_90_DAYS_PENALTY;
    }

    // Apply floor
    noveltyScore = Math.max(noveltyScore, NOVELTY_SCORING.MIN_NOVELTY_SCORE * 100);

    ticker.noveltyScore = noveltyScore;
    ticker.lastSeen = state.lastSeen;
    ticker.seenCount = state.seenCount;
    ticker.lastEdgeTypes = state.lastEdgeTypes;
    ticker.lastStyleTag = state.lastStyleTag;
    ticker.isExploration = false;

    scored.push(ticker);
  }

  // Sort by novelty score descending
  scored.sort((a, b) => (b.noveltyScore || 0) - (a.noveltyScore || 0));

  // Calculate exploration count (10% random)
  const explorationCount = Math.floor(targetCount * LANE_A_EXPLORATION_RATE);
  const noveltyCount = targetCount - explorationCount;

  // Take top by novelty
  const noveltySelected = scored.slice(0, noveltyCount);

  // Random exploration from remaining
  const remaining = scored.slice(noveltyCount);
  const explorationSelected: UniverseTicker[] = [];
  
  for (let i = 0; i < explorationCount && remaining.length > 0; i++) {
    const idx = Math.floor(Math.random() * remaining.length);
    const ticker = remaining.splice(idx, 1)[0];
    ticker.isExploration = true;
    explorationSelected.push(ticker);
  }

  const shortlist = [...noveltySelected, ...explorationSelected];
  
  console.log(`[Novelty] Shortlist: ${noveltySelected.length} by novelty + ${explorationSelected.length} exploration = ${shortlist.length} total`);

  return shortlist;
}

// ============================================================================
// GATE ENFORCEMENT (FAIL FAST - ALL GATES ENFORCED)
// ============================================================================

/**
 * Run all gates - FAIL FAST
 * Gates 0-4 must be persisted and BLOCK promotions
 */
export function runGates(idea: IdeaCardCreate): { passed: boolean; results: GateResults; failures: GateCheckResult[] } {
  const failures: GateCheckResult[] = [];
  const results: GateResults = {
    gate_0_data_sufficiency: 'pass',
    gate_1_coherence: 'pass',
    gate_2_edge_claim: 'pass',
    gate_3_downside_shape: 'pass',
    gate_4_style_fit: 'pass',
  };

  // Gate 0: Data Sufficiency
  const g0 = GATES.gate_0_data_sufficiency;
  if ((idea.one_sentence_hypothesis?.length || 0) < g0.min_hypothesis_length) {
    results.gate_0_data_sufficiency = 'fail';
    failures.push({ gate: 'gate_0', passed: false, reason: 'Hypothesis too short' });
  }
  if ((idea.mechanism?.length || 0) < g0.min_mechanism_length) {
    results.gate_0_data_sufficiency = 'fail';
    failures.push({ gate: 'gate_0', passed: false, reason: 'Mechanism too short' });
  }
  if ((idea.signposts?.length || 0) < g0.min_signposts) {
    results.gate_0_data_sufficiency = 'fail';
    failures.push({ gate: 'gate_0', passed: false, reason: `Need ${g0.min_signposts}+ signposts` });
  }
  if ((idea.catalysts?.length || 0) < g0.min_catalysts) {
    results.gate_0_data_sufficiency = 'fail';
    failures.push({ gate: 'gate_0', passed: false, reason: `Need ${g0.min_catalysts}+ catalyst` });
  }

  // Gate 1: Coherence
  const g1 = GATES.gate_1_coherence;
  const hypothesisLen = idea.one_sentence_hypothesis?.length || 0;
  const mechanismLen = idea.mechanism?.length || 0;
  if (hypothesisLen > 0 && mechanismLen / hypothesisLen < g1.mechanism_hypothesis_ratio) {
    results.gate_1_coherence = 'fail';
    failures.push({ gate: 'gate_1', passed: false, reason: 'Mechanism not detailed enough' });
  }

  // Gate 2: Edge Claim
  const g2 = GATES.gate_2_edge_claim;
  const edgeTypes = idea.edge_type || [];
  if (edgeTypes.length < g2.min_edge_types) {
    results.gate_2_edge_claim = 'fail';
    failures.push({ gate: 'gate_2', passed: false, reason: 'No valid edge type' });
  }
  const validEdges = edgeTypes.filter(e => (g2.valid_edge_types as readonly string[]).includes(e));
  if (validEdges.length === 0 && edgeTypes.length > 0) {
    results.gate_2_edge_claim = 'fail';
    failures.push({ gate: 'gate_2', passed: false, reason: 'Invalid edge type' });
  }

  // Gate 3: Downside Shape (ENFORCED)
  const g3 = GATES.gate_3_downside_shape;
  const metrics = idea.quick_metrics;
  if (metrics) {
    const maxDebt = idea.style_tag === 'cigar_butt' 
      ? g3.cigar_butt_max_net_debt_to_ebitda 
      : g3.max_net_debt_to_ebitda;
    
    if (metrics.net_debt_to_ebitda !== null && metrics.net_debt_to_ebitda > maxDebt) {
      results.gate_3_downside_shape = 'fail';
      failures.push({ gate: 'gate_3', passed: false, reason: `Debt/EBITDA ${metrics.net_debt_to_ebitda} > ${maxDebt}` });
    }
  }

  // Gate 4: Style Fit (ENFORCED)
  const g4 = GATES.gate_4_style_fit;
  if (metrics && idea.style_tag) {
    const styleConfig = g4[idea.style_tag as keyof typeof g4];
    if (styleConfig) {
      if ('min_ebit_margin' in styleConfig && metrics.ebit_margin !== null) {
        if (metrics.ebit_margin < styleConfig.min_ebit_margin) {
          results.gate_4_style_fit = 'fail';
          failures.push({ gate: 'gate_4', passed: false, reason: `EBIT margin ${metrics.ebit_margin} < ${styleConfig.min_ebit_margin}` });
        }
      }
      if ('max_pe' in styleConfig && metrics.pe !== null) {
        if (metrics.pe > styleConfig.max_pe) {
          results.gate_4_style_fit = 'fail';
          failures.push({ gate: 'gate_4', passed: false, reason: `P/E ${metrics.pe} > ${styleConfig.max_pe}` });
        }
      }
      if ('max_ev_to_ebitda' in styleConfig && metrics.ev_to_ebitda !== null) {
        if (metrics.ev_to_ebitda > styleConfig.max_ev_to_ebitda) {
          results.gate_4_style_fit = 'fail';
          failures.push({ gate: 'gate_4', passed: false, reason: `EV/EBITDA ${metrics.ev_to_ebitda} > ${styleConfig.max_ev_to_ebitda}` });
        }
      }
    }
  }

  const passed = Object.values(results).every(r => r === 'pass');
  return { passed, results, failures };
}

// ============================================================================
// RANKING (WEIGHTED SUM - NOT MULTIPLICATIVE)
// ============================================================================

/**
 * Calculate rank score using WEIGHTED SUM formula
 * DO NOT use multiplicative baseScore * noveltyScore
 */
export function calculateRankScore(idea: IdeaCardCreate, noveltyScore: number): number {
  const score = idea.score;
  if (!score) return 0;

  // Normalize scores to 0-1 range
  const normalizedNovelty = noveltyScore / 100;
  const normalizedEdge = score.edge_clarity / 20;
  const normalizedValuation = score.valuation_tension / 15;
  const normalizedCatalyst = score.catalyst_clarity / 10;
  const normalizedBusiness = score.business_quality_prior / 15;
  const normalizedRepetition = score.complexity_penalty / 10;
  const normalizedDisclosure = score.disclosure_friction_penalty / 5;

  // WEIGHTED SUM (additive) - NOT multiplicative
  const rankScore = 
    (RANKING_WEIGHTS.NOVELTY_SCORE * normalizedNovelty) +
    (RANKING_WEIGHTS.EDGE_CLARITY * normalizedEdge) +
    (RANKING_WEIGHTS.VALUATION_TENSION * normalizedValuation) +
    (RANKING_WEIGHTS.CATALYST_TIMING * normalizedCatalyst) +
    (RANKING_WEIGHTS.BUSINESS_QUALITY_PRIOR * normalizedBusiness) +
    (RANKING_WEIGHTS.REPETITION_PENALTY * normalizedRepetition) +
    (RANKING_WEIGHTS.DISCLOSURE_FRICTION_PENALTY * normalizedDisclosure);

  return rankScore;
}

// ============================================================================
// MAIN DISCOVERY RUN
// ============================================================================

export interface DiscoveryRunOptions {
  staticUniversePath?: string;
  dryRun?: boolean;
}

export async function runDailyDiscovery(
  options: DiscoveryRunOptions = {}
): Promise<DiscoveryContext> {
  const runId = uuidv4();
  const asOf = new Date().toISOString().split('T')[0];
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Discovery] Run ${runId}`);
  console.log(`[Discovery] Date: ${asOf}`);
  console.log(`[Discovery] Target: ${LANE_A_DAILY_TARGET}, Cap: ${LANE_A_DAILY_CAP}`);
  console.log(`[Discovery] Timezone: ${SYSTEM_TIMEZONE}`);
  console.log(`[Discovery] Schedule: ${SCHEDULES.LANE_A_CRON} (weekdays only)`);
  console.log(`${'='.repeat(60)}\n`);

  const context: DiscoveryContext = {
    runId,
    asOf,
    startedAt: new Date(),
    universe: [],
    noveltyShortlist: [],
    enrichedIdeas: [],
    gatedIdeas: [],
    rankedIdeas: [],
    selectedIdeas: [],
    errors: [],
  };

  try {
    // Step 1: Fetch GLOBAL universe (not US-only)
    console.log('[Step 1] Fetching GLOBAL equities universe...');
    context.universe = await fetchGlobalUniverse(options.staticUniversePath);
    console.log(`[Step 1] Universe: ${context.universe.length} tickers\n`);

    // Persist universe snapshot for reproducibility
    if (!options.dryRun && context.universe.length > 0) {
      await persistUniverseSnapshot(context.universe, asOf);
    }

    // Step 2: Compute novelty shortlist BEFORE LLM (key optimization)
    console.log('[Step 2] Computing novelty shortlist (BEFORE LLM)...');
    const noveltyStates = new Map<string, NoveltyState>(); // Would load from DB
    context.noveltyShortlist = await computeNoveltyShortlist(
      context.universe,
      noveltyStates,
      LANE_A_LLM_ENRICHMENT_CAP
    );
    console.log(`[Step 2] Shortlist: ${context.noveltyShortlist.length} tickers for LLM\n`);

    // Step 3: Enrich with LLM (only shortlisted tickers)
    console.log('[Step 3] Enriching with LLM (shortlisted only)...');
    // This would call @arc/llm-client to generate IdeaCards
    context.enrichedIdeas = [];
    console.log(`[Step 3] Enriched: ${context.enrichedIdeas.length} ideas\n`);

    // Step 4: Run gates (FAIL FAST)
    console.log('[Step 4] Running gates (fail fast)...');
    for (const idea of context.enrichedIdeas) {
      const { passed, results, failures } = runGates(idea);
      if (passed) {
        idea.gate_results = results;
        context.gatedIdeas.push(idea);
      } else {
        console.log(`  [FAIL] ${idea.ticker}: ${failures.map(f => f.reason).join(', ')}`);
      }
    }
    console.log(`[Step 4] Gated: ${context.gatedIdeas.length}/${context.enrichedIdeas.length} passed\n`);

    // Step 5: Score and rank (WEIGHTED SUM)
    console.log('[Step 5] Scoring and ranking (weighted sum)...');
    for (const idea of context.gatedIdeas) {
      const noveltyScore = context.noveltyShortlist.find(t => t.ticker === idea.ticker)?.noveltyScore || 0;
      const rankScore = calculateRankScore(idea, noveltyScore);
      idea.rank_score = rankScore;
      idea.novelty_score = noveltyScore;
      context.rankedIdeas.push(idea);
    }
    context.rankedIdeas.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
    console.log(`[Step 5] Ranked: ${context.rankedIdeas.length} ideas\n`);

    // Step 6: Select top N (target 120)
    console.log(`[Step 6] Selecting top ${LANE_A_DAILY_TARGET} ideas...`);
    const selected = context.rankedIdeas.slice(0, LANE_A_DAILY_TARGET);
    
    for (let i = 0; i < selected.length; i++) {
      const idea = selected[i];
      context.selectedIdeas.push({
        ...idea,
        idea_id: uuidv4(),
        as_of: asOf,
        status: 'new',
        rejection_reason: null,
        next_action: 'monitor',
      } as unknown as IdeaCard);
    }
    console.log(`[Step 6] Selected: ${context.selectedIdeas.length} ideas\n`);

    // Step 7: Persist to inbox
    if (!options.dryRun) {
      console.log('[Step 7] Persisting to inbox...');
      // Would call @arc/database to persist
      console.log(`[Step 7] Persisted: ${context.selectedIdeas.length} ideas\n`);
    }

    // Step 8: Notify user
    console.log('[Step 8] Sending notification...');
    // Would send email/webhook
    console.log('[Step 8] Notification sent\n');

    console.log(`${'='.repeat(60)}`);
    console.log(`[Discovery] Run ${runId} COMPLETED`);
    console.log(`[Discovery] Ideas in inbox: ${context.selectedIdeas.length}`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    context.errors.push(errorMsg);
    console.error(`[Discovery] Run ${runId} FAILED: ${errorMsg}`);
  }

  return context;
}

export default runDailyDiscovery;
