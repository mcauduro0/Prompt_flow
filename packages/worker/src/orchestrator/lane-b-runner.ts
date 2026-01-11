/**
 * ARC Investment Factory - Lane B Deep Research Runner
 * 
 * DAG: daily_lane_b
 * Schedule: 08:00 America/Sao_Paulo, weekdays only (Mon-Fri)
 * 
 * Limits (LOCKED):
 * - Daily target: 2-3 promotions
 * - Daily hard cap: 4 promotions
 * - Weekly hard cap: 10 deep packets (NOT 15)
 * - Max concurrency: 3
 * 
 * Flow:
 * 1. check_weekly_quota (MUST check before processing)
 * 2. fetch_promoted_ideas (from Lane A inbox)
 * 3. parallel_research (7 agents, max 3 concurrent)
 * 4. assemble_packets (with completion check)
 * 5. generate_decision_briefs
 * 6. persist_packets (immutable versions)
 * 7. notify_user
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LANE_B_DAILY_PROMOTIONS_TARGET,
  LANE_B_DAILY_PROMOTIONS_MAX,
  LANE_B_WEEKLY_DEEP_PACKETS,
  LANE_B_MAX_CONCURRENCY,
  LANE_B_TIME_PER_NAME_MIN,
  LANE_B_TIME_PER_NAME_MAX,
  RESEARCH_PACKET_REQUIRED_FIELDS,
  SCENARIO_REQUIREMENTS,
  THESIS_VERSIONING,
  SYSTEM_TIMEZONE,
  SCHEDULES,
  type StyleTag,
} from '@arc/shared';
import type { ResearchPacket, DecisionBrief } from '@arc/core';

// ============================================================================
// TYPES
// ============================================================================

export interface LaneBContext {
  runId: string;
  asOf: string;
  startedAt: Date;
  weeklyUsed: number;
  weeklyRemaining: number;
  dailyUsed: number;
  dailyRemaining: number;
  promotedIdeas: PromotedIdea[];
  researchResults: Map<string, AgentResult[]>;
  assembledPackets: ResearchPacket[];
  completePackets: ResearchPacket[];
  incompletePackets: ResearchPacket[];
  decisionBriefs: DecisionBrief[];
  errors: string[];
}

export interface PromotedIdea {
  ideaId: string;
  ticker: string;
  companyName: string;
  styleTag: StyleTag;
  hypothesis: string;
  edgeClarity: number;
  downsideProtection: number;
  totalScore: number;
  promotedAt: Date;
}

export interface AgentResult {
  agentName: string;
  module: string;
  content: Record<string, unknown>;
  evidenceRefs: EvidenceRef[];
  completedAt: Date;
  durationMs: number;
}

export interface EvidenceRef {
  sourceType: 'filing' | 'transcript' | 'investor_deck' | 'news' | 'dataset';
  sourceId: string;
  sourceLocator: string;
  snippet: string;
  claimType: 'numeric' | 'qualitative';
  isEstimate?: boolean;
}

export interface WeeklyQuota {
  weekStart: Date;
  weekEnd: Date;
  used: number;
  remaining: number;
  completedPacketIds: string[];
}

// ============================================================================
// WEEKLY QUOTA CHECK (MUST RUN FIRST)
// ============================================================================

/**
 * Check weekly quota BEFORE processing any ideas
 * Weekly hard cap is 10 (NOT 15)
 */
export async function checkWeeklyQuota(
  getWeeklyStats: () => Promise<{ used: number; completedIds: string[] }>
): Promise<WeeklyQuota> {
  const now = new Date();
  
  // Get start of current week (Monday)
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);
  
  // Get end of current week (Friday EOD)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 4);
  weekEnd.setHours(23, 59, 59, 999);
  
  const stats = await getWeeklyStats();
  const remaining = LANE_B_WEEKLY_DEEP_PACKETS - stats.used;
  
  console.log(`[Quota] Week: ${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`);
  console.log(`[Quota] Weekly: ${stats.used}/${LANE_B_WEEKLY_DEEP_PACKETS} used, ${remaining} remaining`);
  
  return {
    weekStart,
    weekEnd,
    used: stats.used,
    remaining: Math.max(0, remaining),
    completedPacketIds: stats.completedIds,
  };
}

