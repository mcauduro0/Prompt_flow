/**
 * ARC Investment Factory - Daily Discovery Run (Lane A)
 * Following Operating Parameters DAG specification exactly
 * 
 * DAG: daily_discovery_run
 * Schedule: 06:00 UTC daily
 * 
 * Nodes:
 * 1. fetch_universe → 2. generate_ideas → 3. run_gates → 4. score_and_rank →
 * 5. novelty_filter → 6. style_mix_adjust → 7. select_top_n → 8. persist_inbox →
 * 9. notify_user
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
  SCORING_WEIGHTS,
  PROMOTION_THRESHOLDS,
  STYLE_MIX_TARGETS,
  LANE_A_DAILY_LIMIT,
  NOVELTY_DECAY_DAYS,
} from '@arc/shared';

// ============================================================================
// TYPES
// ============================================================================

interface DiscoveryContext extends DAGContext {
  data: {
    universe: string[];
    rawIdeas: IdeaCardCreate[];
    gatedIdeas: IdeaCardCreate[];
    scoredIdeas: IdeaCardCreate[];
    noveltyFilteredIdeas: IdeaCardCreate[];
    styleMixAdjustedIdeas: IdeaCardCreate[];
    selectedIdeas: IdeaCardCreate[];
    persistedIdeas: IdeaCard[];
    asOf: string;
  };
}

// ============================================================================
// PROMPTS
// ============================================================================

const IDEA_GENERATION_SYSTEM_PROMPT = `You are an expert equity research analyst specializing in identifying investment opportunities.

Your task is to generate investment ideas (IdeaCards) based on company data.

For each company, analyze the data and determine if there's a compelling investment thesis.

Focus on:
1. Variant perception - what the market is missing
2. Unit economics inflection - improving fundamentals
3. Mispriced risk - overstated concerns
4. Reinvestment runway - growth opportunities
5. Rerating catalyst - upcoming events
6. Underfollowed - information asymmetry

Style classifications:
- quality_compounder: High ROIC, durable moat, reinvestment runway
- garp: Growth at reasonable price, improving margins
- cigar_butt: Deep value, asset-heavy, turnaround potential

Output ONLY valid JSON matching the IdeaCard schema.`;

const IDEA_GENERATION_USER_TEMPLATE = `Analyze this company and generate an IdeaCard if there's a compelling investment thesis:

COMPANY: {{ticker}}
PROFILE: {{profile}}
METRICS: {{metrics}}
RECENT NEWS: {{news}}

If no compelling thesis exists, return: {"skip": true, "reason": "..."}

Otherwise, return a complete IdeaCard JSON with:
- ticker, company_name, region, currency, sector, industry
- style_tag (quality_compounder, garp, or cigar_butt)
- one_sentence_hypothesis (max 500 chars)
- mechanism (detailed explanation)
- time_horizon: "1_3_years"
- edge_type (array of edge types)
- quick_metrics (from provided data)
- catalysts (array with name, window, probability, expected_impact, how_to_monitor)
- signposts (array with metric, direction, threshold, frequency, why_it_matters)
- evidence_refs (array with source_type, source_id, snippet)

JSON output:`;

// ============================================================================
// DAG NODES
// ============================================================================

/**
 * Node 1: Fetch Universe
 * Retrieves the list of tickers to analyze
 */
function createFetchUniverseNode(aggregator: DataAggregator): DAGNode {
  return {
    id: 'fetch_universe',
    name: 'Fetch Universe',
    dependencies: [],
    timeout: 60000,
    retries: 2,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContext;
      console.log('[fetch_universe] Fetching investment universe...');

      // Get tickers from multiple sources
      const [usLargeCap, usMidCap] = await Promise.all([
        aggregator.screenTickers({
          marketCapMin: 10_000_000_000, // $10B+
          country: 'US',
          limit: 200,
        }),
        aggregator.screenTickers({
          marketCapMin: 2_000_000_000,
          marketCapMax: 10_000_000_000,
          country: 'US',
          limit: 100,
        }),
      ]);

      // Combine and dedupe
      const universe = [...new Set([...usLargeCap, ...usMidCap])];
      ctx.data.universe = universe;
      ctx.data.asOf = new Date().toISOString().split('T')[0];

      console.log(`[fetch_universe] Found ${universe.length} tickers`);
    },
  };
}

