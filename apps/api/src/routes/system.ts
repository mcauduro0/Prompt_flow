/**
 * ARC Investment Factory - System API
 * Endpoints for system status, data providers, run history, and manual lane triggers
 * 
 * Updated: 2026-01-18
 * - Added manual trigger endpoints for all lanes (0, A, B, C)
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { runsRepository, ideasRepository } from '@arc/database';
import {
  LANE_0_DAILY_LIMIT,
  LANE_0_MAX_IDEAS_PER_SOURCE,
  LANE_A_DAILY_TARGET,
  LANE_B_DAILY_LIMIT,
} from '@arc/shared';

export const systemRouter: Router = Router();

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const RUNS_DB_FILE = path.join(__dirname, '../../../../output/runs_db.json');
const ENV_FILE = path.join(__dirname, '../../../../.env');

interface DataProviderStatus {
  name: string;
  status: 'connected' | 'error' | 'not_configured';
  last_check: string;
  requests_today: number;
  rate_limit: number;
  error_message?: string;
}

interface RunRecord {
  run_id: string;
  lane: string;
  ticker?: string;
  status: 'completed' | 'failed' | 'running';
  started_at: string;
  completed_at?: string;
  duration_ms: number;
  tokens_used: number;
  cost_usd: number;
  prompts_executed: number;
  ideas_generated?: number;
  error_message?: string;
}

// ============================================================================
// MANUAL LANE TRIGGER ENDPOINTS
// ============================================================================

/**
 * POST /api/system/trigger-lane-0
 * Trigger manual Lane 0 execution (Substack + Reddit Ingestion)
 */
