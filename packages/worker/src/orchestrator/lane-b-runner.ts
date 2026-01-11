/**
 * ARC Investment Factory - Lane B Runner
 * Deep research workflow for promoted ideas
 * 
 * DAG: daily_lane_b
 * Schedule: 07:00 UTC daily (after Lane A)
 * 
 * Nodes:
 * 1. fetch_promoted_ideas → 2. parallel_research → 3. assemble_packets →
 * 4. generate_decision_briefs → 5. persist_packets → 6. notify_user
 */

import { DAGRunner, createDAGRunner, type DAGContext, type DAGNode } from './dag-runner.js';
import { createDataAggregator, type DataAggregator, type AggregatedCompanyData } from '@arc/retriever';
import { createResilientClient, type ResilientLLMClient } from '@arc/llm-client';
import {
  ResearchPacketSchema,
  DecisionBriefSchema,
  validateWithRetry,
  type ResearchPacket,
  type DecisionBrief,
} from '@arc/core';
import {
  ideasRepository,
  researchPacketsRepository,
  evidenceRepository,
  runsRepository,
  type Idea,
  type NewResearchPacket,
  type NewEvidence,
} from '@arc/database';
import {
  createBusinessModelAgent,
  createIndustryMoatAgent,
  createFinancialForensicsAgent,
  createCapitalAllocationAgent,
  createManagementQualityAgent,
  createValuationAgent,
  createRiskStressAgent,
  type AgentContext,
  type AgentResult,
} from '../agents/index.js';
import { LANE_B_DAILY_LIMIT, LANE_B_WEEKLY_LIMIT } from '@arc/shared';

// ============================================================================
// TYPES
// ============================================================================

interface LaneBContext extends DAGContext {
  data: {
    promotedIdeas: Idea[];
    researchResults: Map<string, ResearchModules>;
    assembledPackets: Map<string, AssembledPacket>;
    decisionBriefs: Map<string, DecisionBrief>;
    persistedPackets: ResearchPacket[];
    asOf: string;
  };
}

interface ResearchModules {
  ideaId: string;
  ticker: string;
  business?: any;
  industry_moat?: any;
  financial_forensics?: any;
  capital_allocation?: any;
  management_quality?: any;
  valuation?: any;
  risk_stress?: any;
  errors: string[];
  evidenceIds: string[];
}

interface AssembledPacket {
  ideaId: string;
  ticker: string;
  version: number;
  modules: ResearchModules;
  synthesizedView: string;
  keyRisks: string[];
  keyOpportunities: string[];
}

// ============================================================================
// PROMPTS
// ============================================================================

const SYNTHESIS_SYSTEM_PROMPT = `You are an expert investment analyst synthesizing research modules into a coherent investment view.

Your task is to create a synthesized view that:
1. Integrates findings from all research modules
2. Identifies key risks and opportunities
3. Provides a clear investment recommendation framework
4. Highlights areas of uncertainty or required further research

Be concise but comprehensive. Focus on actionable insights.`;

const DECISION_BRIEF_SYSTEM_PROMPT = `You are an expert investment analyst creating a decision brief for an investment committee.

Your task is to create a concise, actionable decision brief that:
1. Summarizes the investment thesis in 2-3 sentences
2. Provides a clear verdict (strong_buy, buy, hold, sell, strong_sell)
3. Lists key risks with probability and impact
4. Identifies specific catalysts and their timing
5. Provides clear position sizing guidance

The brief should be suitable for presentation to a senior investment committee.
Output ONLY valid JSON matching the DecisionBrief schema.`;

// ============================================================================
// DAG NODES
// ============================================================================

/**
 * Node 1: Fetch Promoted Ideas
 * Get ideas that have been promoted to Lane B
 */