/**
 * Node 2: Generate Ideas
 * Uses LLM to generate IdeaCards from company data
 */
function createGenerateIdeasNode(
  aggregator: DataAggregator,
  llmClient: ResilientLLMClient
): DAGNode {
  return {
    id: 'generate_ideas',
    name: 'Generate Ideas',
    dependencies: ['fetch_universe'],
    timeout: 600000, // 10 minutes
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContext;
      console.log('[generate_ideas] Generating ideas from universe...');

      const rawIdeas: IdeaCardCreate[] = [];
      const batchSize = 10;
      const universe = ctx.data.universe.slice(0, 50); // Limit for initial run

      for (let i = 0; i < universe.length; i += batchSize) {
        const batch = universe.slice(i, i + batchSize);
        console.log(`[generate_ideas] Processing batch ${i / batchSize + 1}/${Math.ceil(universe.length / batchSize)}`);

        const batchResults = await Promise.all(
          batch.map(async (ticker) => {
            try {
              const companyData = await aggregator.getCompanyData(ticker, {
                includeFinancials: false,
                includeNews: true,
                includeFilings: false,
              });

              if (!companyData.profile || !companyData.metrics) {
                return null;
              }

              const userPrompt = IDEA_GENERATION_USER_TEMPLATE
                .replace('{{ticker}}', ticker)
                .replace('{{profile}}', JSON.stringify(companyData.profile, null, 2))
                .replace('{{metrics}}', JSON.stringify(companyData.metrics, null, 2))
                .replace('{{news}}', JSON.stringify(companyData.news?.slice(0, 5) ?? [], null, 2));

              const response = await llmClient.complete({
                messages: [
                  { role: 'system', content: IDEA_GENERATION_SYSTEM_PROMPT },
                  { role: 'user', content: userPrompt },
                ],
                maxTokens: 2000,
                temperature: 0.7,
                jsonMode: true,
              });

              const parsed = JSON.parse(response.content);
              
              // Skip if no thesis
              if (parsed.skip) {
                console.log(`[generate_ideas] Skipped ${ticker}: ${parsed.reason}`);
                return null;
              }

              // Add metadata
              parsed.idea_id = crypto.randomUUID();
              parsed.as_of = ctx.data.asOf;
              parsed.status = 'new';
              parsed.rejection_reason = null;
              parsed.next_action = 'monitor';

              return parsed as IdeaCardCreate;
            } catch (error) {
              console.error(`[generate_ideas] Error processing ${ticker}:`, error);
              return null;
            }
          })
        );

        rawIdeas.push(...batchResults.filter((idea): idea is IdeaCardCreate => idea !== null));
      }

      ctx.data.rawIdeas = rawIdeas;
      console.log(`[generate_ideas] Generated ${rawIdeas.length} raw ideas`);
    },
  };
}

/**
 * Node 3: Run Gates
 * Apply 5 gates to filter ideas
 */
function createRunGatesNode(): DAGNode {
  return {
    id: 'run_gates',
    name: 'Run Gates',
    dependencies: ['generate_ideas'],
    timeout: 120000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContext;
      console.log('[run_gates] Running gates on ideas...');

      const gatedIdeas: IdeaCardCreate[] = [];

      for (const idea of ctx.data.rawIdeas) {
        const gateResults = {
          gate_0_data_sufficiency: checkDataSufficiency(idea),
          gate_1_coherence: checkCoherence(idea),
          gate_2_edge_claim: checkEdgeClaim(idea),
          gate_3_downside_shape: checkDownsideShape(idea),
          gate_4_style_fit: checkStyleFit(idea),
        };

        const allPassed = Object.values(gateResults).every((r) => r === 'pass');

        if (allPassed) {
          gatedIdeas.push({
            ...idea,
            gate_results: gateResults,
          } as IdeaCardCreate);
        } else {
          console.log(`[run_gates] ${idea.ticker} failed gates:`, gateResults);
        }
      }

      ctx.data.gatedIdeas = gatedIdeas;
      console.log(`[run_gates] ${gatedIdeas.length}/${ctx.data.rawIdeas.length} ideas passed all gates`);
    },
  };
}

