/**
 * ARC Investment Factory - Memory Routes
 * Search rejection history and idea reappearances
 */

import { Router, Request, Response } from 'express';
import { ideasRepository, noveltyStateRepository } from '@arc/database';

export const memoryRouter: Router = Router();

// GET /api/memory/search - Search memory/rejection history
memoryRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').toLowerCase().trim();
    if (!query) {
      res.json({ results: [] });
      return;
    }
    
    // Search by ticker first
    let results: any[] = [];
    
    // Try to find by ticker
    const tickerResults = await ideasRepository.getByTicker(query.toUpperCase());
    if (tickerResults.length > 0) {
      results = tickerResults;
    } else {
      // Search rejected ideas
      const rejected = await ideasRepository.getByStatus('rejected', 100);
      results = rejected.filter((idea: any) => {
        const ticker = (idea.ticker || '').toLowerCase();
        const company = (idea.companyName || idea.company_name || '').toLowerCase();
        const headline = (idea.headline || '').toLowerCase();
        return ticker.includes(query) || company.includes(query) || headline.includes(query);
      });
    }
    
    // Enrich with novelty state
    const enriched = await Promise.all(results.map(async (idea: any) => {
      const noveltyState = await noveltyStateRepository.getByTicker(idea.ticker);
      const daysSinceRejection = idea.updatedAt ? Math.floor((Date.now() - new Date(idea.updatedAt).getTime()) / (1000 * 60 * 60 * 24)) : null;
      
      return {
        id: idea.id,
        ticker: idea.ticker,
        company_name: idea.companyName || idea.company_name,
        headline: idea.headline,
        status: idea.status,
        rejection_reason: idea.rejectionReason || idea.rejection_reason,
        whats_new: idea.whatsNewSinceLastTime || idea.whats_new_since_last_time,
        reappearance_count: noveltyState?.seenCount || 0,
        last_seen: idea.updatedAt || idea.createdAt,
        days_since_rejection: daysSinceRejection,
      };
    }));
    
    res.json({ results: enriched, query });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/memory/rejections - Get recent rejections
memoryRouter.get('/rejections', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const rejections = await ideasRepository.getByStatus('rejected', limit);
    
    const results = rejections.map((idea: any) => ({
      id: idea.id,
      ticker: idea.ticker,
      company_name: idea.companyName || idea.company_name,
      headline: idea.headline,
      rejection_reason: idea.rejectionReason || idea.rejection_reason,
      rejected_at: idea.updatedAt,
    }));
    
    res.json({ rejections: results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/memory/reappearances - Get ideas that have reappeared
memoryRouter.get('/reappearances', async (req: Request, res: Response) => {
  try {
    // Get all novelty states and filter for reappearances (seenCount > 1)
    const allStates = await noveltyStateRepository.getAll();
    const reappearances = allStates.filter((s: any) => s.seenCount > 1);
    res.json({ reappearances, count: reappearances.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
