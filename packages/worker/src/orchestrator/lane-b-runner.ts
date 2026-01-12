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
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LANE_B_DAILY_PROMOTIONS_MAX,
  LANE_B_WEEKLY_DEEP_PACKETS,
  LANE_B_MAX_CONCURRENCY,
  type StyleTag,
} from '@arc/shared';

// ============================================================================
// LANE B STEPS (9 total - visible in Queue UI)
// ============================================================================

export const LANE_B_STEPS = [
  { id: 'business_model', name: 'Business Model', type: 'agent', order: 1 },
  { id: 'industry_moat', name: 'Industry & Moat', type: 'agent', order: 2 },
  { id: 'financial_forensics', name: 'Financial Forensics', type: 'agent', order: 3 },
  { id: 'capital_allocation', name: 'Capital Allocation', type: 'agent', order: 4 },
  { id: 'management_quality', name: 'Management Quality', type: 'agent', order: 5 },
  { id: 'valuation', name: 'Valuation', type: 'agent', order: 6 },
  { id: 'risk_stress', name: 'Risk & Stress', type: 'agent', order: 7 },
  { id: 'synthesis', name: 'Synthesis Committee', type: 'committee', order: 8 },
  { id: 'monitoring_planner', name: 'Monitoring Planner', type: 'planner', order: 9 },
] as const;

export const TOTAL_STEPS = LANE_B_STEPS.length;

// ============================================================================
// TYPES
// ============================================================================

export interface StepProgress {
  step_id: string;
  step_name: string;
  step_type: 'agent' | 'committee' | 'planner';
  order: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  error?: string;
}

export interface PacketProgress {
  packet_id: string;
  idea_id: string;
  ticker: string;
  total_steps: number;
  completed_steps: number;
  current_step: string;
  steps: StepProgress[];
  started_at: string;
  estimated_completion?: string;
}

export interface PromotedIdea {
  ideaId: string;
  ticker: string;
  styleTag: StyleTag;
  companyName: string;
  edgeType: string;
  catalysts: string[];
}

export interface AgentResult {
  module: string;
  content: Record<string, unknown>;
  evidence: string[];
}

export interface SynthesisResult {
  oneSentenceThesis: string;
  variantPerception: {
    consensusView: string;
    ourView: string;
    whyWeDiffer: string;
    evidenceSupportingVariant: string[];
    whatWouldChangeOurMind: string[];
  };
  bullBaseBear: {
    bull: ScenarioDetail;
    base: ScenarioDetail;
    bear: ScenarioDetail;
  };
  expectedValue: {
    weightedReturn: number;
    convictionAdjustedSize: number;
  };
  keyAttributes?: {
    timeHorizon: string;
  };
}

interface ScenarioDetail {
  probability: number;
  targetPrice: number;
  description: string;
  keyAssumptions: string[];
  timeline: string;
}