systemRouter.post('/trigger-lane-0', async (req: Request, res: Response) => {
  try {
    const { maxIdeasPerSource, maxIdeasToLaneA, dryRun } = req.body;
    
    // Check if there's already a running Lane 0 job
    const existingRuns = await runsRepository.getByType('manual_lane_0_trigger', 5);
    const runningJob = existingRuns.find(r => r.status === 'running' || r.status === 'pending');
    
    if (runningJob) {
      res.status(409).json({
        error: 'Lane 0 is already running',
        runId: runningJob.runId,
        status: runningJob.status,
      });
      return;
    }
    
    // Create a new run record
    const runId = randomUUID();
    await runsRepository.create({
      runId,
      runType: 'manual_lane_0_trigger',
      status: 'pending',
      payload: {
        maxIdeasPerSource: maxIdeasPerSource || LANE_0_MAX_IDEAS_PER_SOURCE,
        maxIdeasToLaneA: maxIdeasToLaneA || LANE_0_DAILY_LIMIT,
        dryRun: dryRun || false,
        triggeredAt: new Date().toISOString(),
        source: 'api_manual_trigger',
      },
    });
    
    console.log(`[System API] Lane 0 manual trigger created: ${runId}`);
    
    res.json({
      success: true,
      message: 'Lane 0 ingestion trigger recorded',
      runId,
      lane: 'lane_0',
      description: 'Substack + Reddit Ingestion',
    });
  } catch (error) {
    console.error('[System API] Error triggering Lane 0:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/system/trigger-lane-a
 * Trigger manual Lane A execution (Daily Discovery)
 */
systemRouter.post('/trigger-lane-a', async (req: Request, res: Response) => {
  try {
    const { maxIdeas, dryRun } = req.body;
    
    // Check if there's already a running Lane A job
    const existingRuns = await runsRepository.getByType('manual_lane_a_trigger', 5);
    const runningJob = existingRuns.find(r => r.status === 'running' || r.status === 'pending');
    
    if (runningJob) {
      res.status(409).json({
        error: 'Lane A is already running',
        runId: runningJob.runId,
        status: runningJob.status,
      });
      return;
    }
    
    // Create a new run record
    const runId = randomUUID();
    await runsRepository.create({
      runId,
      runType: 'manual_lane_a_trigger',
      status: 'pending',
      payload: {
        maxIdeas: maxIdeas || LANE_A_DAILY_TARGET,
        dryRun: dryRun || false,
        triggeredAt: new Date().toISOString(),
        source: 'api_manual_trigger',
      },
    });
    
    console.log(`[System API] Lane A manual trigger created: ${runId}`);
    
    res.json({
      success: true,
      message: 'Lane A discovery trigger recorded',
      runId,
      lane: 'lane_a',
      description: 'Daily Discovery & Scoring',
    });
  } catch (error) {
    console.error('[System API] Error triggering Lane A:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/system/trigger-lane-b
 * Trigger manual Lane B execution (Deep Research for all queued ideas)
 */
systemRouter.post('/trigger-lane-b', async (req: Request, res: Response) => {
  try {
    const { maxPackets, ideaIds } = req.body;
    
    // Check if there's already a running Lane B job
    const existingRuns = await runsRepository.getByType('manual_lane_b_trigger', 5);
    const batchRuns = await runsRepository.getByType('manual_lane_b_batch_trigger', 5);
    const allRuns = [...existingRuns, ...batchRuns];
    const runningJob = allRuns.find(r => r.status === 'running' || r.status === 'pending');
    
    if (runningJob) {
      res.status(409).json({
        error: 'Lane B is already running',
        runId: runningJob.runId,
        status: runningJob.status,
      });
      return;
    }
    
    // Get promoted ideas if not provided
    let targetIdeaIds = ideaIds;
    if (!targetIdeaIds || targetIdeaIds.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const promotedIdeas = await ideasRepository.getPromotedForDate(today);
      targetIdeaIds = promotedIdeas.slice(0, maxPackets || LANE_B_DAILY_LIMIT).map((idea: any) => idea.ideaId);
    }
    
    if (targetIdeaIds.length === 0) {
      res.status(400).json({
        error: 'No promoted ideas available for research',
        message: 'Run Lane A first to promote ideas, or specify ideaIds manually',
      });
      return;
    }
    
    // Create a new run record
    const runId = randomUUID();
    await runsRepository.create({
      runId,
      runType: 'manual_lane_b_trigger',
      status: 'pending',
      payload: {
        ideaIds: targetIdeaIds,
        maxPackets: maxPackets || LANE_B_DAILY_LIMIT,
        totalIdeas: targetIdeaIds.length,
        triggeredAt: new Date().toISOString(),
        source: 'api_manual_trigger',
      },
    });
    
    console.log(`[System API] Lane B manual trigger created: ${runId} with ${targetIdeaIds.length} ideas`);
    
    res.json({
      success: true,
      message: `Lane B research trigger recorded for ${targetIdeaIds.length} ideas`,
      runId,
      lane: 'lane_b',
      description: 'Deep Research',
      ideaCount: targetIdeaIds.length,
    });
  } catch (error) {
    console.error('[System API] Error triggering Lane B:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/system/trigger-lane-c
 * Trigger manual Lane C execution (IC Bundle Generation)
 */
systemRouter.post('/trigger-lane-c', async (req: Request, res: Response) => {
  try {
    const { dryRun, minConviction } = req.body;
    
    // Check if there's already a running Lane C job
    const existingRuns = await runsRepository.getByType('manual_lane_c_trigger', 5);
    const runningJob = existingRuns.find(r => r.status === 'running' || r.status === 'pending');
    
    if (runningJob) {
      res.status(409).json({
        error: 'Lane C is already running',
        runId: runningJob.runId,
        status: runningJob.status,
      });
      return;
    }
    
    // Create a new run record
    const runId = randomUUID();
    await runsRepository.create({
      runId,
      runType: 'manual_lane_c_trigger',
      status: 'pending',
      payload: {
        dryRun: dryRun || false,
        minConviction: minConviction || 6,
        triggeredAt: new Date().toISOString(),
        source: 'api_manual_trigger',
      },
    });
    
    console.log(`[System API] Lane C manual trigger created: ${runId}`);
    
    res.json({
      success: true,
      message: 'Lane C IC Bundle trigger recorded',
      runId,
      lane: 'lane_c',
      description: 'IC Bundle Generation',
    });
  } catch (error) {
    console.error('[System API] Error triggering Lane C:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/system/lane-status
 * Get the current status of all lanes (running, idle, last run info)
 */
systemRouter.get('/lane-status', async (req: Request, res: Response) => {
  try {
    // Get recent runs for each lane type
    const [lane0Runs, laneARuns, laneBRuns, laneCRuns] = await Promise.all([
      runsRepository.getByType('manual_lane_0_trigger', 5),
      runsRepository.getByType('manual_lane_a_trigger', 5),
      runsRepository.getByType('manual_lane_b_trigger', 5),
      runsRepository.getByType('manual_lane_c_trigger', 5),
    ]);
    
    // Also check scheduled runs
    const [scheduledLane0, scheduledLaneA, scheduledLaneB, scheduledLaneC] = await Promise.all([
      runsRepository.getLatestByType('lane_0_ingestion'),
      runsRepository.getLatestByType('daily_discovery'),
      runsRepository.getLatestByType('lane_b_research'),
      runsRepository.getLatestByType('ic_bundle'),
    ]);
    
    const getLaneStatus = (manualRuns: any[], scheduledRun: any, laneName: string) => {
      const runningManual = manualRuns.find(r => r.status === 'running' || r.status === 'pending');
      const lastManual = manualRuns.find(r => r.status === 'completed' || r.status === 'failed');
      
      // Determine if currently running
      const isRunning = !!runningManual;
      
      // Get last completed run (manual or scheduled)
      let lastRun = null;
      if (lastManual && scheduledRun) {
        lastRun = new Date(lastManual.completedAt || lastManual.runDate) > new Date(scheduledRun.completedAt || scheduledRun.runDate)
          ? lastManual
          : scheduledRun;
      } else {
        lastRun = lastManual || scheduledRun;
      }
      
      return {
        lane: laneName,
        status: isRunning ? 'running' : 'idle',
        currentRunId: runningManual?.runId || null,
        lastRun: lastRun ? {
          runId: lastRun.runId,
          status: lastRun.status,
          completedAt: lastRun.completedAt,
          type: lastRun.runType?.includes('manual') ? 'manual' : 'scheduled',
        } : null,
      };
    };
    
    res.json({
      lanes: {
        lane_0: getLaneStatus(lane0Runs, scheduledLane0, 'lane_0'),
        lane_a: getLaneStatus(laneARuns, scheduledLaneA, 'lane_a'),
        lane_b: getLaneStatus(laneBRuns, scheduledLaneB, 'lane_b'),
        lane_c: getLaneStatus(laneCRuns, scheduledLaneC, 'lane_c'),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[System API] Error getting lane status:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/system/recent-runs
 * Get recent runs across all lanes (manual and scheduled)
 */
systemRouter.get('/recent-runs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Get recent runs from all types
    const runTypes = [
      'manual_lane_0_trigger',
      'manual_lane_a_trigger',
      'manual_lane_b_trigger',
      'manual_lane_c_trigger',
      'lane_0_ingestion',
      'daily_discovery',
      'lane_b_research',
      'ic_bundle',
    ];
    
    const allRuns: any[] = [];
    
    for (const runType of runTypes) {
      const runs = await runsRepository.getRecentByType(runType, 10);
      allRuns.push(...runs);
    }
    
    // Sort by date descending and limit
    allRuns.sort((a, b) => new Date(b.runDate).getTime() - new Date(a.runDate).getTime());
    const recentRuns = allRuns.slice(0, limit);
    
    // Transform to UI format
    const transformed = recentRuns.map(run => {
      let lane = 'unknown';
      let description = '';
      
      if (run.runType.includes('lane_0')) {
        lane = 'lane_0';
        description = 'Substack + Reddit Ingestion';
      } else if (run.runType.includes('lane_a') || run.runType === 'daily_discovery') {
        lane = 'lane_a';
        description = 'Daily Discovery';
      } else if (run.runType.includes('lane_b')) {
        lane = 'lane_b';
        description = 'Deep Research';
      } else if (run.runType.includes('lane_c') || run.runType === 'ic_bundle') {
        lane = 'lane_c';
        description = 'IC Bundle';
      }
      
      return {
        runId: run.runId,
        lane,
        description,
        type: run.runType.includes('manual') ? 'manual' : 'scheduled',
        status: run.status,
        startedAt: run.runDate,
        completedAt: run.completedAt,
        durationMs: run.completedAt 
          ? new Date(run.completedAt).getTime() - new Date(run.runDate).getTime()
          : null,
        payload: run.payload,
        error: run.errorMessage,
      };
    });
    
    res.json({
      runs: transformed,
      count: transformed.length,
    });
  } catch (error) {
    console.error('[System API] Error getting recent runs:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// EXISTING ENDPOINTS (unchanged)
// ============================================================================

// GET /api/system/status - Get overall system status
systemRouter.get('/status', async (req, res) => {
  try {
    // Check environment variables for API keys
    const envVars = process.env;
    
    const providers: DataProviderStatus[] = [
      {
        name: 'OpenAI (GPT-5.2)',
        status: envVars.OPENAI_API_KEY ? 'connected' : 'not_configured',
        last_check: new Date().toISOString(),
        requests_today: 0,
        rate_limit: 10000,
      },
      {
        name: 'Google (Gemini 2.5)',
        status: envVars.GEMINI_API_KEY ? 'connected' : 'not_configured',
        last_check: new Date().toISOString(),
        requests_today: 0,
        rate_limit: 1500,
      },
      {
        name: 'Anthropic (Claude Opus 4)',
        status: envVars.ANTHROPIC_API_KEY ? 'connected' : 'not_configured',
        last_check: new Date().toISOString(),
        requests_today: 0,
        rate_limit: 4000,
      },
      {
        name: 'Polygon.io',
        status: envVars.POLYGON_API_KEY ? 'connected' : 'not_configured',
        last_check: new Date().toISOString(),
        requests_today: 0,
        rate_limit: 5000,
      },
      {
        name: 'FMP (Financial Modeling Prep)',
        status: envVars.FMP_API_KEY ? 'connected' : 'not_configured',
        last_check: new Date().toISOString(),
        requests_today: 0,
        rate_limit: 250,
      },
      {
        name: 'Perplexity (Sonar)',
        status: envVars.SONAR_API_KEY ? 'connected' : 'not_configured',
        last_check: new Date().toISOString(),
        requests_today: 0,
        rate_limit: 1000,
      },
    ];
    
    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      providers,
      version: '1.0.0',
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// GET /api/system/providers - Get data provider information
systemRouter.get('/providers', async (req, res) => {
  try {
    const llmProviders = [
      {
        name: 'OpenAI',
        model: 'gpt-5.2-pro',
        status: 'active',
        capabilities: ['Text generation', 'Code analysis', 'Reasoning'],
      },
      {
        name: 'Google',
        model: 'gemini-2.5-flash',
        status: 'active',
        capabilities: ['Text generation', 'Multimodal', 'Long context'],
      },
      {
        name: 'Anthropic',
        model: 'claude-opus-4',
        status: 'active',
        capabilities: ['Text generation', 'Analysis', 'Coding'],
      },
      {
        name: 'Perplexity',
        model: 'sonar-pro',
        status: 'active',
        capabilities: ['Web search', 'Real-time data', 'Citations'],
      },
    ];
    
    const dataProviders = [
      {
        name: 'Polygon.io',
        type: 'Market Data',
        status: 'active',
        capabilities: ['Stock prices', 'Options', 'Forex', 'Crypto'],
      },
      {
        name: 'Financial Modeling Prep',
        type: 'Fundamentals',
        status: 'active',
        capabilities: ['Financials', 'Ratios', 'SEC filings', 'Screener'],
      },
      {
        name: 'Substack',
        type: 'Content Ingestion',
        status: 'active',
        capabilities: ['Newsletter parsing', 'Idea extraction', 'Valuation data'],
      },
      {
        name: 'Reddit',
        type: 'Social Sentiment',
        status: 'active',
        capabilities: ['WSB sentiment', 'Trending tickers', 'Discussion analysis'],
      },
    ];
    
    res.json({
      llm_providers: llmProviders,
      data_providers: dataProviders,
    });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// GET /api/system/runs - Get run history
systemRouter.get('/runs', async (req, res) => {
  try {
    const { lane, status, limit = 50 } = req.query;
    
    let runs: RunRecord[] = [];
    
    if (fs.existsSync(RUNS_DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(RUNS_DB_FILE, 'utf-8'));
      runs = data.runs || [];
    }
    
    // Also check output directory for run files
    const outputDir = path.join(__dirname, '../../../../output');
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      const runFiles = files.filter(f => f.startsWith('lane_') && f.endsWith('.json'));
      
      for (const file of runFiles) {
        try {
          const runData = JSON.parse(fs.readFileSync(path.join(outputDir, file), 'utf-8'));
          const existingRun = runs.find(r => r.run_id === runData.run_id);
          
          if (!existingRun && runData.run_id) {
            runs.push({
              run_id: runData.run_id,
              lane: runData.lane || (file.includes('lane_a') ? 'lane_a' : 'lane_b'),
              ticker: runData.ticker,
              status: runData.status || 'completed',
              started_at: runData.started_at || runData.timestamp,
              completed_at: runData.completed_at,
              duration_ms: runData.duration_ms || runData.execution_time_ms || 0,
              tokens_used: runData.tokens_used || runData.telemetry?.tokens_used || 0,
              cost_usd: runData.cost_usd || runData.telemetry?.cost_usd || 0,
              prompts_executed: runData.prompts_executed || 1,
              ideas_generated: runData.ideas?.length || runData.ideas_generated,
            });
          }
        } catch {
          // Skip invalid files
        }
      }
    }
    
    // Sort by date descending
    runs.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    
    // Apply filters
    let filtered = runs;
    
    if (lane && lane !== 'all') {
      filtered = filtered.filter(r => r.lane === lane);
    }
    
    if (status && status !== 'all') {
      filtered = filtered.filter(r => r.status === status);
    }
    
    // Apply limit
    filtered = filtered.slice(0, Number(limit));
    
    // Calculate stats
    const stats = {
      total_runs: runs.length,
      completed: runs.filter(r => r.status === 'completed').length,
      failed: runs.filter(r => r.status === 'failed').length,
      total_tokens: runs.reduce((sum, r) => sum + r.tokens_used, 0),
      total_cost: runs.reduce((sum, r) => sum + r.cost_usd, 0),
      avg_duration_ms: runs.length > 0 
        ? runs.reduce((sum, r) => sum + r.duration_ms, 0) / runs.length 
        : 0,
    };
    
    res.json({
      runs: filtered,
      stats,
    });
  } catch (error) {
    console.error('Error fetching runs:', error);
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

// GET /api/system/runs/:id - Get single run details
systemRouter.get('/runs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check output directory for the run file
    const outputDir = path.join(__dirname, '../../../../output');
    const files = fs.readdirSync(outputDir);
    const runFile = files.find(f => f.includes(id) && f.endsWith('.json'));
    
    if (runFile) {
      const runData = JSON.parse(fs.readFileSync(path.join(outputDir, runFile), 'utf-8'));
      return res.json({ run: runData });
    }
    
    // Check runs_db
    if (fs.existsSync(RUNS_DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(RUNS_DB_FILE, 'utf-8'));
      const run = (data.runs || []).find((r: RunRecord) => r.run_id === id);
      if (run) {
        return res.json({ run });
      }
    }
    
    res.status(404).json({ error: 'Run not found' });
  } catch (error) {
    console.error('Error fetching run:', error);
    res.status(500).json({ error: 'Failed to fetch run' });
  }
});

// GET /api/system/logs - Get recent system logs
systemRouter.get('/logs', async (req, res) => {
  try {
    const { level = 'all', limit = 100 } = req.query;
    
    // For now, return empty logs - would integrate with actual logging system
    const logs: { timestamp: string; level: string; message: string; source: string }[] = [];
    
    res.json({
      logs,
      filters: {
        levels: ['info', 'warning', 'error', 'debug'],
      },
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});