/**
 * Check daily quota
 */
export async function checkDailyQuota(
  getDailyStats: () => Promise<{ used: number }>
): Promise<{ used: number; remaining: number }> {
  const stats = await getDailyStats();
  const remaining = LANE_B_DAILY_PROMOTIONS_MAX - stats.used;
  
  console.log(`[Quota] Daily: ${stats.used}/${LANE_B_DAILY_PROMOTIONS_MAX} used, ${remaining} remaining`);
  
  return {
    used: stats.used,
    remaining: Math.max(0, remaining),
  };
}

// ============================================================================
// RESEARCH PACKET COMPLETION CHECK
// ============================================================================

/**
 * Check if a ResearchPacket is complete
 * Incomplete packets do NOT count toward weekly limit
 */
export function checkPacketCompletion(packet: Partial<ResearchPacket>): {
  isComplete: boolean;
  missingFields: string[];
  validationErrors: string[];
} {
  const missingFields: string[] = [];
  const validationErrors: string[] = [];

  // Check required fields
  for (const field of RESEARCH_PACKET_REQUIRED_FIELDS) {
    if (!packet[field as keyof ResearchPacket]) {
      missingFields.push(field);
    }
  }

  // Validate bull_base_bear scenarios
  if (packet.bull_base_bear) {
    const scenarios = packet.bull_base_bear as Record<string, { probability?: number; description?: string }>;
    
    // Check all required scenarios exist
    for (const scenario of SCENARIO_REQUIREMENTS.required_scenarios) {
      if (!scenarios[scenario]) {
        validationErrors.push(`Missing ${scenario} scenario`);
      }
    }
    
    // Check probabilities sum to 1.0
    const probSum = 
      (scenarios.bull?.probability || 0) +
      (scenarios.base?.probability || 0) +
      (scenarios.bear?.probability || 0);
    
    if (Math.abs(probSum - SCENARIO_REQUIREMENTS.probability_sum) > SCENARIO_REQUIREMENTS.probability_tolerance) {
      validationErrors.push(`Scenario probabilities sum to ${probSum}, expected ${SCENARIO_REQUIREMENTS.probability_sum}`);
    }
  }

  // Validate monitoring_plan has KPIs and invalidation triggers
  const monitoringPlan = packet.monitoring_plan as { kpis?: unknown[]; invalidation_triggers?: unknown[] } | undefined;
  if (monitoringPlan) {
    if (!monitoringPlan.kpis || monitoringPlan.kpis.length === 0) {
      validationErrors.push('Monitoring plan missing KPIs');
    }
    if (!monitoringPlan.invalidation_triggers || monitoringPlan.invalidation_triggers.length === 0) {
      validationErrors.push('Monitoring plan missing invalidation triggers');
    }
  }

  const isComplete = missingFields.length === 0 && validationErrors.length === 0;

  return { isComplete, missingFields, validationErrors };
}

// ============================================================================
// IMMUTABLE VERSIONING
// ============================================================================

/**
 * Create new immutable version of a packet
 * NEVER overwrite existing versions
 */
export function createImmutableVersion(
  packet: ResearchPacket,
  previousVersion?: ResearchPacket
): ResearchPacket & { version: number; previousVersionId?: string } {
  const prevVer = previousVersion as (ResearchPacket & { version?: number }) | undefined;
  const version = prevVer?.version ? prevVer.version + 1 : 1;
  
  // Generate diff if previous version exists
  let diff: Record<string, { old: unknown; new: unknown }> | undefined;
  if (previousVersion && THESIS_VERSIONING.immutable) {
    diff = {};
    for (const field of THESIS_VERSIONING.diff_fields) {
      const oldVal = previousVersion[field as keyof ResearchPacket];
      const newVal = packet[field as keyof ResearchPacket];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[field] = { old: oldVal, new: newVal };
      }
    }
  }

  return {
    ...packet,
    packet_id: uuidv4(),
    version,
    previousVersionId: previousVersion?.packet_id,
    version_diff: diff,
    created_at: new Date().toISOString(),
  } as ResearchPacket & { version: number; previousVersionId?: string };
}