export interface MonitoringResult {
  kpis: Array<{
    name: string;
    frequency: string;
    threshold: string;
    action: string;
  }>;
  preMortem: {
    topReasons: string[];
    mitigations: string[];
  };
  historicalParallels: Array<{
    company: string;
    situation: string;
    outcome: string;
    lesson: string;
  }>;
  reviewSchedule: {
    nextReview: string;
    triggers: string[];
  };
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

export function initializeProgress(idea: PromotedIdea): PacketProgress {
  return {
    packet_id: uuidv4(),
    idea_id: idea.ideaId,
    ticker: idea.ticker,
    total_steps: TOTAL_STEPS,
    completed_steps: 0,
    current_step: LANE_B_STEPS[0].id,
    steps: LANE_B_STEPS.map(step => ({
      step_id: step.id,
      step_name: step.name,
      step_type: step.type as 'agent' | 'committee' | 'planner',
      order: step.order,
      status: 'pending' as const,
    })),
    started_at: new Date().toISOString(),
  };
}

export function updateStepProgress(
  progress: PacketProgress,
  stepId: string,
  status: 'running' | 'completed' | 'failed',
  error?: string
): PacketProgress {
  const stepIndex = progress.steps.findIndex(s => s.step_id === stepId);
  if (stepIndex === -1) return progress;

  const now = new Date().toISOString();
  const step = progress.steps[stepIndex];

  if (status === 'running') {
    step.status = 'running';
    step.started_at = now;
  } else if (status === 'completed') {
    step.status = 'completed';
    step.completed_at = now;
    if (step.started_at) {
      step.duration_ms = new Date(now).getTime() - new Date(step.started_at).getTime();
    }
    progress.completed_steps++;
    if (stepIndex < LANE_B_STEPS.length - 1) {
      progress.current_step = LANE_B_STEPS[stepIndex + 1].id;
    }
  } else if (status === 'failed') {
    step.status = 'failed';
    step.error = error;
    step.completed_at = now;
  }

  return progress;
}

export function getProgressForUI(progress: PacketProgress): {
  percentage: number;
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
} {
  return {
    percentage: Math.round((progress.completed_steps / progress.total_steps) * 100),
    currentStep: progress.current_step,
    completedSteps: progress.completed_steps,
    totalSteps: progress.total_steps,
  };
}

// ============================================================================
// QUOTA MANAGEMENT
// ============================================================================

let weeklyPacketCount = 0;
let dailyPacketCount = 0;
let lastResetDate = new Date().toDateString();

export async function checkWeeklyQuota(): Promise<{
  allowed: boolean;
  remaining: number;
  used: number;
  max: number;
}> {
  // Reset weekly count on Monday
  const now = new Date();
  if (now.getDay() === 1 && now.toDateString() !== lastResetDate) {
    weeklyPacketCount = 0;
  }

  return {
    allowed: weeklyPacketCount < LANE_B_WEEKLY_DEEP_PACKETS,
    remaining: LANE_B_WEEKLY_DEEP_PACKETS - weeklyPacketCount,
    used: weeklyPacketCount,
    max: LANE_B_WEEKLY_DEEP_PACKETS,
  };
}

export async function checkDailyQuota(): Promise<{
  allowed: boolean;
  remaining: number;
  used: number;
  max: number;
}> {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyPacketCount = 0;
    lastResetDate = today;
  }

  return {
    allowed: dailyPacketCount < LANE_B_DAILY_PROMOTIONS_MAX,
    remaining: LANE_B_DAILY_PROMOTIONS_MAX - dailyPacketCount,
    used: dailyPacketCount,
    max: LANE_B_DAILY_PROMOTIONS_MAX,
  };
}

// ============================================================================
// PACKET COMPLETION CHECK
// ============================================================================

export function checkPacketCompletion(packet: Record<string, unknown>): {
  isComplete: boolean;
  missingFields: string[];
  completionPercentage: number;
} {
  const requiredFields = [
    'executive_view',
    'modules',
    'scenarios',
    'historical_parallels',
    'pre_mortem',
    'monitoring_plan',
  ];

  const missingFields: string[] = [];
  for (const field of requiredFields) {
    if (!packet[field]) {
      missingFields.push(field);
    }
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    completionPercentage: Math.round(((requiredFields.length - missingFields.length) / requiredFields.length) * 100),
  };
}

// ============================================================================
// IMMUTABLE VERSIONING
// ============================================================================

export function createImmutableVersion(packet: Record<string, unknown>): {
  version_id: string;
  packet_id: string;
  created_at: string;
  hash: string;
  data: Record<string, unknown>;
} {
  const versionId = uuidv4();
  const createdAt = new Date().toISOString();
  const hash = Buffer.from(JSON.stringify(packet)).toString('base64').slice(0, 32);

  return {
    version_id: versionId,
    packet_id: packet.packet_id as string,
    created_at: createdAt,
    hash,
    data: { ...packet },
  };
}

// ============================================================================
// PARALLEL RESEARCH (7 AGENTS)
// ============================================================================