function createFetchPromotedIdeasNode(): DAGNode {
  return {
    id: 'fetch_promoted_ideas',
    name: 'Fetch Promoted Ideas',
    dependencies: [],
    timeout: 30000,
    retries: 2,
    execute: async (context: DAGContext) => {
      const ctx = context as LaneBContext;
      console.log('[fetch_promoted_ideas] Fetching promoted ideas...');

      // Check weekly limit
      const weeklyCount = await researchPacketsRepository.countWeeklyPackets();
      if (weeklyCount >= LANE_B_WEEKLY_LIMIT) {
        console.log(`[fetch_promoted_ideas] Weekly limit reached (${weeklyCount}/${LANE_B_WEEKLY_LIMIT})`);
        ctx.data.promotedIdeas = [];
        return;
      }

      const remainingSlots = Math.min(
        LANE_B_DAILY_LIMIT,
        LANE_B_WEEKLY_LIMIT - weeklyCount
      );

      // Get promoted ideas that don't have research packets yet
      const promotedIdeas = await ideasRepository.getByStatus('promoted', remainingSlots);

      // Filter out ideas that already have packets
      const ideasNeedingResearch: Idea[] = [];
      for (const idea of promotedIdeas) {
        const existingPacket = await researchPacketsRepository.getByIdeaId(idea.ideaId);
        if (!existingPacket) {
          ideasNeedingResearch.push(idea);
        }
      }

      ctx.data.promotedIdeas = ideasNeedingResearch.slice(0, remainingSlots);
      ctx.data.asOf = new Date().toISOString().split('T')[0];
      ctx.data.researchResults = new Map();
      ctx.data.assembledPackets = new Map();
      ctx.data.decisionBriefs = new Map();

      console.log(`[fetch_promoted_ideas] Found ${ctx.data.promotedIdeas.length} ideas for research`);
    },
  };
}

/**
 * Node 2: Parallel Research
 * Run all research agents in parallel for each idea
 */
function createParallelResearchNode(
  aggregator: DataAggregator,
  llmClient: ResilientLLMClient
): DAGNode {
  return {
    id: 'parallel_research',
    name: 'Parallel Research',
    dependencies: ['fetch_promoted_ideas'],
    timeout: 900000, // 15 minutes
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as LaneBContext;
      console.log('[parallel_research] Running research agents...');

      if (ctx.data.promotedIdeas.length === 0) {
        console.log('[parallel_research] No ideas to research');
        return;
      }

      // Create agents
      const businessAgent = createBusinessModelAgent(llmClient, aggregator);
      const industryMoatAgent = createIndustryMoatAgent(llmClient, aggregator);
      const financialForensicsAgent = createFinancialForensicsAgent(llmClient, aggregator);
      const capitalAllocationAgent = createCapitalAllocationAgent(llmClient, aggregator);
      const managementQualityAgent = createManagementQualityAgent(llmClient, aggregator);
      const valuationAgent = createValuationAgent(llmClient, aggregator);
      const riskStressAgent = createRiskStressAgent(llmClient, aggregator);

      // Process each idea
      for (const idea of ctx.data.promotedIdeas) {
        console.log(`[parallel_research] Researching ${idea.ticker}...`);

        try {
          // Fetch comprehensive company data
          const companyData = await aggregator.getCompanyData(idea.ticker, {
            includeFinancials: true,
            includePriceHistory: true,
            includeNews: true,
            includeFilings: true,
            priceHistoryDays: 365,
          });

          const agentContext: AgentContext = {
            ticker: idea.ticker,
            companyData,
            evidenceIds: [],
          };

          // Run all agents in parallel
          const [
            businessResult,
            industryResult,
            forensicsResult,
            capitalResult,
            managementResult,
            valuationResult,
            riskResult,
          ] = await Promise.all([
            businessAgent.run(agentContext),
            industryMoatAgent.run(agentContext),
            financialForensicsAgent.run(agentContext),
            capitalAllocationAgent.run(agentContext),
            managementQualityAgent.run(agentContext),
            valuationAgent.run(agentContext),
            riskStressAgent.run({
              ...agentContext,
              previousModules: {
                business: businessResult?.data,
                industry_moat: industryResult?.data,
                financial_forensics: forensicsResult?.data,
              },
            }),
          ]);

          // Collect all evidence IDs
          const allEvidenceIds = [
            ...businessResult.evidenceIds,
            ...industryResult.evidenceIds,
            ...forensicsResult.evidenceIds,
            ...capitalResult.evidenceIds,
            ...managementResult.evidenceIds,
            ...valuationResult.evidenceIds,
            ...riskResult.evidenceIds,
          ];

          // Collect errors
          const errors: string[] = [];
          if (!businessResult.success) errors.push(`Business: ${businessResult.errors?.join(', ')}`);
          if (!industryResult.success) errors.push(`Industry: ${industryResult.errors?.join(', ')}`);
          if (!forensicsResult.success) errors.push(`Forensics: ${forensicsResult.errors?.join(', ')}`);
          if (!capitalResult.success) errors.push(`Capital: ${capitalResult.errors?.join(', ')}`);
          if (!managementResult.success) errors.push(`Management: ${managementResult.errors?.join(', ')}`);
          if (!valuationResult.success) errors.push(`Valuation: ${valuationResult.errors?.join(', ')}`);
          if (!riskResult.success) errors.push(`Risk: ${riskResult.errors?.join(', ')}`);

          ctx.data.researchResults.set(idea.ideaId, {
            ideaId: idea.ideaId,
            ticker: idea.ticker,
            business: businessResult.data,
            industry_moat: industryResult.data,
            financial_forensics: forensicsResult.data,
            capital_allocation: capitalResult.data,
            management_quality: managementResult.data,
            valuation: valuationResult.data,
            risk_stress: riskResult.data,
            errors,
            evidenceIds: allEvidenceIds,
          });

          console.log(`[parallel_research] Completed ${idea.ticker} with ${errors.length} errors`);
        } catch (error) {
          console.error(`[parallel_research] Failed ${idea.ticker}:`, error);
          ctx.data.researchResults.set(idea.ideaId, {
            ideaId: idea.ideaId,
            ticker: idea.ticker,
            errors: [(error as Error).message],
            evidenceIds: [],
          });
        }
      }

      console.log(`[parallel_research] Completed research for ${ctx.data.researchResults.size} ideas`);
    },
  };
}

