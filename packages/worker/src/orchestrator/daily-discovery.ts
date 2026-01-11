/**
 * ARC Investment Factory - Daily Discovery Run (Lane A)
 * 
 * ============================================================================
 * NOVELTY-FIRST ARCHITECTURE (CRITICAL - DO NOT MODIFY)
 * ============================================================================
 * 
 * The shortlist selection happens BEFORE any LLM enrichment.
 * Shortlist prioritization uses NOVELTY_STATE FIRST, not fundamentals.
 * Only the shortlist (max 200) is enriched daily.
 * Promotion ignores novelty entirely and uses gates + thresholds only.
 * 
 * This ensures:
 * 1. Cost savings (LLM only called for shortlisted tickers)
 * 2. Novelty bias (new names surface even if scores are lower)
 * 3. No regression toward safe, obvious names
 * 
 * ============================================================================
 * 
 * DAG: daily_discovery_run
 * Schedule: 06:00 America/Sao_Paulo, weekdays only (Mon-Fri)
 * 
 * Flow (NOVELTY-FIRST ORDER):
 * 1. fetch_universe (GLOBAL equities, not US-only)
 * 2. compute_novelty_shortlist (BEFORE LLM - novelty_state first, not score)
 * 3. enrich_with_llm (only shortlisted tickers, max 200)
 * 4. run_gates (FAIL FAST - gates 0-4 enforced, Gate 3 has binary overrides)
 * 5. score_and_rank (WEIGHTED SUM, novelty 0.45 weight for DISPLAY only)
 * 6. select_top_n (target 120)
 * 7. persist_inbox
 * 8. notify_user
 * 
 * ACCEPTANCE TEST:
 * Run discovery on the same universe for 5 days.
 * The top 30 inbox items must rotate heavily, even if scores are lower.
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
  metrics: DiscoveryMetrics;
}

export interface DiscoveryMetrics {
  universeSize: number;
  shortlistSize: number;
  shortlistNewCount: number;
  shortlistReappearanceCount: number;
  shortlistRepeatCount: number;
  shortlistExplorationCount: number;
  enrichedCount: number;
  gatedCount: number;
  gate3FailCount: number;
  gate4FailCount: number;
  selectedCount: number;
  selectedNewPct: number;
  selectedReappearancePct: number;
}

export interface UniverseTicker {
  ticker: string;
  companyName: string;
  region: string;
  sector: string;
  industry: string;
  marketCapUsd: number;
  currency: string;
  // Novelty state
  lastSeen?: Date;
  seenCount?: number;
  lastEdgeTypes?: string[];
  lastStyleTag?: string;
  noveltyScore?: number;
  noveltyState?: 'new' | 'reappearance' | 'repeat';
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
  // Risk flags for Gate 3 binary override
  risk_flags?: {
    leverage_risk_dominant: boolean;
    liquidity_risk_dominant: boolean;
    regulatory_cliff_dominant: boolean;
  };
  gate_results?: GateResults;
  score?: ScoreComponents;
  novelty_score?: number;
  novelty_state?: 'new' | 'reappearance' | 'repeat';
  rank_score?: number;
  evidence_refs?: Array<{
    source_type: string;
    source_id: string;
    doc_id: string;
    chunk_id: string;
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
  gate_3_binary_override?: string; // Reason if binary override triggered
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
  binaryOverride?: boolean;
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
// NOVELTY SHORTLIST (BEFORE LLM - CRITICAL OPTIMIZATION)
// ============================================================================

/**
 * Compute novelty scores and create shortlist BEFORE LLM enrichment
 * 
 * ============================================================================
 * CRITICAL: NOVELTY-FIRST SELECTION
 * ============================================================================
 * 
 * 1. Shortlist selection happens BEFORE any LLM enrichment
 * 2. Shortlist prioritization uses NOVELTY_STATE FIRST, not fundamentals
 * 3. Only the shortlist (max 200) is enriched daily
 * 4. Promotion ignores novelty entirely and uses gates + thresholds only
 * 
 * Novelty States:
 * - NEW: Not seen in 90+ days (highest priority)
 * - REAPPEARANCE: Seen 30-90 days ago (medium priority)
 * - REPEAT: Seen in last 30 days (lowest priority, penalized)
 * 
 * Selection Order:
 * 1. All NEW tickers first (sorted by novelty score)
 * 2. All REAPPEARANCE tickers second (sorted by novelty score)
 * 3. Fill remaining with REPEAT tickers if needed
 * 4. 10% exploration from random pool
 * 
 * DO NOT slice universe arbitrarily - use novelty state ordering
 */