// ============================================================================
// PARALLEL RESEARCH EXECUTION
// ============================================================================

const RESEARCH_AGENTS = [
  'business_model',
  'industry_moat',
  'financial_forensics',
  'capital_allocation',
  'management_quality',
  'valuation',
  'risk_stress',
] as const;

type AgentName = typeof RESEARCH_AGENTS[number];

/**
 * Run research agents in parallel with concurrency limit
 */
export async function runParallelResearch(
  idea: PromotedIdea,
  runAgent: (agentName: AgentName, idea: PromotedIdea) => Promise<AgentResult>
): Promise<AgentResult[]> {
  const results: AgentResult[] = [];
  const agentQueue = [...RESEARCH_AGENTS];
  const inProgress: Promise<void>[] = [];

  console.log(`[Research] Starting parallel research for ${idea.ticker}`);
  console.log(`[Research] Agents: ${RESEARCH_AGENTS.join(', ')}`);
  console.log(`[Research] Max concurrency: ${LANE_B_MAX_CONCURRENCY}`);

  const processAgent = async (agentName: AgentName): Promise<void> => {
    const result = await runAgent(agentName, idea);
    results.push(result);
  };

  while (agentQueue.length > 0 || inProgress.length > 0) {
    // Start new agents up to concurrency limit
    while (inProgress.length < LANE_B_MAX_CONCURRENCY && agentQueue.length > 0) {
      const agentName = agentQueue.shift()!;
      const promise = processAgent(agentName);
      inProgress.push(promise);
    }

    // Wait for at least one to complete
    if (inProgress.length > 0) {
      await Promise.race(inProgress);
      // Remove completed promises
      const stillPending: Promise<void>[] = [];
      for (const p of inProgress) {
        const status = await Promise.race([
          p.then(() => 'done' as const),
          Promise.resolve('pending' as const),
        ]);
        if (status === 'pending') {
          stillPending.push(p);
        }
      }
      inProgress.length = 0;
      inProgress.push(...stillPending);
    }
  }

  console.log(`[Research] Completed ${results.length}/${RESEARCH_AGENTS.length} agents for ${idea.ticker}`);
  return results;
}

// ============================================================================
// MAIN LANE B RUN
// ============================================================================

export interface LaneBRunOptions {
  dryRun?: boolean;
  forceRun?: boolean;
}

export interface LaneBDependencies {
  getWeeklyStats: () => Promise<{ used: number; completedIds: string[] }>;
  getDailyStats: () => Promise<{ used: number }>;
  getPromotedIdeas: (limit: number) => Promise<PromotedIdea[]>;
  runAgent: (agentName: AgentName, idea: PromotedIdea) => Promise<AgentResult>;
  persistPacket: (packet: ResearchPacket) => Promise<void>;
  notifyUser: (briefs: DecisionBrief[]) => Promise<void>;
}