/**
 * Node 3: Assemble Packets
 * Synthesize research modules into coherent packets
 */
function createAssemblePacketsNode(llmClient: ResilientLLMClient): DAGNode {
  return {
    id: 'assemble_packets',
    name: 'Assemble Packets',
    dependencies: ['parallel_research'],
    timeout: 300000, // 5 minutes
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as LaneBContext;
      console.log('[assemble_packets] Assembling research packets...');

      for (const [ideaId, modules] of ctx.data.researchResults) {
        // Skip if too many errors
        if (modules.errors.length > 4) {
          console.log(`[assemble_packets] Skipping ${modules.ticker} due to too many errors`);
          continue;
        }

        try {
          // Get existing packet version
          const existingPackets = await researchPacketsRepository.getAllVersionsByIdeaId(ideaId);
          const version = existingPackets.length + 1;

          // Generate synthesized view
          const synthesisPrompt = `Synthesize the following research modules for ${modules.ticker}:

BUSINESS MODEL:
${JSON.stringify(modules.business, null, 2)}

INDUSTRY & MOAT:
${JSON.stringify(modules.industry_moat, null, 2)}

FINANCIAL FORENSICS:
${JSON.stringify(modules.financial_forensics, null, 2)}

CAPITAL ALLOCATION:
${JSON.stringify(modules.capital_allocation, null, 2)}

MANAGEMENT QUALITY:
${JSON.stringify(modules.management_quality, null, 2)}

VALUATION:
${JSON.stringify(modules.valuation, null, 2)}

RISK & STRESS:
${JSON.stringify(modules.risk_stress, null, 2)}

Provide:
1. A synthesized investment view (2-3 paragraphs)
2. Top 3 key risks
3. Top 3 key opportunities

Output as JSON: { "synthesized_view": "...", "key_risks": ["...", "...", "..."], "key_opportunities": ["...", "...", "..."] }`;

          const synthesisResponse = await llmClient.complete({
            messages: [
              { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
              { role: 'user', content: synthesisPrompt },
            ],
            maxTokens: 2000,
            temperature: 0.5,
            jsonMode: true,
          });

          const synthesis = JSON.parse(synthesisResponse.content);

          ctx.data.assembledPackets.set(ideaId, {
            ideaId,
            ticker: modules.ticker,
            version,
            modules,
            synthesizedView: synthesis.synthesized_view,
            keyRisks: synthesis.key_risks,
            keyOpportunities: synthesis.key_opportunities,
          });

          console.log(`[assemble_packets] Assembled packet for ${modules.ticker} v${version}`);
        } catch (error) {
          console.error(`[assemble_packets] Failed to assemble ${modules.ticker}:`, error);
        }
      }

      console.log(`[assemble_packets] Assembled ${ctx.data.assembledPackets.size} packets`);
    },
  };
}