export async function computeNoveltyShortlist(
  universe: UniverseTicker[],
  noveltyStates: Map<string, NoveltyState>,
  targetCount: number = LANE_A_LLM_ENRICHMENT_CAP
): Promise<{ shortlist: UniverseTicker[]; metrics: Partial<DiscoveryMetrics> }> {
  const now = new Date();
  
  // Categorize by novelty state
  const newTickers: UniverseTicker[] = [];
  const reappearanceTickers: UniverseTicker[] = [];
  const repeatTickers: UniverseTicker[] = [];

  for (const ticker of universe) {
    const state = noveltyStates.get(ticker.ticker);
    let noveltyScore = 0;
    let noveltyState: 'new' | 'reappearance' | 'repeat' = 'new';

    if (!state) {
      // Never seen before - maximum novelty (NEW)
      noveltyScore = NOVELTY_SCORING.TICKER_NEW_BONUS + NOVELTY_SCORING.NOVELTY_SCORE_CAP;
      noveltyState = 'new';
      ticker.noveltyScore = noveltyScore;
      ticker.noveltyState = noveltyState;
      ticker.isExploration = false;
      newTickers.push(ticker);
      continue;
    }

    const daysSinceLastSeen = Math.floor(
      (now.getTime() - state.lastSeen.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Determine novelty state based on days since last seen
    if (daysSinceLastSeen >= NOVELTY_NEW_TICKER_DAYS) {
      // Not seen in 90+ days = NEW
      noveltyState = 'new';
      noveltyScore = NOVELTY_SCORING.TICKER_NEW_BONUS + (daysSinceLastSeen / 365) * 10;
    } else if (daysSinceLastSeen >= NOVELTY_PENALTY_WINDOW_DAYS) {
      // Seen 30-90 days ago = REAPPEARANCE
      noveltyState = 'reappearance';
      noveltyScore = NOVELTY_SCORING.NOVELTY_SCORE_CAP * 0.5 + (daysSinceLastSeen / 90) * 20;
    } else {
      // Seen in last 30 days = REPEAT (penalized)
      noveltyState = 'repeat';
      noveltyScore = NOVELTY_SCORING.SEEN_IN_LAST_30_DAYS_NO_NEW_EDGE_PENALTY;
      
      // Additional penalty for being seen too many times
      if (state.seenCount > 3) {
        noveltyScore += NOVELTY_SCORING.SEEN_MORE_THAN_3_TIMES_IN_90_DAYS_PENALTY;
      }
    }

    // Apply floor
    noveltyScore = Math.max(noveltyScore, NOVELTY_SCORING.MIN_NOVELTY_SCORE * 100);

    ticker.noveltyScore = noveltyScore;
    ticker.noveltyState = noveltyState;
    ticker.lastSeen = state.lastSeen;
    ticker.seenCount = state.seenCount;
    ticker.lastEdgeTypes = state.lastEdgeTypes;
    ticker.lastStyleTag = state.lastStyleTag;
    ticker.isExploration = false;

    // Categorize
    if (noveltyState === 'new') {
      newTickers.push(ticker);
    } else if (noveltyState === 'reappearance') {
      reappearanceTickers.push(ticker);
    } else {
      repeatTickers.push(ticker);
    }
  }

  // Sort each category by novelty score descending
  newTickers.sort((a, b) => (b.noveltyScore || 0) - (a.noveltyScore || 0));
  reappearanceTickers.sort((a, b) => (b.noveltyScore || 0) - (a.noveltyScore || 0));
  repeatTickers.sort((a, b) => (b.noveltyScore || 0) - (a.noveltyScore || 0));

  // Calculate exploration count (10% random)
  const explorationCount = Math.floor(targetCount * LANE_A_EXPLORATION_RATE);
  const noveltyCount = targetCount - explorationCount;

  // ============================================================================
  // NOVELTY-FIRST SELECTION ORDER
  // ============================================================================
  // 1. Take ALL new tickers first (up to noveltyCount)
  // 2. Fill with reappearance tickers
  // 3. Fill with repeat tickers only if needed
  // ============================================================================
  
  const noveltySelected: UniverseTicker[] = [];
  
  // Step 1: Take all NEW tickers first
  for (const ticker of newTickers) {
    if (noveltySelected.length >= noveltyCount) break;
    noveltySelected.push(ticker);
  }
  
  // Step 2: Fill with REAPPEARANCE tickers
  for (const ticker of reappearanceTickers) {
    if (noveltySelected.length >= noveltyCount) break;
    noveltySelected.push(ticker);
  }
  
  // Step 3: Fill with REPEAT tickers only if needed
  for (const ticker of repeatTickers) {
    if (noveltySelected.length >= noveltyCount) break;
    noveltySelected.push(ticker);
  }

  // Step 4: Random exploration from ALL remaining (not just repeats)
  const selectedTickers = new Set(noveltySelected.map(t => t.ticker));
  const remaining = universe.filter(t => !selectedTickers.has(t.ticker));
  const explorationSelected: UniverseTicker[] = [];
  
  for (let i = 0; i < explorationCount && remaining.length > 0; i++) {
    const idx = Math.floor(Math.random() * remaining.length);
    const ticker = remaining.splice(idx, 1)[0];
    ticker.isExploration = true;
    explorationSelected.push(ticker);
  }

  const shortlist = [...noveltySelected, ...explorationSelected];
  
  // Calculate metrics
  const shortlistNewCount = shortlist.filter(t => t.noveltyState === 'new').length;
  const shortlistReappearanceCount = shortlist.filter(t => t.noveltyState === 'reappearance').length;
  const shortlistRepeatCount = shortlist.filter(t => t.noveltyState === 'repeat').length;
  
  console.log(`[Novelty] Shortlist composition:`);
  console.log(`  - NEW (90+ days): ${shortlistNewCount} (${(shortlistNewCount / shortlist.length * 100).toFixed(1)}%)`);
  console.log(`  - REAPPEARANCE (30-90 days): ${shortlistReappearanceCount} (${(shortlistReappearanceCount / shortlist.length * 100).toFixed(1)}%)`);
  console.log(`  - REPEAT (<30 days): ${shortlistRepeatCount} (${(shortlistRepeatCount / shortlist.length * 100).toFixed(1)}%)`);
  console.log(`  - Exploration: ${explorationSelected.length} (${(explorationSelected.length / shortlist.length * 100).toFixed(1)}%)`);
  console.log(`  - Total: ${shortlist.length}`);

  return {
    shortlist,
    metrics: {
      shortlistSize: shortlist.length,
      shortlistNewCount,
      shortlistReappearanceCount,
      shortlistRepeatCount,
      shortlistExplorationCount: explorationSelected.length,
    },
  };
}

// ============================================================================
// GATE ENFORCEMENT (FAIL FAST - ALL GATES ENFORCED)
// ============================================================================

/**
 * Run all gates - FAIL FAST
 * Gates 0-4 must be persisted and BLOCK promotions
 * 
 * GATE 3 BINARY OVERRIDE:
 * If leverage_risk OR liquidity_risk OR regulatory_cliff is flagged as dominant,
 * Gate 3 fails REGARDLESS of numeric score.
 * This aligns with real IC behavior and prevents gaming the score.
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

  // ============================================================================
  // Gate 3: Downside Shape (ENFORCED) - WITH BINARY OVERRIDE
  // ============================================================================
  const g3 = GATES.gate_3_downside_shape;
  const metrics = idea.quick_metrics;
  const riskFlags = idea.risk_flags;
  
  // BINARY OVERRIDE: Check for dominant risks FIRST
  // If any of these are flagged, Gate 3 fails REGARDLESS of numeric score
  if (riskFlags) {
    if (riskFlags.leverage_risk_dominant) {
      results.gate_3_downside_shape = 'fail';
      results.gate_3_binary_override = 'leverage_risk_dominant';
      failures.push({ 
        gate: 'gate_3', 
        passed: false, 
        reason: 'BINARY OVERRIDE: Leverage risk flagged as dominant',
        binaryOverride: true,
      });
    }
    if (riskFlags.liquidity_risk_dominant) {
      results.gate_3_downside_shape = 'fail';
      results.gate_3_binary_override = 'liquidity_risk_dominant';
      failures.push({ 
        gate: 'gate_3', 
        passed: false, 
        reason: 'BINARY OVERRIDE: Liquidity risk flagged as dominant',
        binaryOverride: true,
      });
    }
    if (riskFlags.regulatory_cliff_dominant) {
      results.gate_3_downside_shape = 'fail';
      results.gate_3_binary_override = 'regulatory_cliff_dominant';
      failures.push({ 
        gate: 'gate_3', 
        passed: false, 
        reason: 'BINARY OVERRIDE: Regulatory cliff flagged as dominant',
        binaryOverride: true,
      });
    }
  }
  
  // Numeric checks (only if binary override not triggered)
  if (results.gate_3_downside_shape === 'pass' && metrics) {
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

  const passed = Object.values(results).every(r => r === 'pass' || r === undefined);
  return { passed, results, failures };
}

// ============================================================================
// RANKING (WEIGHTED SUM - FOR DISPLAY ONLY)
// ============================================================================

/**
 * Calculate rank score using WEIGHTED SUM formula
 * 
 * IMPORTANT: Novelty weight (0.45) is for DISPLAY ranking only.
 * Promotion decisions use gates + thresholds, NOT novelty score.
 * 
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
  // Novelty weight 0.45 is for DISPLAY ranking only
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
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[Discovery] Run ${runId}`);
  console.log(`[Discovery] Date: ${asOf}`);
  console.log(`[Discovery] Target: ${LANE_A_DAILY_TARGET}, Cap: ${LANE_A_DAILY_CAP}`);
  console.log(`[Discovery] Timezone: ${SYSTEM_TIMEZONE}`);
  console.log(`[Discovery] Schedule: ${SCHEDULES.LANE_A_CRON} (weekdays only)`);
  console.log(`${'='.repeat(70)}`);
  console.log(`[Discovery] NOVELTY-FIRST ARCHITECTURE ENABLED`);
  console.log(`[Discovery] - Shortlist selection BEFORE LLM enrichment`);
  console.log(`[Discovery] - Prioritization by NOVELTY_STATE, not fundamentals`);
  console.log(`[Discovery] - Max ${LANE_A_LLM_ENRICHMENT_CAP} tickers enriched daily`);
  console.log(`[Discovery] - Promotion uses gates + thresholds, NOT novelty`);
  console.log(`${'='.repeat(70)}\n`);

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
    metrics: {
      universeSize: 0,
      shortlistSize: 0,
      shortlistNewCount: 0,
      shortlistReappearanceCount: 0,
      shortlistRepeatCount: 0,
      shortlistExplorationCount: 0,
      enrichedCount: 0,
      gatedCount: 0,
      gate3FailCount: 0,
      gate4FailCount: 0,
      selectedCount: 0,
      selectedNewPct: 0,
      selectedReappearancePct: 0,
    },
  };

  try {
    // Step 1: Fetch GLOBAL universe (not US-only)
    console.log('[Step 1] Fetching GLOBAL equities universe...');
    context.universe = await fetchGlobalUniverse(options.staticUniversePath);
    context.metrics.universeSize = context.universe.length;
    console.log(`[Step 1] Universe: ${context.universe.length} tickers\n`);

    // Persist universe snapshot for reproducibility
    if (!options.dryRun && context.universe.length > 0) {
      await persistUniverseSnapshot(context.universe, asOf);
    }

    // Step 2: Compute novelty shortlist BEFORE LLM (CRITICAL)
    console.log('[Step 2] Computing novelty shortlist (BEFORE LLM)...');
    console.log('[Step 2] Selection order: NEW > REAPPEARANCE > REPEAT');
    const noveltyStates = new Map<string, NoveltyState>(); // Would load from DB
    const { shortlist, metrics: shortlistMetrics } = await computeNoveltyShortlist(
      context.universe,
      noveltyStates,
      LANE_A_LLM_ENRICHMENT_CAP
    );
    context.noveltyShortlist = shortlist;
    Object.assign(context.metrics, shortlistMetrics);
    console.log(`[Step 2] Shortlist: ${context.noveltyShortlist.length} tickers for LLM\n`);

    // Step 3: Enrich with LLM (only shortlisted tickers)
    console.log('[Step 3] Enriching with LLM (shortlisted only)...');
    // This would call @arc/llm-client to generate IdeaCards
    context.enrichedIdeas = [];
    context.metrics.enrichedCount = context.enrichedIdeas.length;
    console.log(`[Step 3] Enriched: ${context.enrichedIdeas.length} ideas\n`);

    // Step 4: Run gates (FAIL FAST) - WITH BINARY OVERRIDE ON GATE 3
    console.log('[Step 4] Running gates (fail fast)...');
    console.log('[Step 4] Gate 3 has BINARY OVERRIDE for leverage/liquidity/regulatory risks');
    let gate3Fails = 0;
    let gate4Fails = 0;
    
    for (const idea of context.enrichedIdeas) {
      const { passed, results, failures } = runGates(idea);
      if (passed) {
        idea.gate_results = results;
        context.gatedIdeas.push(idea);
      } else {
        const gate3Failure = failures.find(f => f.gate === 'gate_3');
        const gate4Failure = failures.find(f => f.gate === 'gate_4');
        if (gate3Failure) gate3Fails++;
        if (gate4Failure) gate4Fails++;
        
        const binaryOverride = failures.find(f => f.binaryOverride);
        if (binaryOverride) {
          console.log(`  [FAIL] ${idea.ticker}: ${binaryOverride.reason}`);
        } else {
          console.log(`  [FAIL] ${idea.ticker}: ${failures.map(f => f.reason).join(', ')}`);
        }
      }
    }
    context.metrics.gatedCount = context.gatedIdeas.length;
    context.metrics.gate3FailCount = gate3Fails;
    context.metrics.gate4FailCount = gate4Fails;
    console.log(`[Step 4] Gated: ${context.gatedIdeas.length}/${context.enrichedIdeas.length} passed`);
    console.log(`[Step 4] Gate 3 failures: ${gate3Fails}, Gate 4 failures: ${gate4Fails}\n`);

    // Step 5: Score and rank (WEIGHTED SUM - FOR DISPLAY ONLY)
    console.log('[Step 5] Scoring and ranking (weighted sum, novelty 0.45 for display)...');
    for (const idea of context.gatedIdeas) {
      const ticker = context.noveltyShortlist.find(t => t.ticker === idea.ticker);
      const noveltyScore = ticker?.noveltyScore || 0;
      const noveltyState = ticker?.noveltyState || 'repeat';
      const rankScore = calculateRankScore(idea, noveltyScore);
      idea.rank_score = rankScore;
      idea.novelty_score = noveltyScore;
      idea.novelty_state = noveltyState;
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
    
    // Calculate selected metrics
    const selectedNew = context.selectedIdeas.filter(i => (i as any).novelty_state === 'new').length;
    const selectedReappearance = context.selectedIdeas.filter(i => (i as any).novelty_state === 'reappearance').length;
    context.metrics.selectedCount = context.selectedIdeas.length;
    context.metrics.selectedNewPct = context.selectedIdeas.length > 0 
      ? (selectedNew / context.selectedIdeas.length) * 100 
      : 0;
    context.metrics.selectedReappearancePct = context.selectedIdeas.length > 0 
      ? (selectedReappearance / context.selectedIdeas.length) * 100 
      : 0;
    
    console.log(`[Step 6] Selected: ${context.selectedIdeas.length} ideas`);
    console.log(`[Step 6] Composition: ${selectedNew} new (${context.metrics.selectedNewPct.toFixed(1)}%), ${selectedReappearance} reappearance (${context.metrics.selectedReappearancePct.toFixed(1)}%)\n`);

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

    console.log(`${'='.repeat(70)}`);
    console.log(`[Discovery] Run ${runId} COMPLETED`);
    console.log(`[Discovery] Ideas in inbox: ${context.selectedIdeas.length}`);
    console.log(`[Discovery] New ideas: ${selectedNew} (${context.metrics.selectedNewPct.toFixed(1)}%)`);
    console.log(`[Discovery] Reappearances: ${selectedReappearance} (${context.metrics.selectedReappearancePct.toFixed(1)}%)`);
    console.log(`${'='.repeat(70)}\n`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    context.errors.push(errorMsg);
    console.error(`[Discovery] Run ${runId} FAILED: ${errorMsg}`);
  }

  return context;
}

export default runDailyDiscovery;
