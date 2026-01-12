/**
 * ARC Investment Factory - Pipeline Integration
 * 
 * Integrates the new Prompt Orchestrator with the existing pipeline.
 * Uses feature flag USE_PROMPT_LIBRARY to switch between old and new behavior.
 */

import { getPromptOrchestrator, type OrchestratorConfig } from './orchestrator.js';
import { getPromptLibraryLoader } from './library-loader.js';

// ============================================================================
// FEATURE FLAG
// ============================================================================

export function isPromptLibraryEnabled(): boolean {
  return process.env.USE_PROMPT_LIBRARY === 'true';
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let initialized = false;

export async function initializePromptSystem(): Promise<void> {
  if (initialized) return;

  const loader = getPromptLibraryLoader();
  const orchestrator = getPromptOrchestrator();
  
  // Load prompts from JSON file
  const loadResult = loader.load();
  
  if (loadResult.success) {
    await orchestrator.initialize();
    const stats = loader.getStats();
    console.log(`[PromptSystem] Loaded ${stats.total} prompts from library`);
    initialized = true;
  } else {
    console.error(`[PromptSystem] Failed to load prompt library: ${loadResult.errors?.join(', ')}`);
    // Continue without library - will use hardcoded prompts
  }
}

// ============================================================================
// LANE A INTEGRATION
// ============================================================================

export interface LaneAResult {
  ticker: string;
  hasInvestmentPotential: boolean;
  thesis?: string;
  styleTag?: string;
  mechanism?: string;
  edgeType?: string[];
  conviction?: number;
  catalysts?: Array<{ name: string; window: string; probability?: string }>;
  keyRisks?: string[];
  timeHorizon?: string;
  gateResults?: Array<{ gate: string; pass: boolean; score: number }>;
  telemetry?: {
    total_latency_ms: number;
    total_cost: number;
    prompts_executed: number;
  };
}

/**
 * Execute Lane A discovery using the prompt library
 */
export async function executeLaneAWithLibrary(
  ticker: string,
  date?: string
): Promise<LaneAResult> {
  await initializePromptSystem();

  const orchestrator = getPromptOrchestrator();
  const result = await orchestrator.executeLaneA(ticker, date);

  // Extract results from OrchestrationResult
  const gateResults: Array<{ gate: string; pass: boolean; score: number }> = [];
  let ideaResult: Record<string, unknown> | null = null;

  let totalCost = 0;

  for (const [promptId, output] of Object.entries(result.outputs)) {
    totalCost += output.cost_estimate || 0;

    if (promptId.startsWith('gate_') && output.data) {
      const gateOutput = output.data as Record<string, unknown>;
      gateResults.push({
        gate: gateOutput.gate as string || promptId,
        pass: gateOutput.pass as boolean,
        score: gateOutput.score as number || 0,
      });
    } else if (promptId === 'lane_a_idea_generation' && output.data) {
      ideaResult = output.data as Record<string, unknown>;
    }
  }

  // Check if all gates passed
  const allGatesPassed = gateResults.length === 0 || gateResults.every((g) => g.pass);

  if (!allGatesPassed || !ideaResult) {
    return {
      ticker,
      hasInvestmentPotential: false,
      gateResults,
      telemetry: {
        total_latency_ms: result.total_latency_ms,
        total_cost: totalCost,
        prompts_executed: Object.keys(result.outputs).length,
      },
    };
  }

  return {
    ticker,
    hasInvestmentPotential: ideaResult.hasInvestmentPotential as boolean,
    thesis: ideaResult.thesis as string,
    styleTag: ideaResult.styleTag as string,
    mechanism: ideaResult.mechanism as string,
    edgeType: ideaResult.edgeType as string[],
    conviction: ideaResult.conviction as number,
    catalysts: ideaResult.catalysts as Array<{ name: string; window: string; probability?: string }>,
    keyRisks: ideaResult.keyRisks as string[],
    timeHorizon: ideaResult.timeHorizon as string,
    gateResults,
    telemetry: {
      total_latency_ms: result.total_latency_ms,
      total_cost: totalCost,
      prompts_executed: Object.keys(result.outputs).length,
    },
  };
}

// ============================================================================
// LANE B INTEGRATION
// ============================================================================

export interface LaneBResult {
  ticker: string;
  ideaId: string;
  recommendation?: string;
  conviction?: number;
  thesis?: string;
  bullCase?: string;
  bearCase?: string;
  baseCase?: string;
  priceTargets?: Record<string, unknown>;
  positionSizing?: string;
  timeHorizon?: string;
  keyMonitoringPoints?: string[];
  dissent?: string;
  modules: Record<string, unknown>;
  gateResults?: Array<{ gate: string; pass: boolean; score: number }>;
  telemetry?: {
    total_latency_ms: number;
    total_cost: number;
    prompts_executed: number;
  };
}

/**
 * Execute Lane B deep research using the prompt library
 */
export async function executeLaneBWithLibrary(
  ticker: string,
  ideaId: string,
  date?: string
): Promise<LaneBResult> {
  await initializePromptSystem();

  const orchestrator = getPromptOrchestrator();
  const result = await orchestrator.executeLaneB(ticker, ideaId, date);

  // Extract results
  const gateResults: Array<{ gate: string; pass: boolean; score: number }> = [];
  const modules: Record<string, unknown> = {};
  let synthesisResult: Record<string, unknown> | null = null;

  let totalCost = 0;

  for (const [promptId, output] of Object.entries(result.outputs)) {
    totalCost += output.cost_estimate || 0;

    if (promptId.startsWith('gate_') && output.data) {
      const gateOutput = output.data as Record<string, unknown>;
      gateResults.push({
        gate: gateOutput.gate as string || promptId,
        pass: gateOutput.pass as boolean,
        score: gateOutput.score as number || 0,
      });
    } else if (promptId === 'investment_thesis_synthesis' && output.data) {
      synthesisResult = output.data as Record<string, unknown>;
    } else if (output.data) {
      // Store module results
      const moduleOutput = output.data as Record<string, unknown>;
      const moduleName = moduleOutput.module as string || promptId;
      modules[moduleName] = moduleOutput;
    }
  }

  // Check if all gates passed
  const allGatesPassed = gateResults.length === 0 || gateResults.every((g) => g.pass);

  const baseResult: LaneBResult = {
    ticker,
    ideaId,
    modules,
    gateResults,
    telemetry: {
      total_latency_ms: result.total_latency_ms,
      total_cost: totalCost,
      prompts_executed: Object.keys(result.outputs).length,
    },
  };

  if (!allGatesPassed || !synthesisResult) {
    return baseResult;
  }

  return {
    ...baseResult,
    recommendation: synthesisResult.recommendation as string,
    conviction: synthesisResult.conviction as number,
    thesis: synthesisResult.thesis as string,
    bullCase: synthesisResult.bullCase as string,
    bearCase: synthesisResult.bearCase as string,
    baseCase: synthesisResult.baseCase as string,
    priceTargets: synthesisResult.priceTargets as Record<string, unknown>,
    positionSizing: synthesisResult.positionSizing as string,
    timeHorizon: synthesisResult.timeHorizon as string,
    keyMonitoringPoints: synthesisResult.keyMonitoringPoints as string[],
    dissent: synthesisResult.dissent as string,
  };
}

// ============================================================================
// ORCHESTRATOR STATS
// ============================================================================

export async function getOrchestratorStats(): Promise<{
  enabled: boolean;
  stats?: Awaited<ReturnType<ReturnType<typeof getPromptOrchestrator>['getStats']>>;
}> {
  if (!isPromptLibraryEnabled()) {
    return { enabled: false };
  }

  const orchestrator = getPromptOrchestrator();
  const stats = await orchestrator.getStats();

  return {
    enabled: true,
    stats,
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export function configureOrchestrator(config: Partial<OrchestratorConfig>): void {
  const orchestrator = getPromptOrchestrator();
  orchestrator.updateConfig(config);
}