/**
 * Node 4: Generate Decision Briefs
 * Create IC-ready decision briefs
 */
function createGenerateDecisionBriefsNode(llmClient: ResilientLLMClient): DAGNode {
  return {
    id: 'generate_decision_briefs',
    name: 'Generate Decision Briefs',
    dependencies: ['assemble_packets'],
    timeout: 300000, // 5 minutes
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as LaneBContext;
      console.log('[generate_decision_briefs] Generating decision briefs...');

      for (const [ideaId, packet] of ctx.data.assembledPackets) {
        try {
          // Get the original idea for context
          const idea = ctx.data.promotedIdeas.find((i) => i.ideaId === ideaId);
          if (!idea) continue;

          const briefPrompt = `Generate a decision brief for ${packet.ticker}:

ORIGINAL HYPOTHESIS:
${idea.oneSentenceHypothesis}

SYNTHESIZED VIEW:
${packet.synthesizedView}

KEY RISKS:
${packet.keyRisks.map((r, i) => `${i + 1}. ${r}`).join('\n')}

KEY OPPORTUNITIES:
${packet.keyOpportunities.map((o, i) => `${i + 1}. ${o}`).join('\n')}

VALUATION:
${JSON.stringify(packet.modules.valuation, null, 2)}

CATALYSTS (from original idea):
${JSON.stringify(idea.catalysts, null, 2)}

Generate a DecisionBrief JSON with:
- idea_id: "${ideaId}"
- ticker: "${packet.ticker}"
- as_of: "${ctx.data.asOf}"
- verdict: one of (strong_buy, buy, hold, sell, strong_sell)
- thesis_summary: 2-3 sentence summary
- key_risks: array of { risk, probability, impact, mitigant }
- catalysts: array of { name, window, probability, expected_impact }
- position_sizing: { conviction_1_5, max_position_pct, entry_strategy, exit_triggers }

JSON output:`;

          const result = await validateWithRetry({
            schema: DecisionBriefSchema,
            schemaName: 'DecisionBrief',
            initialResponse: await llmClient.complete({
              messages: [
                { role: 'system', content: DECISION_BRIEF_SYSTEM_PROMPT },
                { role: 'user', content: briefPrompt },
              ],
              maxTokens: 2000,
              temperature: 0.5,
              jsonMode: true,
            }).then((r) => r.content),
            retryFn: async (fixPrompt) => {
              return llmClient.complete({
                messages: [
                  { role: 'system', content: DECISION_BRIEF_SYSTEM_PROMPT },
                  { role: 'user', content: briefPrompt },
                  { role: 'assistant', content: 'I will fix the JSON output.' },
                  { role: 'user', content: fixPrompt },
                ],
                maxTokens: 2000,
                temperature: 0.3,
                jsonMode: true,
              }).then((r) => r.content);
            },
          });

          if (result.success && result.data) {
            ctx.data.decisionBriefs.set(ideaId, result.data);
            console.log(`[generate_decision_briefs] Generated brief for ${packet.ticker}`);
          } else {
            console.error(`[generate_decision_briefs] Validation failed for ${packet.ticker}`);
          }
        } catch (error) {
          console.error(`[generate_decision_briefs] Failed for ${packet.ticker}:`, error);
        }
      }

      console.log(`[generate_decision_briefs] Generated ${ctx.data.decisionBriefs.size} briefs`);
    },
  };
}

/**
 * Node 5: Persist Packets
 * Save research packets and evidence to database
 */