/**
 * Node 4: Score and Rank
 * Calculate scores for each idea
 */
function createScoreAndRankNode(): DAGNode {
  return {
    id: 'score_and_rank',
    name: 'Score and Rank',
    dependencies: ['run_gates'],
    timeout: 60000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContext;
      console.log('[score_and_rank] Scoring ideas...');

      const scoredIdeas = ctx.data.gatedIdeas.map((idea) => {
        const score = calculateScore(idea);
        return {
          ...idea,
          score,
        } as IdeaCardCreate;
      });

      // Sort by total score descending
      scoredIdeas.sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));

      ctx.data.scoredIdeas = scoredIdeas;
      console.log(`[score_and_rank] Scored ${scoredIdeas.length} ideas`);
    },
  };
}

/**
 * Node 5: Novelty Filter
 * Apply novelty scoring and filter
 */
function createNoveltyFilterNode(): DAGNode {
  return {
    id: 'novelty_filter',
    name: 'Novelty Filter',
    dependencies: ['score_and_rank'],
    timeout: 60000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContext;
      console.log('[novelty_filter] Applying novelty filter...');

      const tickers = ctx.data.scoredIdeas.map((i) => i.ticker);
      const noveltyStates = await noveltyStateRepository.getByTickers(tickers);
      const noveltyMap = new Map(noveltyStates.map((s) => [s.ticker, s]));

      const now = new Date();
      const noveltyFilteredIdeas = ctx.data.scoredIdeas.map((idea) => {
        const state = noveltyMap.get(idea.ticker);
        let noveltyScore = 1.0;
        let repetitionPenalty = 0;

        if (state) {
          // Calculate days since last seen
          const daysSinceLastSeen = Math.floor(
            (now.getTime() - new Date(state.lastSeen).getTime()) / (24 * 60 * 60 * 1000)
          );

          // Novelty decays over time
          if (daysSinceLastSeen < NOVELTY_DECAY_DAYS) {
            noveltyScore = daysSinceLastSeen / NOVELTY_DECAY_DAYS;
          }

          // Repetition penalty based on seen count
          if (state.seenCount > 3) {
            repetitionPenalty = Math.min((state.seenCount - 3) * 0.05, 0.3);
          }

          // Check for new edge types
          const hasNewEdge = idea.edge_type?.some(
            (e) => !(state.lastEdgeTypes as string[])?.includes(e)
          );
          if (hasNewEdge) {
            noveltyScore = Math.min(noveltyScore + 0.3, 1.0);
          }
        }

        // Calculate rank score
        const baseScore = idea.score?.total ?? 0;
        const rankScore = baseScore * noveltyScore * (1 - repetitionPenalty);

        return {
          ...idea,
          novelty_score: noveltyScore.toFixed(2),
          repetition_penalty: repetitionPenalty.toFixed(2),
          rank_score: rankScore.toFixed(6),
        } as IdeaCardCreate;
      });

      // Sort by rank score
      noveltyFilteredIdeas.sort(
        (a, b) => parseFloat(b.rank_score ?? '0') - parseFloat(a.rank_score ?? '0')
      );

      ctx.data.noveltyFilteredIdeas = noveltyFilteredIdeas;
      console.log(`[novelty_filter] Applied novelty filter to ${noveltyFilteredIdeas.length} ideas`);
    },
  };
}

/**
 * Node 6: Style Mix Adjust
 * Adjust rankings based on style mix quotas
 */
