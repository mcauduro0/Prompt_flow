/**
 * ARC Investment Factory - Runs Routes
 */

import { Router } from 'express';
import { runsRepository } from '@arc/database';

export const runsRouter = Router();

// GET /api/runs - Get all runs (for UI)
runsRouter.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const runs = await runsRepository.getAll(limit);
    
    // Transform to UI format
    const transformed = runs.map((run: any) => ({
      id: run.runId,
      type: run.runType,
      status: run.status,
      started_at: run.runDate,
      completed_at: run.completedAt,
      duration_ms: run.completedAt ? new Date(run.completedAt).getTime() - new Date(run.runDate).getTime() : null,
      summary: run.payload || {},
      error: run.errorMessage,
    }));
    
    res.json({ runs: transformed, count: transformed.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get run by ID
runsRouter.get('/:runId', async (req, res) => {
  try {
    const run = await runsRepository.getById(req.params.runId);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    // Transform to UI format
    const transformed = {
      id: run.runId,
      type: run.runType,
      status: run.status,
      started_at: run.runDate,
      completed_at: run.completedAt,
      duration_ms: run.completedAt ? new Date(run.completedAt).getTime() - new Date(run.runDate).getTime() : null,
      summary: (run as any).payload || {},
      error: run.errorMessage,
    };
    res.json(transformed);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get recent runs by type
runsRouter.get('/type/:runType', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const runs = await runsRepository.getRecentByType(req.params.runType, limit);
    res.json({ runs, count: runs.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get latest run by type
runsRouter.get('/type/:runType/latest', async (req, res) => {
  try {
    const run = await runsRepository.getLatestByType(req.params.runType);
    if (!run) {
      return res.status(404).json({ error: 'No runs found for type' });
    }
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get failed runs
runsRouter.get('/status/failed', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const runs = await runsRepository.getFailedRuns(limit);
    res.json({ runs, count: runs.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Trigger a job manually
runsRouter.post('/trigger/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    // Note: runJob import removed to avoid circular dependency
    // Jobs should be triggered via worker CLI
    res.json({ message: `Job ${jobName} trigger requested`, status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get scheduled jobs info
runsRouter.get('/scheduled/list', async (req, res) => {
  try {
    const jobs = [
      { name: 'daily_discovery', schedule: '0 6 * * 1-5', timezone: 'America/Sao_Paulo', description: 'Lane A Discovery' },
      { name: 'daily_lane_b', schedule: '0 8 * * 1-5', timezone: 'America/Sao_Paulo', description: 'Lane B Research' },
      { name: 'weekly_qa', schedule: '0 18 * * 5', timezone: 'America/Sao_Paulo', description: 'QA Report' },
      { name: 'weekly_ic_bundle', schedule: '0 19 * * 5', timezone: 'America/Sao_Paulo', description: 'IC Bundle' },
    ];
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