export async function runParallelResearch(
  idea: PromotedIdea,
  progress: PacketProgress,
  onProgress: (progress: PacketProgress) => void
): Promise<AgentResult[]> {
  const agentSteps = LANE_B_STEPS.filter(s => s.type === 'agent');
  const results: AgentResult[] = [];

  // Process agents with max concurrency
  for (let i = 0; i < agentSteps.length; i += LANE_B_MAX_CONCURRENCY) {
    const batch = agentSteps.slice(i, i + LANE_B_MAX_CONCURRENCY);
    
    const batchResults = await Promise.all(
      batch.map(async (step) => {
        progress = updateStepProgress(progress, step.id, 'running');
        onProgress(progress);

        // Simulate agent work (replace with actual agent calls)
        const result = await simulateAgentWork(step.id, idea);

        progress = updateStepProgress(progress, step.id, 'completed');
        onProgress(progress);

        return result;
      })
    );

    results.push(...batchResults);
  }

  return results;
}

async function simulateAgentWork(agentId: string, idea: PromotedIdea): Promise<AgentResult> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 100));

  return {
    module: agentId,
    content: {
      summary: `Analysis for ${idea.ticker} - ${agentId}`,
      key_findings: [`Finding 1 for ${agentId}`, `Finding 2 for ${agentId}`],
    },
    evidence: [`evidence_${agentId}_1`, `evidence_${agentId}_2`],
  };
}

// ============================================================================
// SYNTHESIS COMMITTEE (EXPLICIT STEP 8)
// ============================================================================

export async function runSynthesisCommittee(
  idea: PromotedIdea,
  agentResults: AgentResult[],
  progress: PacketProgress,
  onProgress: (progress: PacketProgress) => void
): Promise<SynthesisResult> {
  progress = updateStepProgress(progress, 'synthesis', 'running');
  onProgress(progress);

  // Simulate synthesis work
  await new Promise(resolve => setTimeout(resolve, 100));

  const result: SynthesisResult = {
    oneSentenceThesis: `${idea.ticker} represents a compelling ${idea.styleTag} opportunity`,
    variantPerception: {
      consensusView: 'Market expects moderate growth',
      ourView: 'We see accelerating growth potential',
      whyWeDiffer: 'Our analysis of recent catalysts suggests underappreciated momentum',
      evidenceSupportingVariant: ['Recent earnings beat', 'Management guidance raise'],
      whatWouldChangeOurMind: ['Margin compression', 'Competitive pressure'],
    },
    bullBaseBear: {
      bull: {
        probability: 0.25,
        targetPrice: 150,
        description: 'Accelerated growth scenario',
        keyAssumptions: ['Market share gains', 'Margin expansion'],
        timeline: '18-24 months',
      },
      base: {
        probability: 0.50,
        targetPrice: 120,
        description: 'Steady growth scenario',
        keyAssumptions: ['Current trajectory continues'],
        timeline: '12-18 months',
      },
      bear: {
        probability: 0.25,
        targetPrice: 80,
        description: 'Growth slowdown scenario',
        keyAssumptions: ['Competitive pressure', 'Macro headwinds'],
        timeline: '6-12 months',
      },
    },
    expectedValue: {
      weightedReturn: 0.15,
      convictionAdjustedSize: 0.02,
    },
    keyAttributes: {
      timeHorizon: '1-2 years',
    },
  };

  progress = updateStepProgress(progress, 'synthesis', 'completed');
  onProgress(progress);

  return result;
}

// ============================================================================
// MONITORING PLANNER (EXPLICIT STEP 9)
// ============================================================================

