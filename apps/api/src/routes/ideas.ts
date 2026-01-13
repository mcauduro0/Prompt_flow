/**
 * ARC Investment Factory - Ideas Routes
 */

import { Router, Request, Response } from 'express';
import { ideasRepository } from '@arc/database';

export const ideasRouter: Router = Router();

// GET /api/ideas - List ideas with optional status filter (for UI)
ideasRouter.get('/', async (req: Request, res: Response) => {
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

// Get ideas inbox - ALL pending review ideas (status = 'new'), regardless of date
// This is the main inbox endpoint for manual review workflow
ideasRouter.get('/inbox', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 500;
    
    // Get ALL ideas pending review (status = 'new'), not filtered by date
    const ideas = await ideasRepository.getPendingReview(limit);
    
    // Get global stats for the inbox
    const stats = await ideasRepository.countByStatus();
    
    // Group ideas by discovery date for UI display
    const byDate: Record<string, number> = {};
    ideas.forEach((idea: any) => {
      const dateStr = idea.asOf ? new Date(idea.asOf).toISOString().split('T')[0] : 'unknown';
      byDate[dateStr] = (byDate[dateStr] || 0) + 1;
    });
    
    res.json({ 
      ideas, 
      count: ideas.length,
      stats: {
        pending: stats['new'] || 0,
        promoted: stats['promoted'] || 0,
        rejected: stats['rejected'] || 0,
        monitoring: stats['monitoring'] || 0,
      },
      byDate,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get ideas for a specific date (legacy endpoint, kept for compatibility)
ideasRouter.get('/inbox/date/:date', async (req: Request, res: Response) => {
  try {
    const asOf = req.params.date;
    const limit = parseInt(req.query.limit as string) || 120;
    const ideas = await ideasRepository.getIdeaInbox(asOf, limit);
    res.json({ ideas, asOf, count: ideas.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get idea by ID
ideasRouter.get('/:ideaId', async (req: Request, res: Response) => {
  try {
    const idea = await ideasRepository.getById(req.params.ideaId);
    if (!idea) {
      res.status(404).json({ error: 'Idea not found' });
      return;
    }
    
    // Parse gate results from database format to UI format
    const dbGateResults = (idea as any).gateResults || {};
    const gateResults = {
      gate_0: dbGateResults.gate_0_data_sufficiency === 'pass',
      gate_1: dbGateResults.gate_1_coherence === 'pass',
      gate_2: dbGateResults.gate_2_edge_claim === 'pass',
      gate_3: dbGateResults.gate_3_downside_shape === 'pass',
      gate_4: dbGateResults.gate_4_style_fit === 'pass',
      // Include raw results for debugging
      raw: dbGateResults,
      // Flag if gates have been executed
      executed: Object.keys(dbGateResults).length > 0,
    };
    
    // Calculate conviction score from score object if available
    const scoreObj = (idea as any).score || {};
    const convictionScore = scoreObj.total ?? 
      (idea as any).convictionScore ?? 
      (idea as any).conviction_score ?? 
      0;
    
    // Transform to UI format with proper field mappings
    const transformed = {
      ...idea,
      // Core identification
      ticker: idea.ticker,
      company_name: (idea as any).companyName || '',
      style: (idea as any).styleTag || 'unknown',
      
      // Investment thesis content
      headline: (idea as any).oneSentenceHypothesis || '',
      one_liner: (idea as any).mechanism || '',
      
      // Scoring
      conviction_score: convictionScore,
      score_breakdown: scoreObj,
      novelty_tag: (idea as any).isNewTicker ? 'new' : 'seen_before',
      novelty_score: (idea as any).noveltyScore || null,
      direction: 'long', // Default for Lane A ideas
      
      // Gate results
      gate_results: gateResults,
      gates_executed: Object.keys(dbGateResults).length > 0,
      
      // Edge and catalysts
      edge_type: (idea as any).edgeType || [],
      catalysts: (idea as any).catalysts || [],
      signposts: (idea as any).signposts || [],
      
      // Quick metrics
      quick_metrics: (idea as any).quickMetrics || {},
      
      // Discovery metadata
      discovery_date: (idea as any).asOf,
      time_horizon: (idea as any).timeHorizon || '1_3_years',
      
      // Status
      status: idea.status,
      is_new_ticker: (idea as any).isNewTicker || false,
      whats_new_since_last_time: (idea as any).whatsNewSinceLastTime || null,
    };
    
    res.json(transformed);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ideas/:ideaId/promote - Promote single idea (for UI)
ideasRouter.post('/:ideaId/promote', async (req: Request, res: Response) => {
  try {
    const promoted = await ideasRepository.promoteIdeas([req.params.ideaId]);
    if (promoted.length === 0) {
      res.status(404).json({ error: 'Idea not found' });
      return;
    }
    res.json({ success: true, message: 'Idea promoted to research queue' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ideas/:ideaId/reject - Reject single idea (for UI)
ideasRouter.post('/:ideaId/reject', async (req: Request, res: Response) => {
  try {
    const reason = req.body.reason || 'Manual rejection';
    const idea = await ideasRepository.updateStatus(req.params.ideaId, 'rejected', reason);
    if (!idea) {
      res.status(404).json({ error: 'Idea not found' });
      return;
    }
    res.json({ success: true, message: 'Idea rejected' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get ideas by ticker
ideasRouter.get('/ticker/:ticker', async (req: Request, res: Response) => {
  try {
    const ideas = await ideasRepository.getByTicker(req.params.ticker);
    res.json({ ideas, count: ideas.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get ideas by status
ideasRouter.get('/status/:status', async (req: Request, res: Response) => {
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
ideasRouter.patch('/:ideaId/status', async (req: Request, res: Response) => {
  try {
    const { status, rejectionReason } = req.body;
    const idea = await ideasRepository.updateStatus(req.params.ideaId, status, rejectionReason);
    if (!idea) {
      res.status(404).json({ error: 'Idea not found' });
      return;
    }
    res.json(idea);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Promote ideas to Lane B (batch)
ideasRouter.post('/promote', async (req: Request, res: Response) => {
  try {
    const { ideaIds } = req.body;
    if (!Array.isArray(ideaIds) || ideaIds.length === 0) {
      res.status(400).json({ error: 'ideaIds array required' });
      return;
    }
    const promoted = await ideasRepository.promoteIdeas(ideaIds);
    res.json({ promoted, count: promoted.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get promotion candidates
ideasRouter.get('/candidates/promotion', async (req: Request, res: Response) => {
  try {
    const asOf = req.query.date as string ?? new Date().toISOString().split('T')[0];
    const candidates = await ideasRepository.getPromotionCandidates(asOf);
    res.json({ candidates, count: candidates.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get idea counts by status for a date
ideasRouter.get('/stats/:date', async (req: Request, res: Response) => {
  try {
    const counts = await ideasRepository.countByStatusForDate(req.params.date);
    res.json({ date: req.params.date, counts });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get global stats
ideasRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const counts = await ideasRepository.countByStatus();
    res.json({ counts });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