export async function runDailyLaneB(
  options: LaneBRunOptions = {},
  deps: LaneBDependencies
): Promise<LaneBContext> {
  const runId = uuidv4();
  const asOf = new Date().toISOString().split('T')[0];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Lane B] Run ${runId}`);
  console.log(`[Lane B] Date: ${asOf}`);
  console.log(`[Lane B] Timezone: ${SYSTEM_TIMEZONE}`);
  console.log(`[Lane B] Schedule: ${SCHEDULES.LANE_B_CRON} (weekdays only)`);
  console.log(`[Lane B] Daily target: ${LANE_B_DAILY_PROMOTIONS_TARGET}, cap: ${LANE_B_DAILY_PROMOTIONS_MAX}`);
  console.log(`[Lane B] Weekly cap: ${LANE_B_WEEKLY_DEEP_PACKETS}`);
  console.log(`${'='.repeat(60)}\n`);

  const context: LaneBContext = {
    runId,
    asOf,
    startedAt: new Date(),
    weeklyUsed: 0,
    weeklyRemaining: 0,
    dailyUsed: 0,
    dailyRemaining: 0,
    promotedIdeas: [],
    researchResults: new Map(),
    assembledPackets: [],
    completePackets: [],
    incompletePackets: [],
    decisionBriefs: [],
    errors: [],
  };

  try {
    // Step 1: Check weekly quota FIRST
    console.log('[Step 1] Checking weekly quota...');
    const weeklyQuota = await checkWeeklyQuota(deps.getWeeklyStats);
    context.weeklyUsed = weeklyQuota.used;
    context.weeklyRemaining = weeklyQuota.remaining;

    if (weeklyQuota.remaining === 0 && !options.forceRun) {
      console.log(`[Step 1] Weekly quota exhausted (${LANE_B_WEEKLY_DEEP_PACKETS}/${LANE_B_WEEKLY_DEEP_PACKETS}). Skipping.`);
      return context;
    }
    console.log(`[Step 1] Weekly quota OK: ${weeklyQuota.remaining} remaining\n`);

    // Step 2: Check daily quota
    console.log('[Step 2] Checking daily quota...');
    const dailyQuota = await checkDailyQuota(deps.getDailyStats);
    context.dailyUsed = dailyQuota.used;
    context.dailyRemaining = dailyQuota.remaining;

    if (dailyQuota.remaining === 0 && !options.forceRun) {
      console.log(`[Step 2] Daily quota exhausted (${LANE_B_DAILY_PROMOTIONS_MAX}/${LANE_B_DAILY_PROMOTIONS_MAX}). Skipping.`);
      return context;
    }
    console.log(`[Step 2] Daily quota OK: ${dailyQuota.remaining} remaining\n`);

    // Calculate how many to process
    const toProcess = Math.min(
      dailyQuota.remaining,
      weeklyQuota.remaining,
      LANE_B_DAILY_PROMOTIONS_TARGET
    );
    console.log(`[Lane B] Will process up to ${toProcess} ideas\n`);

    // Step 3: Fetch promoted ideas
    console.log('[Step 3] Fetching promoted ideas...');
    context.promotedIdeas = await deps.getPromotedIdeas(toProcess);
    console.log(`[Step 3] Found ${context.promotedIdeas.length} promoted ideas\n`);

    if (context.promotedIdeas.length === 0) {
      console.log('[Lane B] No promoted ideas to process. Done.');
      return context;
    }

    // Step 4: Run parallel research for each idea
    console.log('[Step 4] Running parallel research...');
    for (const idea of context.promotedIdeas) {
      console.log(`\n[Research] Processing ${idea.ticker}...`);
      const startTime = Date.now();
      
      const results = await runParallelResearch(idea, deps.runAgent);
      context.researchResults.set(idea.ideaId, results);
      
      const duration = (Date.now() - startTime) / 1000 / 60;
      console.log(`[Research] ${idea.ticker} completed in ${duration.toFixed(1)} minutes`);
      
      if (duration < LANE_B_TIME_PER_NAME_MIN) {
        console.log(`[Research] Warning: ${idea.ticker} completed faster than minimum (${LANE_B_TIME_PER_NAME_MIN}min)`);
      }
      if (duration > LANE_B_TIME_PER_NAME_MAX) {
        console.log(`[Research] Warning: ${idea.ticker} exceeded maximum time (${LANE_B_TIME_PER_NAME_MAX}min)`);
      }
    }
    console.log(`\n[Step 4] Research completed for ${context.promotedIdeas.length} ideas\n`);

    // Step 5: Assemble packets and check completion
    console.log('[Step 5] Assembling packets and checking completion...');
    for (const idea of context.promotedIdeas) {
      const results = context.researchResults.get(idea.ideaId) || [];
      
      const packet = assemblePacket(idea, results);
      context.assembledPackets.push(packet);
      
      const { isComplete, missingFields, validationErrors } = checkPacketCompletion(packet);
      
      if (isComplete) {
        context.completePackets.push(packet);
        console.log(`  [COMPLETE] ${idea.ticker}`);
      } else {
        context.incompletePackets.push(packet);
        console.log(`  [INCOMPLETE] ${idea.ticker}: Missing ${missingFields.join(', ')}`);
        if (validationErrors.length > 0) {
          console.log(`    Errors: ${validationErrors.join(', ')}`);
        }
      }
    }
    console.log(`\n[Step 5] Complete: ${context.completePackets.length}, Incomplete: ${context.incompletePackets.length}\n`);

    // Step 6: Generate decision briefs for complete packets
    console.log('[Step 6] Generating decision briefs...');
    for (const packet of context.completePackets) {
      const brief = generateDecisionBrief(packet);
      context.decisionBriefs.push(brief);
    }
    console.log(`[Step 6] Generated ${context.decisionBriefs.length} decision briefs\n`);

    // Step 7: Persist packets (immutable versions)
    if (!options.dryRun) {
      console.log('[Step 7] Persisting packets (immutable)...');
      for (const packet of context.completePackets) {
        const versionedPacket = createImmutableVersion(packet);
        await deps.persistPacket(versionedPacket);
        console.log(`  [PERSISTED] ${packet.ticker} v${(versionedPacket as any).version}`);
      }
      console.log(`[Step 7] Persisted ${context.completePackets.length} packets\n`);
    }

    // Step 8: Notify user
    console.log('[Step 8] Sending notification...');
    if (!options.dryRun && context.decisionBriefs.length > 0) {
      await deps.notifyUser(context.decisionBriefs);
    }
    console.log('[Step 8] Notification sent\n');

    console.log(`${'='.repeat(60)}`);
    console.log(`[Lane B] Run ${runId} COMPLETED`);
    console.log(`[Lane B] Complete packets: ${context.completePackets.length}`);
    console.log(`[Lane B] Incomplete packets: ${context.incompletePackets.length}`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    context.errors.push(errorMsg);
    console.error(`[Lane B] Run ${runId} FAILED: ${errorMsg}`);
  }

  return context;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function assemblePacket(idea: PromotedIdea, results: AgentResult[]): ResearchPacket {
  const packet: Record<string, unknown> = {
    packet_id: uuidv4(),
    idea_id: idea.ideaId,
    ticker: idea.ticker,
    company_name: idea.companyName,
    style_tag: idea.styleTag,
    as_of: new Date().toISOString().split('T')[0],
    status: 'draft',
  };

  for (const result of results) {
    switch (result.agentName) {
      case 'business_model':
        packet.business_model = result.content;
        break;
      case 'industry_moat':
        packet.industry_moat = result.content;
        break;
      case 'financial_forensics':
        packet.financial_forensics = result.content;
        break;
      case 'capital_allocation':
        packet.capital_allocation = result.content;
        break;
      case 'management_quality':
        packet.management_quality = result.content;
        break;
      case 'valuation':
        packet.valuation = result.content;
        break;
      case 'risk_stress':
        packet.risk_stress = result.content;
        break;
    }
  }

  packet.evidence_refs = results.flatMap(r => r.evidenceRefs.map(e => ({
    source_type: e.sourceType,
    source_id: e.sourceId,
    source_locator: e.sourceLocator,
    snippet: e.snippet,
    claim_type: e.claimType,
    is_estimate: e.isEstimate,
  })));

  return packet as unknown as ResearchPacket;
}

function generateDecisionBrief(packet: ResearchPacket): DecisionBrief {
  const bullBaseBear = packet.bull_base_bear as Record<string, { description?: string }> | undefined;
  
  return {
    brief_id: uuidv4(),
    packet_id: packet.packet_id,
    ticker: packet.ticker,
    company_name: packet.company_name,
    style_tag: packet.style_tag,
    recommendation: 'watch',
    one_liner: `${packet.ticker} - ${packet.company_name}`,
    bull_case_summary: bullBaseBear?.bull?.description || '',
    bear_case_summary: bullBaseBear?.bear?.description || '',
    key_metrics: [],
    next_steps: [],
    generated_at: new Date().toISOString(),
  } as DecisionBrief;
}

export default runDailyLaneB;
