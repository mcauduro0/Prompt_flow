/**
 * ARC Investment Factory - Ideas Routes
 */

import { Router } from 'express';
import { ideasRepository } from '@arc/database';

export const ideasRouter = Router();

// GET /api/ideas - List ideas with optional status filter (for UI)
ideasRouter.get('/', async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    
    let ideas: any[] = [];
    if (status === 'inbox') {
      ideas = await ideasRepository.getByStatus('new', limit);
    } else if (status === 'promoted') {
      ideas = await ideasRepository.getByStatus('promoted', limit);
    } else if (status === 'rejected') {
      ideas = await ideasRepository.getByStatus('rejected', limit);
    } else {
      const asOf = new Date().toISOString().split('T')[0];
      ideas = await ideasRepository.getIdeaInbox(asOf, limit);
    }
    
    // Transform to UI format
    const transformed = ideas.map((i: any) => ({
      ...i,
      conviction_score: i.convictionScore ?? i.conviction_score ?? 0,
      company_name: i.companyName ?? i.company_name ?? '',
      one_liner: i.oneLiner ?? i.one_liner ?? '',
      novelty_tag: i.noveltyTag ?? i.novelty_tag ?? 'new',
      gate_results: i.gateResults ?? i.gate_results ?? {},
    }));
    
    res.json({ ideas: transformed, count: transformed.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

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
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    // Transform to UI format
    const transformed = {
      ...idea,
      conviction_score: (idea as any).convictionScore ?? (idea as any).conviction_score ?? 0,
      company_name: (idea as any).companyName ?? (idea as any).company_name ?? '',
      one_liner: (idea as any).oneLiner ?? (idea as any).one_liner ?? '',
      novelty_tag: (idea as any).noveltyTag ?? (idea as any).novelty_tag ?? 'new',
      gate_results: (idea as any).gateResults ?? (idea as any).gate_results ?? {},
    };
    res.json(transformed);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ideas/:ideaId/promote - Promote single idea (for UI)
ideasRouter.post('/:ideaId/promote', async (req, res) => {
  try {
    const promoted = await ideasRepository.promoteIdeas([req.params.ideaId]);
    if (promoted.length === 0) return res.status(404).json({ error: 'Idea not found' });
    res.json({ success: true, message: 'Idea promoted to research queue' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ideas/:ideaId/reject - Reject single idea (for UI)
ideasRouter.post('/:ideaId/reject', async (req, res) => {
  try {
    const reason = req.body.reason || 'Manual rejection';
    const idea = await ideasRepository.updateStatus(req.params.ideaId, 'rejected', reason);
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    res.json({ success: true, message: 'Idea rejected' });
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
    const idea = await ideasRepository.updateStatus(req.params.ideaId, status, rejectionReason);
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    res.json(idea);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Promote ideas to Lane B (batch)
ideasRouter.post('/promote', async (req, res) => {
  try {
    const { ideaIds } = req.body;
    if (!Array.isArray(ideaIds) || ideaIds.length === 0) return res.status(400).json({ error: 'ideaIds array required' });
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
