/**
 * ARC Investment Factory - Ideas Routes
 */

import { Router } from 'express';
import { ideasRepository } from '@arc/database';

export const ideasRouter = Router();

// Get ideas inbox for today
ideasRouter.get('/inbox', async (req, res) => {
  try {
    const asOf = req.query.date as string ?? new Date().toISOString().split('T')[0];
    const limit = parseInt(req.query.limit as string) || 120;

    const ideas = await ideasRepository.getIdeaInbox(asOf, limit);
    res.json({ ideas, asOf, count: ideas.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get idea by ID
ideasRouter.get('/:ideaId', async (req, res) => {
  try {
    const idea = await ideasRepository.getById(req.params.ideaId);
    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }
    res.json(idea);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get ideas by ticker
ideasRouter.get('/ticker/:ticker', async (req, res) => {
  try {
    const ideas = await ideasRepository.getByTicker(req.params.ticker);
    res.json({ ideas, count: ideas.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get ideas by status
ideasRouter.get('/status/:status', async (req, res) => {
  try {
    const status = req.params.status as 'new' | 'monitoring' | 'promoted' | 'rejected';
    const limit = parseInt(req.query.limit as string) || 100;

    const ideas = await ideasRepository.getByStatus(status, limit);
    res.json({ ideas, status, count: ideas.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update idea status
ideasRouter.patch('/:ideaId/status', async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const idea = await ideasRepository.updateStatus(
      req.params.ideaId,
      status,
      rejectionReason
    );

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    res.json(idea);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Promote ideas to Lane B
ideasRouter.post('/promote', async (req, res) => {
  try {
    const { ideaIds } = req.body;
    if (!Array.isArray(ideaIds) || ideaIds.length === 0) {
      return res.status(400).json({ error: 'ideaIds array required' });
    }

    const promoted = await ideasRepository.promoteIdeas(ideaIds);
    res.json({ promoted, count: promoted.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get promotion candidates
ideasRouter.get('/candidates/promotion', async (req, res) => {
  try {
    const asOf = req.query.date as string ?? new Date().toISOString().split('T')[0];
    const candidates = await ideasRepository.getPromotionCandidates(asOf);
    res.json({ candidates, count: candidates.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get idea counts by status for a date
ideasRouter.get('/stats/:date', async (req, res) => {
  try {
    const counts = await ideasRepository.countByStatusForDate(req.params.date);
    res.json({ date: req.params.date, counts });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