export async function runMonitoringPlanner(
  idea: PromotedIdea,
  synthesisResult: SynthesisResult,
  progress: PacketProgress,
  onProgress: (progress: PacketProgress) => void
): Promise<MonitoringResult> {
  progress = updateStepProgress(progress, 'monitoring_planner', 'running');
  onProgress(progress);

  // Simulate monitoring planning
  await new Promise(resolve => setTimeout(resolve, 100));

  const result: MonitoringResult = {
    kpis: [
      {
        name: 'Revenue Growth',
        frequency: 'quarterly',
        threshold: '< 10%',
        action: 'Review thesis',
      },
      {
        name: 'Gross Margin',
        frequency: 'quarterly',
        threshold: '< 40%',
        action: 'Reassess competitive position',
      },
    ],
    preMortem: {
      topReasons: [
        'Competitive disruption',
        'Management execution failure',
        'Macro deterioration',
      ],
      mitigations: [
        'Monitor competitive landscape',
        'Track management changes',
        'Hedge macro exposure',
      ],
    },
    historicalParallels: [
      {
        company: 'Similar Co A',
        situation: 'Similar growth inflection',
        outcome: 'Stock doubled in 2 years',
        lesson: 'Patience required during transition',
      },
    ],
    reviewSchedule: {
      nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      triggers: ['Earnings miss', 'Management change', 'Competitive announcement'],
    },
  };

  progress = updateStepProgress(progress, 'monitoring_planner', 'completed');
  onProgress(progress);

  return result;
}

// ============================================================================
// MAIN LANE B RUNNER
// ============================================================================

export interface LaneBConfig {
  dryRun?: boolean;
  maxIdeas?: number;
}

export interface LaneBResult {
  success: boolean;
  packetsCreated: number;
  errors: string[];
  duration_ms: number;
}

export async function runDailyLaneB(config: LaneBConfig = {}): Promise<LaneBResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let packetsCreated = 0;

  try {
    // Check quotas
    const weeklyQuota = await checkWeeklyQuota();
    if (!weeklyQuota.allowed) {
      return {
        success: true,
        packetsCreated: 0,
        errors: ['Weekly quota reached'],
        duration_ms: Date.now() - startTime,
      };
    }

    const dailyQuota = await checkDailyQuota();
    if (!dailyQuota.allowed) {
      return {
        success: true,
        packetsCreated: 0,
        errors: ['Daily quota reached'],
        duration_ms: Date.now() - startTime,
      };
    }

    // In dry run mode, just return success
    if (config.dryRun) {
      return {
        success: true,
        packetsCreated: 0,
        errors: [],
        duration_ms: Date.now() - startTime,
      };
    }

    // Fetch promoted ideas (placeholder - would come from database)
    const promotedIdeas: PromotedIdea[] = [];

    // Process each idea
    const maxIdeas = Math.min(
      config.maxIdeas || LANE_B_DAILY_PROMOTIONS_MAX,
      dailyQuota.remaining,
      weeklyQuota.remaining
    );

    for (const idea of promotedIdeas.slice(0, maxIdeas)) {
      try {
        const progress = initializeProgress(idea);

        // Run parallel research
        const agentResults = await runParallelResearch(idea, progress, () => {});

        // Run synthesis
        const synthesisResult = await runSynthesisCommittee(idea, agentResults, progress, () => {});

        // Run monitoring planner
        await runMonitoringPlanner(idea, synthesisResult, progress, () => {});

        packetsCreated++;
        weeklyPacketCount++;
        dailyPacketCount++;
      } catch (error) {
        errors.push(`Failed to process ${idea.ticker}: ${error}`);
      }
    }

    return {
      success: true,
      packetsCreated,
      errors,
      duration_ms: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      packetsCreated,
      errors: [...errors, `Lane B failed: ${error}`],
      duration_ms: Date.now() - startTime,
    };
  }
}

export default {
  LANE_B_STEPS,
  TOTAL_STEPS,
  initializeProgress,
  updateStepProgress,
  getProgressForUI,
  checkWeeklyQuota,
  checkDailyQuota,
  checkPacketCompletion,
  createImmutableVersion,
  runParallelResearch,
  runSynthesisCommittee,
  runMonitoringPlanner,
  runDailyLaneB,
};