function createStyleMixAdjustNode(): DAGNode {
  return {
    id: 'style_mix_adjust',
    name: 'Style Mix Adjust',
    dependencies: ['novelty_filter'],
    timeout: 30000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContext;
      console.log('[style_mix_adjust] Adjusting for style mix...');

      const adjustments = await styleMixStateRepository.getThresholdAdjustments();

      const styleMixAdjustedIdeas = ctx.data.noveltyFilteredIdeas.map((idea) => {
        const styleTag = idea.style_tag as keyof typeof adjustments;
        const adjustment = adjustments[styleTag] ?? 0;

        if (adjustment > 0) {
          const currentRank = parseFloat(idea.rank_score ?? '0');
          const adjustedRank = currentRank * (1 - adjustment / 100);
          return {
            ...idea,
            rank_score: adjustedRank.toFixed(6),
          } as IdeaCardCreate;
        }

        return idea;
      });

      // Re-sort after adjustment
      styleMixAdjustedIdeas.sort(
        (a, b) => parseFloat(b.rank_score ?? '0') - parseFloat(a.rank_score ?? '0')
      );

      ctx.data.styleMixAdjustedIdeas = styleMixAdjustedIdeas;
      console.log(`[style_mix_adjust] Adjusted ${styleMixAdjustedIdeas.length} ideas for style mix`);
    },
  };
}

/**
 * Node 7: Select Top N
 * Select top ideas for the inbox
 */
function createSelectTopNNode(): DAGNode {
  return {
    id: 'select_top_n',
    name: 'Select Top N',
    dependencies: ['style_mix_adjust'],
    timeout: 10000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContext;
      console.log('[select_top_n] Selecting top ideas...');

      const selectedIdeas = ctx.data.styleMixAdjustedIdeas.slice(0, LANE_A_DAILY_LIMIT);

      ctx.data.selectedIdeas = selectedIdeas;
      console.log(`[select_top_n] Selected ${selectedIdeas.length} ideas for inbox`);
    },
  };
}

/**
 * Node 8: Persist Inbox
 * Save ideas to database
 */
function createPersistInboxNode(): DAGNode {
  return {
    id: 'persist_inbox',
    name: 'Persist Inbox',
    dependencies: ['select_top_n'],
    timeout: 60000,
    retries: 2,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContext;
      console.log('[persist_inbox] Persisting ideas to database...');

      const newIdeas: NewIdea[] = ctx.data.selectedIdeas.map((idea) => ({
        ticker: idea.ticker,
        asOf: ctx.data.asOf,
        styleTag: idea.style_tag as 'quality_compounder' | 'garp' | 'cigar_butt',
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
      }));

      const persistedIdeas = await ideasRepository.createMany(newIdeas);

      // Update novelty state for all processed tickers
      const now = new Date();
      await noveltyStateRepository.upsertMany(
        ctx.data.selectedIdeas.map((idea) => ({
          ticker: idea.ticker,
          lastSeen: now,
          lastEdgeTypes: idea.edge_type,
          lastStyleTag: idea.style_tag,
        }))
      );

      ctx.data.persistedIdeas = persistedIdeas as IdeaCard[];
      console.log(`[persist_inbox] Persisted ${persistedIdeas.length} ideas`);
    },
  };
}

/**
 * Node 9: Notify User
 * Send notification about new ideas
 */
