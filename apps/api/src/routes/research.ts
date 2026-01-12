/**
 * ARC Investment Factory - Research Routes
 */

import { Router, Request, Response } from 'express';
import { researchPacketsRepository, evidenceRepository, runsRepository } from '@arc/database';
import { randomUUID } from 'crypto';

export const researchRouter: Router = Router();

// IMPORTANT: Specific routes MUST come before parameterized routes

// Trigger Lane A discovery manually
researchRouter.post('/trigger-lane-a', async (req: Request, res: Response) => {
  try {
    const dryRun = req.query.dryRun === 'true';
    const maxIdeas = parseInt(req.query.maxIdeas as string) || 10;
    
    // Create a run record to track this manual trigger
    const runId = randomUUID();
    await runsRepository.create({
      runId,
      runType: 'manual_lane_a_trigger',
      runDate: new Date(),
      status: 'running',
      payload: { dryRun, maxIdeas, triggeredAt: new Date().toISOString() },
    });
    
    res.json({ 
      message: 'Lane A discovery trigger recorded',
      runId,
      dryRun,
      maxIdeas,
      status: 'pending',
      note: 'The worker will pick this up on next scheduled run, or you can restart the worker to process immediately'
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get recent packets for IC bundle
researchRouter.get('/packets/recent', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const packets = await researchPacketsRepository.getRecentPackets(days);
    res.json({ packets, days, count: packets.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all research packets (list endpoint)
researchRouter.get('/packets', async (req: Request, res: Response) => {
  try {
    const packets = await researchPacketsRepository.getRecentPackets(30);
    res.json({ packets, count: packets.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get research packet by idea ID
researchRouter.get('/packets/idea/:ideaId', async (req: Request, res: Response) => {
  try {
    const packet = await researchPacketsRepository.getByIdeaId(req.params.ideaId);
    if (!packet) {
      res.status(404).json({ error: 'Research packet not found for idea' });
      return;
    }
    res.json(packet);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all versions for an idea
researchRouter.get('/packets/idea/:ideaId/versions', async (req: Request, res: Response) => {
  try {
    const packets = await researchPacketsRepository.getAllVersionsByIdeaId(req.params.ideaId);
    res.json({ packets, count: packets.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get research packets by ticker
researchRouter.get('/packets/ticker/:ticker', async (req: Request, res: Response) => {
  try {
    const packets = await researchPacketsRepository.getByTicker(req.params.ticker);
    res.json({ packets, count: packets.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get research packet by ID (MUST be last among /packets routes)
researchRouter.get('/packets/:packetId', async (req: Request, res: Response) => {
  try {
    const packet = await researchPacketsRepository.getById(req.params.packetId);
    if (!packet) {
      res.status(404).json({ error: 'Research packet not found' });
      return;
    }
    res.json(packet);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get evidence for an idea
researchRouter.get('/evidence/idea/:ideaId', async (req: Request, res: Response) => {
  try {
    const evidence = await evidenceRepository.getByIdeaId(req.params.ideaId);
    res.json({ evidence, count: evidence.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get evidence by ticker
researchRouter.get('/evidence/ticker/:ticker', async (req: Request, res: Response) => {
  try {
    const evidence = await evidenceRepository.getByTicker(req.params.ticker);
    res.json({ evidence, count: evidence.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get weekly packet count
researchRouter.get('/stats/weekly-count', async (req: Request, res: Response) => {
  try {
    const count = await researchPacketsRepository.countWeeklyPackets();
    res.json({ weeklyCount: count });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
