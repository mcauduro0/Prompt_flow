/**
 * ARC Investment Factory - Lane B Deep Research Runner
 * Schedule: 08:00 America/Sao_Paulo, weekdays only
 * 
 * Pipeline: select_ideas → fetch_data → run_agents → synthesize → persist
 * 
 * This runner orchestrates the deep research process for promoted ideas.
 * It uses the DAG runner to execute research agents in the correct order.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LANE_B_DAILY_LIMIT,
  LANE_B_WEEKLY_LIMIT,
  LANE_B_MAX_CONCURRENCY,
  SYSTEM_TIMEZONE,
  type StyleTag,
} from '@arc/shared';
import { createDataAggregator, type AggregatedCompanyData } from '@arc/retriever';
import { createResilientClient, type LLMClient } from '@arc/llm-client';
import {
  ideasRepository,
  researchPacketsRepository,
  evidenceRepository,
  runsRepository,
} from '@arc/database';
import { createDAGRunner, type DAGNode, type DAGContext } from './dag-runner.js';
import {
  createBusinessModelAgent,
  createIndustryMoatAgent,
  createValuationAgent,
  type AgentContext,
  type AgentResult,
} from '../agents/index.js';
import { evaluateAllGates, type GateResults } from '../gates/index.js';
import { runSynthesis, type SynthesisResult } from '../agents/synthesis-committee.js';

export interface LaneBConfig {
  dryRun?: boolean;
  maxPackets?: number;
  ideaIds?: string[]; // Specific ideas to process
}

export interface LaneBResult {
  success: boolean;
  packetsStarted: number;
  packetsCompleted: number;
  packetsFailed: number;
  errors: string[];
  duration_ms: number;
  packets: Array<{
    ideaId: string;
    ticker: string;
    status: 'completed' | 'failed';
    packetId?: string;
    error?: string;
  }>;
}

interface ResearchModules {
  businessModel?: any;
  industryMoat?: any;
  valuation?: any;
  financialForensics?: any;
  capitalAllocation?: any;
  managementQuality?: any;
  riskStress?: any;
  synthesis?: SynthesisResult;
}

/**
 * Select ideas for deep research
 * Priority: promoted ideas first, then high-conviction new ideas
 */
async function selectIdeasForResearch(
  maxIdeas: number,
  specificIds?: string[]
): Promise<Array<{ ideaId: string; ticker: string; styleTag: string }>> {
  if (specificIds && specificIds.length > 0) {
    // Process specific ideas
    const ideas = await Promise.all(
      specificIds.map(id => ideasRepository.getById(id))
    );
    return ideas
      .filter(Boolean)
      .map(idea => ({
        ideaId: idea!.ideaId,
        ticker: idea!.ticker,
        styleTag: idea!.styleTag,
      }));
  }

  // Get promoted ideas that don't have research packets yet
  const promotedIdeas = await ideasRepository.getByStatus('promoted');
  const ideasNeedingResearch: Array<{ ideaId: string; ticker: string; styleTag: string }> = [];

  for (const idea of promotedIdeas) {
    const existingPacket = await researchPacketsRepository.getByIdeaId(idea.ideaId);
    if (!existingPacket) {
      ideasNeedingResearch.push({
        ideaId: idea.ideaId,
        ticker: idea.ticker,
        styleTag: idea.styleTag,
      });
    }
    if (ideasNeedingResearch.length >= maxIdeas) break;
  }

  // If we still need more, get high-conviction new ideas
  if (ideasNeedingResearch.length < maxIdeas) {
    const newIdeas = await ideasRepository.getByStatus('new');
    // Sort by conviction (assuming it's in quickMetrics or we use a heuristic)
    for (const idea of newIdeas) {
      const existingPacket = await researchPacketsRepository.getByIdeaId(idea.ideaId);
      if (!existingPacket) {
        ideasNeedingResearch.push({
          ideaId: idea.ideaId,
          ticker: idea.ticker,
          styleTag: idea.styleTag,
        });
      }
      if (ideasNeedingResearch.length >= maxIdeas) break;
    }
  }

  return ideasNeedingResearch;
}