function createNotifyUserNode(): DAGNode {
  return {
    id: 'notify_user',
    name: 'Notify User',
    dependencies: ['persist_inbox'],
    timeout: 10000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as DiscoveryContext;
      console.log('[notify_user] Preparing notification...');

      const summary = {
        date: ctx.data.asOf,
        totalIdeas: ctx.data.persistedIdeas.length,
        byStyle: {
          quality_compounder: ctx.data.persistedIdeas.filter(
            (i) => i.styleTag === 'quality_compounder'
          ).length,
          garp: ctx.data.persistedIdeas.filter((i) => i.styleTag === 'garp').length,
          cigar_butt: ctx.data.persistedIdeas.filter((i) => i.styleTag === 'cigar_butt').length,
        },
        topIdeas: ctx.data.persistedIdeas.slice(0, 5).map((i) => ({
          ticker: i.ticker,
          hypothesis: i.oneSentenceHypothesis,
          score: i.score,
        })),
      };

      console.log('[notify_user] Daily Discovery Summary:', JSON.stringify(summary, null, 2));

      // TODO: Implement actual notification (email, Slack, etc.)
    },
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function checkDataSufficiency(idea: IdeaCardCreate): 'pass' | 'fail' {
  // Check if we have minimum required data
  if (!idea.quick_metrics) return 'fail';
  if (!idea.one_sentence_hypothesis || idea.one_sentence_hypothesis.length < 10) return 'fail';
  if (!idea.mechanism || idea.mechanism.length < 20) return 'fail';
  if (!idea.signposts || idea.signposts.length < 2) return 'fail';
  return 'pass';
}

function checkCoherence(idea: IdeaCardCreate): 'pass' | 'fail' {
  // Check if hypothesis and mechanism are coherent
  if (!idea.one_sentence_hypothesis || !idea.mechanism) return 'fail';
  // Basic check: mechanism should be longer than hypothesis
  if (idea.mechanism.length < idea.one_sentence_hypothesis.length) return 'fail';
  return 'pass';
}

function checkEdgeClaim(idea: IdeaCardCreate): 'pass' | 'fail' {
  // Check if edge type is specified and valid
  if (!idea.edge_type || idea.edge_type.length === 0) return 'fail';
  const validEdges = [
    'variant_perception',
    'unit_economics_inflection',
    'mispriced_risk',
    'reinvestment_runway',
    'rerating_catalyst',
    'underfollowed',
  ];
  if (!idea.edge_type.every((e) => validEdges.includes(e))) return 'fail';
  return 'pass';
}

function checkDownsideShape(idea: IdeaCardCreate): 'pass' | 'fail' {
  // Check downside risk indicators
  const metrics = idea.quick_metrics;
  if (!metrics) return 'fail';

  // Fail if excessive leverage
  if (metrics.net_debt_to_ebitda && metrics.net_debt_to_ebitda > 5) return 'fail';

  // For cigar_butt, allow higher leverage
  if (idea.style_tag === 'cigar_butt' && metrics.net_debt_to_ebitda && metrics.net_debt_to_ebitda > 7) {
    return 'fail';
  }

  return 'pass';
}

function checkStyleFit(idea: IdeaCardCreate): 'pass' | 'fail' {
  const metrics = idea.quick_metrics;
  if (!metrics) return 'fail';

  switch (idea.style_tag) {
    case 'quality_compounder':
      // Should have decent margins and growth
      if (metrics.ebit_margin && metrics.ebit_margin < 0.1) return 'fail';
      break;
    case 'garp':
      // Should have reasonable valuation
      if (metrics.pe && metrics.pe > 50) return 'fail';
      break;
    case 'cigar_butt':
      // Should be cheap
      if (metrics.ev_to_ebitda && metrics.ev_to_ebitda > 15) return 'fail';
      break;
  }

  return 'pass';
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
    (idea.edge_type?.length ?? 0) * 5 +
      (idea.mechanism?.length ?? 0 > 200 ? 10 : 5),
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
  const disclosurePenalty = 0; // Would need more data to calculate

  const total =
    edgeClarity +
    businessQuality +
    financialResilience +
    valuationTension +
    catalystClarity +
    infoAvailability -
    complexityPenalty -
    disclosurePenalty;

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
// MAIN EXPORT
// ============================================================================

/**
 * Create and configure the daily discovery DAG
 */
export function createDailyDiscoveryDAG(): DAGRunner {
  const aggregator = createDataAggregator();
  const llmClient = createResilientClient();
  const dag = createDAGRunner('daily_discovery');

  dag.addNodes([
    createFetchUniverseNode(aggregator),
    createGenerateIdeasNode(aggregator, llmClient),
    createRunGatesNode(),
    createScoreAndRankNode(),
    createNoveltyFilterNode(),
    createStyleMixAdjustNode(),
    createSelectTopNNode(),
    createPersistInboxNode(),
    createNotifyUserNode(),
  ]);

  return dag;
}

/**
 * Run daily discovery
 */
export async function runDailyDiscovery(): Promise<void> {
  // Check idempotency
  const alreadyRan = await runsRepository.existsForToday('daily_discovery');
  if (alreadyRan) {
    console.log('[daily_discovery] Already ran today, skipping');
    return;
  }

  // Create run record
  const run = await runsRepository.create({
    runType: 'daily_discovery',
    status: 'running',
  });

  try {
    const dag = createDailyDiscoveryDAG();
    const result = await dag.run();

    // Update run record
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
