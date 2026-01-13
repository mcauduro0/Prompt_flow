/**
 * ARC Investment Factory - Telemetry API Routes v2
 * 
 * Enhanced endpoints with multi-LLM breakdown and institutional metrics.
 * NO MOCK DATA - all data comes from actual execution records.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { runsRepository } from '@arc/database';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const RUNS_DB_FILE = '/home/ubuntu/Prompt_flow/output/runs_db.json';
const PROMPTS_FILE = '/home/ubuntu/Prompt_flow/packages/worker/src/prompts/library/prompts_full.json';
const SMOKE_TEST_FILE = '/home/ubuntu/Prompt_flow/output/smoke_test_results.json';

function getRunsFromFile(): any[] {
  try {
    if (fs.existsSync(RUNS_DB_FILE)) {
      return JSON.parse(fs.readFileSync(RUNS_DB_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[Telemetry] Error reading runs file:', e);
  }
  return [];
}

function getPromptsFromFile(): any[] {
  try {
    if (fs.existsSync(PROMPTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf-8'));
      return data.prompts || [];
    }
  } catch (e) {
    console.error('[Telemetry] Error reading prompts file:', e);
  }
  return [];
}

function getSmokeTestResults(): any {
  try {
    if (fs.existsSync(SMOKE_TEST_FILE)) {
      return JSON.parse(fs.readFileSync(SMOKE_TEST_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[Telemetry] Error reading smoke test file:', e);
  }
  return null;
}

const router: Router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface LLMProviderStats {
  provider: string;
  model: string;
  count: number;
  tokens: number;
  cost: number;
  avg_latency_ms: number;
  success_rate: number;
}

interface InstitutionalPromptMetrics {
  prompt_id: string;
  lane: string;
  stage: string;
  model: string;
  expected_value_score: number;
  expected_cost_score: number;
  value_cost_ratio: number;
  status_institucional: string;
  execution_count: number;
  avg_cost: number;
}

interface TelemetryStatsV2 {
  total_executions: number;
  success_rate: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  
  // Multi-LLM breakdown
  by_llm: LLMProviderStats[];
  
  // By lane
  by_lane: Record<string, {
    count: number;
    tokens: number;
    cost: number;
    success_rate: number;
  }>;
  
  // Institutional metrics
  top_value_prompts: InstitutionalPromptMetrics[];
  
  // Quality metrics
  quality_metrics: {
    overall_quality_score: number;
    gate_pass_rate: number;
    ideas_generated: number;
    research_completed: number;
    avg_conviction_score: number;
  };
  
  // Lane funnel
  lane_funnel: {
    lane_a_runs: number;
    ideas_generated: number;
    ideas_promoted: number;
    lane_b_runs: number;
    research_completed: number;
    conversion_rate: number;
  };
  
  recent_errors: Array<{
    prompt_id: string;
    error: string;
    created_at: string;
  }>;
}

interface BudgetStatus {
  daily_limit_usd: number;
  daily_spent_usd: number;
  daily_remaining_usd: number;
  monthly_limit_usd: number;
  monthly_spent_usd: number;
  monthly_remaining_usd: number;
  token_limit_per_run: number;
  llm_calls_allowed: boolean;
  estimated_calls_remaining: number;
  
  // Budget by provider
  by_provider: Record<string, {
    daily_spent: number;
    monthly_spent: number;
  }>;
  
  alerts: Array<{
    type: 'warning' | 'critical';
    message: string;
    timestamp: string;
  }>;
}

// ============================================================================
// REAL DATA AGGREGATION v2
// ============================================================================

async function getRealStatsV2(timeRangeHours: number = 24): Promise<TelemetryStatsV2> {
  const cutoffDate = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
  
  // Get data sources from database
  const allRuns = await runsRepository.getAll(100);
  const recentRuns = allRuns.filter((run: any) => 
    new Date(run.runDate) >= cutoffDate
  );
  
  const prompts = getPromptsFromFile();
  const smokeTestResults = getSmokeTestResults();
  
  // Initialize aggregators
  let totalExecutions = 0;
  let successCount = 0;
  let totalTokens = 0;
  let totalCost = 0;
  let totalLatency = 0;
  
  const byLLM: Record<string, { count: number; tokens: number; cost: number; latency: number; success: number; model: string }> = {};
  const byLane: Record<string, { count: number; tokens: number; cost: number; success: number }> = {};
  const recentErrors: Array<{ prompt_id: string; error: string; created_at: string }> = [];
  
  let ideasGenerated = 0;
  let ideasPromoted = 0;
  let researchCompleted = 0;
  let totalConviction = 0;
  let convictionCount = 0;
  
  // Process runs
  for (const run of recentRuns) {
    // Handle double-stringified payload (stored as JSON string in JSONB)
    let payload = run.payload || {};
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        payload = {};
      }
    }
    totalExecutions++;
    
    if (run.status === 'completed') {
      successCount++;
    }
    
    // Get telemetry data
    const telemetry = payload.telemetry || {};
    const tokens = telemetry.total_tokens || 0;
    const cost = telemetry.total_cost || 0;
    const latency = telemetry.total_latency_ms || telemetry.duration_ms || 0;
    const provider = telemetry.provider || payload.provider || 'openai';
    const model = telemetry.model || payload.model || 'gpt-5.2-chat-latest';
    
    totalTokens += tokens;
    totalCost += cost;
    totalLatency += latency;
    
    // Track by LLM provider
    if (!byLLM[provider]) {
      byLLM[provider] = { count: 0, tokens: 0, cost: 0, latency: 0, success: 0, model };
    }
    byLLM[provider].count++;
    byLLM[provider].tokens += tokens;
    byLLM[provider].cost += cost;
    byLLM[provider].latency += latency;
    if (run.status === 'completed') {
      byLLM[provider].success++;
    }
    
    // Track by lane
    const lane = run.runType === 'daily_discovery' ? 'lane_a' : 
                 run.runType === 'lane_b_research' ? 'lane_b' : 'other';
    if (!byLane[lane]) {
      byLane[lane] = { count: 0, tokens: 0, cost: 0, success: 0 };
    }
    byLane[lane].count++;
    byLane[lane].tokens += tokens;
    byLane[lane].cost += cost;
    if (run.status === 'completed') {
      byLane[lane].success++;
    }
    
    // Track lane outcomes
    if (run.runType === 'daily_discovery') {
      ideasGenerated += payload.persisted || payload.rawIdeas || payload.ideas_count || 0;
    } else if (run.runType === 'lane_b_research') {
      if (run.status === 'completed') {
        researchCompleted++;
      }
    }
    
    // Track conviction scores
    if (payload.conviction_score) {
      totalConviction += payload.conviction_score;
      convictionCount++;
    }
    
    // Collect errors
    if (run.status === 'failed' && run.errorMessage) {
      recentErrors.push({
        prompt_id: run.runType,
        error: run.errorMessage,
        created_at: run.runDate instanceof Date ? run.runDate.toISOString() : String(run.runDate),
      });
    }
  }
  
  // Add smoke test results if available
  if (smokeTestResults && smokeTestResults.results) {
    for (const result of smokeTestResults.results) {
      const provider = result.llm_provider || 'openai';
      const model = result.llm_model || 'unknown';
      
      if (!byLLM[provider]) {
        byLLM[provider] = { count: 0, tokens: 0, cost: 0, latency: 0, success: 0, model };
      }
      byLLM[provider].count++;
      byLLM[provider].tokens += result.tokens_used || 0;
      byLLM[provider].cost += result.cost_usd || 0;
      byLLM[provider].latency += result.execution_time_ms || 0;
      if (result.status === 'pass') {
        byLLM[provider].success++;
      }
      
      totalExecutions++;
      totalTokens += result.tokens_used || 0;
      totalCost += result.cost_usd || 0;
      totalLatency += result.execution_time_ms || 0;
      if (result.status === 'pass') {
        successCount++;
      }
    }
  }
  
  // Format LLM stats
  const byLLMFormatted: LLMProviderStats[] = Object.entries(byLLM).map(([provider, data]) => ({
    provider,
    model: data.model,
    count: data.count,
    tokens: data.tokens,
    cost: data.cost,
    avg_latency_ms: data.count > 0 ? data.latency / data.count : 0,
    success_rate: data.count > 0 ? (data.success / data.count) * 100 : 0,
  }));
  
  // Format lane stats
  const byLaneFormatted: Record<string, { count: number; tokens: number; cost: number; success_rate: number }> = {};
  for (const [lane, data] of Object.entries(byLane)) {
    byLaneFormatted[lane] = {
      count: data.count,
      tokens: data.tokens,
      cost: data.cost,
      success_rate: data.count > 0 ? (data.success / data.count) * 100 : 0,
    };
  }
  
  // Get top value prompts from institutional metrics
  const topValuePrompts: InstitutionalPromptMetrics[] = prompts
    .filter((p: any) => p.expected_value_score && p.expected_cost_score)
    .map((p: any) => ({
      prompt_id: p.id,
      lane: p.lane,
      stage: p.stage,
      model: p.model,
      expected_value_score: p.expected_value_score || 0,
      expected_cost_score: p.expected_cost_score || 0,
      value_cost_ratio: p.expected_cost_score > 0 ? p.expected_value_score / p.expected_cost_score : 0,
      status_institucional: p.status_institucional || 'supporting',
      execution_count: 0,
      avg_cost: 0,
    }))
    .sort((a: any, b: any) => b.value_cost_ratio - a.value_cost_ratio)
    .slice(0, 15);
  
  // Calculate averages
  const avgLatency = totalExecutions > 0 ? totalLatency / totalExecutions : 0;
  const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;
  const avgConviction = convictionCount > 0 ? totalConviction / convictionCount : 0;
  
  // Lane funnel
  const laneARuns = byLane['lane_a']?.count || 0;
  const laneBRuns = byLane['lane_b']?.count || 0;
  const conversionRate = ideasGenerated > 0 ? (ideasPromoted / ideasGenerated) * 100 : 0;
  
  return {
    total_executions: totalExecutions,
    success_rate: successRate,
    total_tokens: totalTokens,
    total_cost_usd: totalCost,
    avg_latency_ms: avgLatency,
    
    by_llm: byLLMFormatted,
    by_lane: byLaneFormatted,
    top_value_prompts: topValuePrompts,
    
    quality_metrics: {
      overall_quality_score: successRate,
      gate_pass_rate: successRate / 100,
      ideas_generated: ideasGenerated,
      research_completed: researchCompleted,
      avg_conviction_score: avgConviction,
    },
    
    lane_funnel: {
      lane_a_runs: laneARuns,
      ideas_generated: ideasGenerated,
      ideas_promoted: ideasPromoted,
      lane_b_runs: laneBRuns,
      research_completed: researchCompleted,
      conversion_rate: conversionRate,
    },
    
    recent_errors: recentErrors.slice(0, 10),
  };
}

async function getRealBudgetV2(): Promise<BudgetStatus> {
  const dailyLimit = Number(process.env.DAILY_BUDGET_USD) || 50;
  const monthlyLimit = Number(process.env.MONTHLY_BUDGET_USD) || 500;
  const tokenLimitPerRun = Number(process.env.TOKEN_LIMIT_PER_RUN) || 100000;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  
  // Get data sources from database
  const allRuns = await runsRepository.getAll(500);
  
  // Also include smoke test results
  const smokeTestResults = getSmokeTestResults();
  
  let dailySpent = 0;
  let monthlySpent = 0;
  const byProvider: Record<string, { daily: number; monthly: number }> = {};
  
  // Process runs
  for (const run of allRuns) {
    const runDate = new Date(run.runDate);
    // Handle double-stringified payload (stored as JSON string in JSONB)
    let payload: any = run.payload || {};
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        payload = {};
      }
    }
    const cost = payload.telemetry?.total_cost || 0;
    const provider = payload.telemetry?.provider || payload.provider || 'openai';
    
    if (!byProvider[provider]) {
      byProvider[provider] = { daily: 0, monthly: 0 };
    }
    
    if (runDate >= today) {
      dailySpent += cost;
      byProvider[provider].daily += cost;
    }
    if (runDate >= monthStart) {
      monthlySpent += cost;
      byProvider[provider].monthly += cost;
    }
  }
  
  // Add smoke test costs
  if (smokeTestResults && smokeTestResults.metrics) {
    const testCost = smokeTestResults.metrics.total_cost_usd || 0;
    dailySpent += testCost;
    monthlySpent += testCost;
    
    if (smokeTestResults.by_provider) {
      for (const [provider, data] of Object.entries(smokeTestResults.by_provider as Record<string, any>)) {
        if (!byProvider[provider]) {
          byProvider[provider] = { daily: 0, monthly: 0 };
        }
        // Estimate cost per provider based on count
        const providerCost = testCost * (data.total / smokeTestResults.summary.total);
        byProvider[provider].daily += providerCost;
        byProvider[provider].monthly += providerCost;
      }
    }
  }
  
  // Generate alerts
  const alerts: BudgetStatus['alerts'] = [];
  const dailyPercentage = (dailySpent / dailyLimit) * 100;
  const monthlyPercentage = (monthlySpent / monthlyLimit) * 100;

  if (dailyPercentage >= 70) {
    alerts.push({
      type: dailyPercentage >= 90 ? 'critical' : 'warning',
      message: `Daily budget at ${dailyPercentage.toFixed(0)}%`,
      timestamp: new Date().toISOString(),
    });
  }

  if (monthlyPercentage >= 70) {
    alerts.push({
      type: monthlyPercentage >= 90 ? 'critical' : 'warning',
      message: `Monthly budget at ${monthlyPercentage.toFixed(0)}%`,
      timestamp: new Date().toISOString(),
    });
  }
  
  const llmCallsAllowed = dailySpent < dailyLimit && monthlySpent < monthlyLimit;
  const avgCostPerCall = dailySpent > 0 && allRuns.length > 0 ? dailySpent / allRuns.length : 0.05;
  const estimatedCallsRemaining = avgCostPerCall > 0 ? Math.floor((dailyLimit - dailySpent) / avgCostPerCall) : 1000;
  
  // Format by_provider
  const byProviderFormatted: Record<string, { daily_spent: number; monthly_spent: number }> = {};
  for (const [provider, data] of Object.entries(byProvider)) {
    byProviderFormatted[provider] = {
      daily_spent: data.daily,
      monthly_spent: data.monthly,
    };
  }
  
  return {
    daily_limit_usd: dailyLimit,
    daily_spent_usd: dailySpent,
    daily_remaining_usd: Math.max(0, dailyLimit - dailySpent),
    monthly_limit_usd: monthlyLimit,
    monthly_spent_usd: monthlySpent,
    monthly_remaining_usd: Math.max(0, monthlyLimit - monthlySpent),
    token_limit_per_run: tokenLimitPerRun,
    llm_calls_allowed: llmCallsAllowed,
    estimated_calls_remaining: estimatedCallsRemaining,
    by_provider: byProviderFormatted,
    alerts,
  };
}

// ============================================================================
// ROUTES
// ============================================================================

// GET /api/telemetry/stats - Get aggregated stats (v2)
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const range = req.query.range as string || '24h';
    const hours = range === '1h' ? 1 : range === '7d' ? 168 : range === '30d' ? 720 : 24;
    
    const stats = await getRealStatsV2(hours);
    res.json(stats);
  } catch (error) {
    console.error('[Telemetry] Error getting stats:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/telemetry/budget - Get budget status (v2)
router.get('/budget', async (_req: Request, res: Response) => {
  try {
    const budget = await getRealBudgetV2();
    res.json(budget);
  } catch (error) {
    console.error('[Telemetry] Error getting budget:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/telemetry/prompts - Get prompt institutional metrics
router.get('/prompts', async (_req: Request, res: Response) => {
  try {
    const prompts = getPromptsFromFile();
    
    const metrics = prompts.map((p: any) => ({
      id: p.id,
      lane: p.lane,
      stage: p.stage,
      category: p.category,
      model: p.model,
      provider: p.provider,
      expected_value_score: p.expected_value_score || 0,
      expected_cost_score: p.expected_cost_score || 0,
      value_cost_ratio: p.expected_cost_score > 0 ? (p.expected_value_score / p.expected_cost_score).toFixed(2) : '0',
      status_institucional: p.status_institucional || 'supporting',
      dependency_type: p.dependency_type || 'always',
    }));
    
    res.json({ 
      prompts: metrics,
      summary: {
        total: metrics.length,
        by_lane: {
          lane_a: metrics.filter((p: any) => p.lane === 'lane_a').length,
          lane_b: metrics.filter((p: any) => p.lane === 'lane_b').length,
          portfolio: metrics.filter((p: any) => p.lane === 'portfolio').length,
          monitoring: metrics.filter((p: any) => p.lane === 'monitoring').length,
          utility: metrics.filter((p: any) => p.lane === 'utility').length,
        },
        by_status: {
          core: metrics.filter((p: any) => p.status_institucional === 'core').length,
          supporting: metrics.filter((p: any) => p.status_institucional === 'supporting').length,
          optional: metrics.filter((p: any) => p.status_institucional === 'optional').length,
        },
        by_provider: {
          openai: metrics.filter((p: any) => p.provider === 'openai').length,
          google: metrics.filter((p: any) => p.provider === 'google').length,
          anthropic: metrics.filter((p: any) => p.provider === 'anthropic').length,
        },
      },
    });
  } catch (error) {
    console.error('[Telemetry] Error getting prompts:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/telemetry/executions - Get recent executions
router.get('/executions', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Get data sources from database
    const allRuns = await runsRepository.getAll(limit);
    
    const executions = allRuns.map((run: any) => {
      // Handle double-stringified payload (stored as JSON string in JSONB)
      let payload = run.payload || {};
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          payload = {};
        }
      }
      return {
        id: run.runId,
        run_id: run.runId,
        prompt_id: run.runType,
        execution_type: 'llm',
        provider: payload.telemetry?.provider || payload.provider || 'openai',
        model: payload.telemetry?.model || payload.model || 'gpt-5.2-chat-latest',
        input_tokens: payload.telemetry?.input_tokens || 0,
        output_tokens: payload.telemetry?.output_tokens || 0,
        latency_ms: payload.telemetry?.total_latency_ms || payload.telemetry?.duration_ms || 0,
        cost_usd: payload.telemetry?.total_cost || 0,
        success: run.status === 'completed',
        error: run.errorMessage,
        created_at: run.runDate,
      };
    });
    
    res.json({ executions });
  } catch (error) {
    console.error('[Telemetry] Error getting executions:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/telemetry/quarantine - Get quarantine stats
router.get('/quarantine', async (_req: Request, res: Response) => {
  try {
    // For now, return empty quarantine stats
    // This will be populated when quarantine system is fully integrated
    res.json({
      total: 0,
      pending: 0,
      escalated: 0,
      resolved: 0,
      byPriority: {},
      pendingRetries: 0,
    });
  } catch (error) {
    console.error('[Telemetry] Error getting quarantine:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export const telemetryRouter = router;