function createPersistPacketsNode(): DAGNode {
  return {
    id: 'persist_packets',
    name: 'Persist Packets',
    dependencies: ['generate_decision_briefs'],
    timeout: 60000,
    retries: 2,
    execute: async (context: DAGContext) => {
      const ctx = context as LaneBContext;
      console.log('[persist_packets] Persisting research packets...');

      const persistedPackets: ResearchPacket[] = [];

      for (const [ideaId, packet] of ctx.data.assembledPackets) {
        const brief = ctx.data.decisionBriefs.get(ideaId);
        if (!brief) {
          console.log(`[persist_packets] Skipping ${packet.ticker} - no decision brief`);
          continue;
        }

        try {
          // Create research packet
          const newPacket: NewResearchPacket = {
            ideaId,
            ticker: packet.ticker,
            version: packet.version,
            asOf: ctx.data.asOf,
            modules: {
              business: packet.modules.business,
              industry_moat: packet.modules.industry_moat,
              financial_forensics: packet.modules.financial_forensics,
              capital_allocation: packet.modules.capital_allocation,
              management_quality: packet.modules.management_quality,
              valuation: packet.modules.valuation,
              risk_stress: packet.modules.risk_stress,
            },
            synthesizedView: packet.synthesizedView,
            decisionBrief: brief,
            status: 'complete',
          };

          const savedPacket = await researchPacketsRepository.create(newPacket);
          persistedPackets.push(savedPacket as ResearchPacket);

          // Create evidence records
          const evidenceRecords: NewEvidence[] = packet.modules.evidenceIds.map((evId, idx) => ({
            ideaId,
            ticker: packet.ticker,
            sourceType: 'api' as const,
            sourceId: evId,
            snippet: `Evidence ${idx + 1} for ${packet.ticker}`,
            retrievedAt: new Date(),
          }));

          if (evidenceRecords.length > 0) {
            await evidenceRepository.createMany(evidenceRecords);
          }

          // Update idea status to 'researched'
          await ideasRepository.updateStatus(ideaId, 'monitoring');

          console.log(`[persist_packets] Persisted packet for ${packet.ticker}`);
        } catch (error) {
          console.error(`[persist_packets] Failed to persist ${packet.ticker}:`, error);
        }
      }

      ctx.data.persistedPackets = persistedPackets;
      console.log(`[persist_packets] Persisted ${persistedPackets.length} packets`);
    },
  };
}

/**
 * Node 6: Notify User
 * Send notification about completed research
 */
function createNotifyUserNode(): DAGNode {
  return {
    id: 'notify_user',
    name: 'Notify User',
    dependencies: ['persist_packets'],
    timeout: 10000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as LaneBContext;
      console.log('[notify_user] Preparing Lane B notification...');

      const summary = {
        date: ctx.data.asOf,
        totalPackets: ctx.data.persistedPackets.length,
        byVerdict: {
          strong_buy: 0,
          buy: 0,
          hold: 0,
          sell: 0,
          strong_sell: 0,
        },
        packets: ctx.data.persistedPackets.map((p) => ({
          ticker: p.ticker,
          version: p.version,
          verdict: (p.decisionBrief as any)?.verdict ?? 'unknown',
          thesis: (p.decisionBrief as any)?.thesis_summary ?? '',
        })),
      };

      // Count by verdict
      for (const packet of ctx.data.persistedPackets) {
        const verdict = (packet.decisionBrief as any)?.verdict;
        if (verdict && verdict in summary.byVerdict) {
          summary.byVerdict[verdict as keyof typeof summary.byVerdict]++;
        }
      }

      console.log('[notify_user] Lane B Summary:', JSON.stringify(summary, null, 2));

      // TODO: Implement actual notification (email, Slack, etc.)
    },
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Create and configure the Lane B DAG
 */
export function createLaneBDAG(): DAGRunner {
  const aggregator = createDataAggregator();
  const llmClient = createResilientClient();
  const dag = createDAGRunner('daily_lane_b');

  dag.addNodes([
    createFetchPromotedIdeasNode(),
    createParallelResearchNode(aggregator, llmClient),
    createAssemblePacketsNode(llmClient),
    createGenerateDecisionBriefsNode(llmClient),
    createPersistPacketsNode(),
    createNotifyUserNode(),
  ]);

  return dag;
}

/**
 * Run Lane B
 */
export async function runLaneB(): Promise<void> {
  // Check idempotency
  const alreadyRan = await runsRepository.existsForToday('daily_lane_b');
  if (alreadyRan) {
    console.log('[lane_b] Already ran today, skipping');
    return;
  }

  // Create run record
  const run = await runsRepository.create({
    runType: 'daily_lane_b',
    status: 'running',
  });

  try {
    const dag = createLaneBDAG();
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
