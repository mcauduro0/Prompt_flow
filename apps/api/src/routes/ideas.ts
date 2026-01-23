/**
 * ARC Investment Factory - Ideas Routes
 */
import { Router, Request, Response } from 'express';
import { ideasRepository, researchPacketsRepository } from '@arc/database';

export const ideasRouter: Router = Router();

// GET /api/ideas - List ideas with optional status filter (for UI)
ideasRouter.get('/', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 500;
    
    let ideas: any[] = [];
    if (status === 'inbox') {
      ideas = await ideasRepository.getByStatus('new', limit);
    } else if (status === 'promoted') {
      const rawIdeas = await ideasRepository.getByStatus('promoted', limit);
      
      // For promoted ideas, check if they have completed research packets
      // and add research_progress and research_status fields
      ideas = await Promise.all(
        rawIdeas.map(async (idea: any) => {
          try {
            const packet = await researchPacketsRepository.getByIdeaId(idea.ideaId);
            if (packet) {
              // Check if packet has a valid decision brief with recommendation
              const decisionBrief = (packet as any).decisionBrief || {};
              const hasValidRecommendation = decisionBrief.recommendation && 
                ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'].includes(decisionBrief.recommendation);
              const hasSynthesisFailed = decisionBrief.thesis && decisionBrief.thesis.includes('Synthesis failed');
              const hasThesis = decisionBrief.thesis && !hasSynthesisFailed;
              
              if (hasValidRecommendation && hasThesis) {
                return {
                  ...idea,
                  research_status: 'completed',
                  research_progress: 100,
                  has_research_packet: true,
                };
              } else {
                // Packet exists but synthesis not complete
                return {
                  ...idea,
                  research_status: 'in_progress',
                  research_progress: 80,
                  has_research_packet: true,
                };
              }
            }
            // No packet yet
            return {
              ...idea,
              research_status: 'queued',
              research_progress: 0,
              has_research_packet: false,
            };
          } catch (err) {
            // If error checking packet, assume queued
            return {
              ...idea,
              research_status: 'queued',
              research_progress: 0,
              has_research_packet: false,
            };
          }
        })
      );
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
      research_status: i.research_status ?? 'queued',
      research_progress: i.research_progress ?? 0,
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
    
    // Transform to UI format
    const transformed = ideas.map((i: any) => ({
      ...i,
      conviction_score: i.convictionScore ?? i.conviction_score ?? 0,
      company_name: i.companyName ?? i.company_name ?? '',
      one_liner: i.oneLiner ?? i.one_liner ?? '',
      novelty_tag: i.noveltyTag ?? i.novelty_tag ?? 'new',
      gate_results: i.gateResults ?? i.gate_results ?? {},
    }));
    
    res.json({ 
      ideas: transformed, 
      count: transformed.length,
      stats,
      byDate,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/ideas/:ideaId - Get single idea with full details
ideasRouter.get('/:ideaId', async (req: Request, res: Response) => {
  try {
    const idea = await ideasRepository.getById(req.params.ideaId);
    if (!idea) {
      res.status(404).json({ error: 'Idea not found' });
      return;
    }
    
    // Parse gate results from stored JSON
    const dbGateResults = (idea as any).gateResults || {};
    
    // Transform gate results to expected format
    const gateResults: Record<string, { passed: boolean; reason: string }> = {};
    for (const [gateName, result] of Object.entries(dbGateResults)) {
      if (typeof result === 'object' && result !== null) {
        gateResults[gateName] = {
          passed: (result as any).passed ?? false,
          reason: (result as any).reason ?? '',
        };
      }
    }
    
    // Parse score breakdown
    const scoreObj = (idea as any).scoreBreakdown || {};
    const convictionScore = (idea as any).convictionScore ?? 0;
    
    // Transform to UI format with all fields
    const transformed = {
      id: idea.ideaId,
      idea_id: idea.ideaId,
      ticker: idea.ticker,
      company_name: (idea as any).companyName || '',
      
      // Thesis and analysis
      one_liner: (idea as any).oneLiner || '',
      thesis: (idea as any).thesis || '',
      mechanism: (idea as any).mechanism || '',
      
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
    const limit = parseInt(req.query.limit as string) || 500;
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
