/**
 * ARC Investment Factory - Telemetry API Routes
 * 
 * Provides endpoints for telemetry data, budget status, and alerts.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';

const router: Router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface TelemetryStats {
  total_executions: number;
  success_rate: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  by_provider: Record<string, {
    count: number;
    tokens: number;
    cost: number;
    avg_latency: number;
  }>;
  by_prompt: Record<string, {
    count: number;
    success_rate: number;
    avg_latency: number;
  }>;
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
  alerts: Array<{
    type: 'warning' | 'critical';
    message: string;
    timestamp: string;
  }>;
}

// ============================================================================
// MOCK DATA (until telemetry tables are populated)
// ============================================================================

function getMockStats(): TelemetryStats {
  return {
    total_executions: 156,
    success_rate: 94.2,
    total_tokens: 245000,
    total_cost_usd: 12.45,
    avg_latency_ms: 2340,
    by_provider: {
      openai: { count: 120, tokens: 180000, cost: 9.50, avg_latency: 2100 },
      anthropic: { count: 36, tokens: 65000, cost: 2.95, avg_latency: 3200 },
    },
    by_prompt: {
      lane_a_idea_generation: { count: 45, success_rate: 96, avg_latency: 1800 },
      business_model_analysis: { count: 32, success_rate: 94, avg_latency: 2500 },
      valuation_analysis: { count: 28, success_rate: 92, avg_latency: 2800 },
      risk_assessment: { count: 24, success_rate: 95, avg_latency: 2400 },
      investment_thesis_synthesis: { count: 18, success_rate: 89, avg_latency: 3500 },
    },
    recent_errors: [],
  };
}

function getMockBudget(): BudgetStatus {
  const dailyLimit = Number(process.env.DAILY_BUDGET_USD) || 50;
  const monthlyLimit = Number(process.env.MONTHLY_BUDGET_USD) || 500;
  const tokenLimitPerRun = Number(process.env.TOKEN_LIMIT_PER_RUN) || 100000;
  
  const dailySpent = 12.45;
  const monthlySpent = 156.78;

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

  return {
    daily_limit_usd: dailyLimit,
    daily_spent_usd: dailySpent,
    daily_remaining_usd: Math.max(0, dailyLimit - dailySpent),
    monthly_limit_usd: monthlyLimit,
    monthly_spent_usd: monthlySpent,
    monthly_remaining_usd: Math.max(0, monthlyLimit - monthlySpent),
    token_limit_per_run: tokenLimitPerRun,
    alerts,
  };
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/telemetry/stats
 * Get aggregated telemetry statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    // TODO: Query from prompt_telemetry table when populated
    const stats = getMockStats();
    res.json(stats);
  } catch (error) {
    console.error('[Telemetry] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch telemetry stats' });
  }
});

/**
 * GET /api/telemetry/budget
 * Get current budget status and alerts
 */
router.get('/budget', async (_req: Request, res: Response) => {
  try {
    // TODO: Query from prompt_telemetry table when populated
    const budget = getMockBudget();
    res.json(budget);
  } catch (error) {
    console.error('[Telemetry] Error fetching budget:', error);
    res.status(500).json({ error: 'Failed to fetch budget status' });
  }
});

/**
 * GET /api/telemetry/executions
 * Get recent prompt executions
 */
router.get('/executions', async (_req: Request, res: Response) => {
  try {
    // TODO: Query from prompt_telemetry table when populated
    res.json({ executions: [] });
  } catch (error) {
    console.error('[Telemetry] Error fetching executions:', error);
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

/**
 * GET /api/telemetry/sources
 * Get data source status
 */
router.get('/sources', async (_req: Request, res: Response) => {
  try {
    const sources = [
      { name: 'FMP', key: 'FMP_API_KEY' },
      { name: 'Polygon', key: 'POLYGON_API_KEY' },
      { name: 'SEC EDGAR', key: null },
      { name: 'FRED', key: 'FRED_API_KEY' },
      { name: 'Reddit', key: 'REDDIT_CLIENT_ID' },
      { name: 'Twitter', key: 'TWITTER_BEARER_TOKEN' },
      { name: 'Perplexity', key: 'SONAR_API_KEY' },
      { name: 'OpenAI', key: 'OPENAI_API_KEY' },
      { name: 'Anthropic', key: 'ANTHROPIC_API_KEY' },
    ];

    const status = sources.map(s => ({
      name: s.name,
      configured: s.key === null || !!process.env[s.key],
      status: s.key === null || !!process.env[s.key] ? 'online' : 'not_configured',
    }));

    res.json({ sources: status });
  } catch (error) {
    console.error('[Telemetry] Error fetching sources:', error);
    res.status(500).json({ error: 'Failed to fetch source status' });
  }
});

/**
 * GET /api/telemetry/prompts
 * Get prompt library status
 */
router.get('/prompts', async (_req: Request, res: Response) => {
  try {
    // Return summary of loaded prompts
    res.json({
      total_prompts: 116,
      by_lane: {
        lane_a: 40,
        lane_b: 43,
        monitoring: 26,
        portfolio: 21,
      },
      by_type: {
        llm: 89,
        code: 18,
        hybrid: 9,
      },
    });
  } catch (error) {
    console.error('[Telemetry] Error fetching prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompt status' });
  }
});

export default router;