/**
 * Run deep research for a single idea
 */
async function runDeepResearch(
  ideaId: string,
  ticker: string,
  styleTag: string,
  llm: LLMClient
): Promise<{
  success: boolean;
  packetId?: string;
  modules?: ResearchModules;
  gateResults?: GateResults;
  error?: string;
}> {
  const packetId = uuidv4();
  const aggregator = createDataAggregator();

  console.log(`[Lane B] Starting deep research for ${ticker} (${ideaId})`);

  try {
    // Step 1: Fetch comprehensive company data
    console.log(`[Lane B] Fetching data for ${ticker}...`);
    const companyData = await aggregator.getCompanyData(ticker, {
      includeFinancials: true,
      includePriceHistory: true,
      includeNews: true,
      includeFilings: true,
      priceHistoryDays: 365,
    });

    if (!companyData.profile) {
      throw new Error(`Failed to fetch profile for ${ticker}`);
    }

    // Get the original idea for hypothesis
    const idea = await ideasRepository.getById(ideaId);

    // Step 2: Create agent context
    const agentContext: AgentContext = {
      ticker,
      companyData,
      previousModules: {},
      evidenceIds: [],
    };

    // Step 3: Run research agents
    const modules: ResearchModules = {};

    // Business Model Agent
    console.log(`[Lane B] Running Business Model Agent for ${ticker}...`);
    const businessModelAgent = createBusinessModelAgent(llm, aggregator);
    const businessModelResult = await businessModelAgent.run(agentContext);
    if (businessModelResult.success) {
      modules.businessModel = businessModelResult.data;
      agentContext.previousModules = { ...agentContext.previousModules, businessModel: businessModelResult.data };
    }

    // Industry & Moat Agent
    console.log(`[Lane B] Running Industry Moat Agent for ${ticker}...`);
    const industryMoatAgent = createIndustryMoatAgent(llm, aggregator);
    const industryMoatResult = await industryMoatAgent.run(agentContext);
    if (industryMoatResult.success) {
      modules.industryMoat = industryMoatResult.data;
      agentContext.previousModules = { ...agentContext.previousModules, industryMoat: industryMoatResult.data };
    }

    // Valuation Agent
    console.log(`[Lane B] Running Valuation Agent for ${ticker}...`);
    const valuationAgent = createValuationAgent(llm, aggregator);
    const valuationResult = await valuationAgent.run(agentContext);
    if (valuationResult.success) {
      modules.valuation = valuationResult.data;
    }

    // Step 4: Run gates on the research
    console.log(`[Lane B] Running gates for ${ticker}...`);
    const gateResults = evaluateAllGates({
      ticker,
      style_tag: styleTag,
      one_sentence_hypothesis: idea?.oneSentenceHypothesis || modules.businessModel?.summary || '',
      edge_clarity: 0.7, // Default, should come from synthesis
      downside_protection: 0.6, // Default, should come from valuation
      catalysts: idea?.catalysts || [],
      bull_case: modules.valuation?.summary,
      bear_case: '',
      data_coverage: {
        has_financials: !!companyData.incomeStatements?.length,
        financials_years: companyData.incomeStatements?.length || 0,
        has_price_history: !!companyData.priceHistory?.length,
        has_company_info: !!companyData.profile,
        has_estimates: !!companyData.analystEstimates,
      },
      moat_score: modules.industryMoat?.moat_claims?.length ? 0.7 : 0.3,
      roic: companyData.metrics?.roic || undefined,
      margin_of_safety: modules.valuation?.fair_value_range?.base && companyData.latestPrice?.close
        ? (modules.valuation.fair_value_range.base - companyData.latestPrice.close) / modules.valuation.fair_value_range.base
        : undefined,
    });

    // Step 5: Run synthesis committee
    console.log(`[Lane B] Running synthesis for ${ticker}...`);
    const synthesis = await runSynthesis({
      ticker,
      companyName: companyData.profile?.companyName || ticker,
      styleTag,
      originalHypothesis: idea?.oneSentenceHypothesis || '',
      modules: {
        business: modules.businessModel,
        industryMoat: modules.industryMoat,
        valuation: modules.valuation,
      },
      gateResults,
      currentPrice: companyData.latestPrice?.close,
    }, llm);

    modules.synthesis = synthesis;

    // Step 6: Persist research packet (using correct schema)
    console.log(`[Lane B] Persisting research packet for ${ticker}...`);
    const asOf = new Date().toISOString().split('T')[0];
    
    // Build the full packet JSON
    const fullPacket = {
      packetId,
      ideaId,
      ticker,
      asOf,
      styleTag,
      modules: {
        business: modules.businessModel || null,
        industry_moat: modules.industryMoat || null,
        financials: null, // TODO: Add financial forensics agent
        capital_allocation: null, // TODO: Add capital allocation agent
        management: null, // TODO: Add management quality agent
        valuation: modules.valuation || null,
        risk: null, // TODO: Add risk stress agent
        synthesis: modules.synthesis || null,
      },
      gateResults,
      companyData: {
        profile: companyData.profile,
        metrics: companyData.metrics,
        latestPrice: companyData.latestPrice,
      },
      generatedAt: new Date().toISOString(),
    };

    // Build decision brief
    const decisionBrief = synthesis ? {
      recommendation: synthesis.recommendation,
      conviction: synthesis.conviction,
      thesis: synthesis.thesis,
      bull_case: synthesis.bull_case,
      base_case: synthesis.base_case,
      bear_case: synthesis.bear_case,
      key_risks: synthesis.risks,
      position_guidance: synthesis.position_guidance,
    } : null;

    // Build monitoring plan
    const monitoringPlan = synthesis?.monitoring ? {
      key_metrics: synthesis.monitoring.key_metrics,
      review_frequency: synthesis.monitoring.review_frequency,
      red_flags: synthesis.monitoring.red_flags,
      catalysts: synthesis.catalysts,
    } : null;

    await researchPacketsRepository.create({
      packetId,
      ideaId,
      ticker,
      asOf,
      styleTag: styleTag as 'quality_compounder' | 'garp' | 'cigar_butt',
      packet: fullPacket,
      decisionBrief,
      monitoringPlan,
      thesisVersion: 1,
    });

    // Update idea status based on gate results
    if (gateResults.all_passed) {
      await ideasRepository.updateStatus(ideaId, 'researched');
    }

    console.log(`[Lane B] Completed research for ${ticker} - Gates: ${gateResults.all_passed ? 'PASSED' : 'FAILED'}`);
    console.log(`[Lane B] Synthesis: Conviction ${synthesis.conviction}/10, Recommendation: ${synthesis.recommendation}`);

    return {
      success: true,
      packetId,
      modules,
      gateResults,
    };
  } catch (error) {
    console.error(`[Lane B] Error researching ${ticker}:`, (error as Error).message);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Check weekly capacity
 */
async function getWeeklyCapacityRemaining(): Promise<number> {
  const weeklyCount = await researchPacketsRepository.countWeeklyPackets();
  return Math.max(0, LANE_B_WEEKLY_LIMIT - weeklyCount);
}

/**
 * Main Lane B runner
 */
export async function runLaneB(config: LaneBConfig = {}): Promise<LaneBResult> {
  const startTime = Date.now();
  const runId = uuidv4();
  const errors: string[] = [];
  const packets: LaneBResult['packets'] = [];

  console.log(`[Lane B] Starting deep research run at ${new Date().toISOString()}`);
  console.log(`[Lane B] Run ID: ${runId}`);
  console.log(`[Lane B] Timezone: ${SYSTEM_TIMEZONE}`);
  console.log(`[Lane B] Daily limit: ${LANE_B_DAILY_LIMIT}, Weekly: ${LANE_B_WEEKLY_LIMIT}`);
  console.log(`[Lane B] Max concurrency: ${LANE_B_MAX_CONCURRENCY}`);

  // Create run record
  await runsRepository.create({
    runId,
    runType: 'lane_b_research',
    runDate: new Date(),
    status: 'running',
  });

  if (config.dryRun) {
    console.log('[Lane B] Dry run - skipping actual processing');
    await runsRepository.updateStatus(runId, 'completed');
    return {
      success: true,
      packetsStarted: 0,
      packetsCompleted: 0,
      packetsFailed: 0,
      errors: [],
      duration_ms: Date.now() - startTime,
      packets: [],
    };
  }

  try {
    // Check weekly capacity
    const weeklyRemaining = await getWeeklyCapacityRemaining();
    console.log(`[Lane B] Weekly capacity remaining: ${weeklyRemaining}`);

    if (weeklyRemaining <= 0) {
      console.log('[Lane B] Weekly capacity exhausted');
      await runsRepository.updateStatus(runId, 'completed');
      return {
        success: true,
        packetsStarted: 0,
        packetsCompleted: 0,
        packetsFailed: 0,
        errors: ['Weekly capacity exhausted'],
        duration_ms: Date.now() - startTime,
        packets: [],
      };
    }

    // Determine how many packets to process
    const maxPackets = Math.min(
      config.maxPackets ?? LANE_B_DAILY_LIMIT,
      weeklyRemaining
    );

    // Select ideas for research
    console.log(`[Lane B] Selecting up to ${maxPackets} ideas for research...`);
    const ideasToResearch = await selectIdeasForResearch(maxPackets, config.ideaIds);
    console.log(`[Lane B] Selected ${ideasToResearch.length} ideas`);

    if (ideasToResearch.length === 0) {
      console.log('[Lane B] No ideas to research');
      await runsRepository.updateStatus(runId, 'completed');
      return {
        success: true,
        packetsStarted: 0,
        packetsCompleted: 0,
        packetsFailed: 0,
        errors: [],
        duration_ms: Date.now() - startTime,
        packets: [],
      };
    }

    // Create LLM client
    const llm = createResilientClient();

    // Process ideas (with concurrency limit)
    let packetsCompleted = 0;
    let packetsFailed = 0;

    for (const idea of ideasToResearch) {
      const result = await runDeepResearch(
        idea.ideaId,
        idea.ticker,
        idea.styleTag,
        llm
      );

      if (result.success) {
        packetsCompleted++;
        packets.push({
          ideaId: idea.ideaId,
          ticker: idea.ticker,
          status: 'completed',
          packetId: result.packetId,
        });
      } else {
        packetsFailed++;
        packets.push({
          ideaId: idea.ideaId,
          ticker: idea.ticker,
          status: 'failed',
          error: result.error,
        });
        errors.push(`${idea.ticker}: ${result.error}`);
      }

      // Rate limiting between ideas
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Update run record
    await runsRepository.updateStatus(runId, 'completed');
    await runsRepository.updatePayload(runId, {
      ideasSelected: ideasToResearch.length,
      packetsCompleted,
      packetsFailed,
      errors: errors.length,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[Lane B] Research run completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`[Lane B] Completed: ${packetsCompleted}, Failed: ${packetsFailed}`);

    return {
      success: true,
      packetsStarted: ideasToResearch.length,
      packetsCompleted,
      packetsFailed,
      errors,
      duration_ms: Date.now() - startTime,
      packets,
    };
  } catch (error) {
    const errorMessage = (error as Error).message;
    errors.push(errorMessage);

    await runsRepository.updateStatus(runId, 'failed', errorMessage);

    console.error('[Lane B] Research run failed:', errorMessage);

    return {
      success: false,
      packetsStarted: 0,
      packetsCompleted: 0,
      packetsFailed: 0,
      errors,
      duration_ms: Date.now() - startTime,
      packets: [],
    };
  }
}

export default { runLaneB };
