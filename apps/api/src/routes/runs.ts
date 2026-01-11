/**
 * ARC Investment Factory - Runs Routes
 */

import { Router } from 'express';
import { runsRepository } from '@arc/database';
import { runJob, getScheduledJobs } from '@arc/worker';

export const runsRouter = Router();

// Get run by ID
runsRouter.get('/:runId', async (req, res) => {
  try {
    const run = await runsRepository.getById(req.params.runId);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json(run);
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

    // Start job in background
    runJob(jobName).catch((error) => {
      console.error(`Job ${jobName} failed:`, error);
    });

    res.json({ message: `Job ${jobName} triggered`, status: 'started' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get scheduled jobs
runsRouter.get('/scheduled/list', async (req, res) => {
  try {
    const jobs = getScheduledJobs();
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
