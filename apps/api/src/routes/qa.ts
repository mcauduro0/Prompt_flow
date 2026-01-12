/**
 * ARC Investment Factory - QA Routes
 */

import { Router } from 'express';
import { runsRepository } from '@arc/database';

export const qaRouter = Router();

// GET /api/qa - Get QA reports
qaRouter.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 8;
    // Get runs of type weekly_qa
    const runs = await runsRepository.getByType('weekly_qa', limit);
    
    // Transform to QA report format
    const reports = runs.map((run: any) => ({
      id: run.id,
      week_start: run.startedAt,
      week_end: run.completedAt,
      status: run.summary?.status || (run.status === 'completed' ? 'pass' : 'fail'),
      overall_score: run.summary?.overall_score || 0,
      sections: run.summary?.sections || [],
      drift_alarms: run.summary?.drift_alarms || [],
    }));
    
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/qa/:id - Get single QA report
qaRouter.get('/:id', async (req, res) => {
  try {
    const run = await runsRepository.getById(req.params.id);
    if (!run) return res.status(404).json({ error: 'QA report not found' });
    
    const report = {
      id: run.id,
      week_start: run.startedAt,
      week_end: run.completedAt,
      status: (run as any).summary?.status || (run.status === 'completed' ? 'pass' : 'fail'),
      overall_score: (run as any).summary?.overall_score || 0,
      sections: (run as any).summary?.sections || [],
      drift_alarms: (run as any).summary?.drift_alarms || [],
    };
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/qa/:id/json - Download QA report as JSON
qaRouter.get('/:id/json', async (req, res) => {
  try {
    const run = await runsRepository.getById(req.params.id);
    if (!run) return res.status(404).json({ error: 'QA report not found' });
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=qa-report-${req.params.id}.json`);
    res.json((run as any).summary || {});
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
