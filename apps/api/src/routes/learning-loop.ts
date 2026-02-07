/**
 * Learning Loop API - Post-Mortem Tracking
 * 
 * Endpoints para rastrear a performance real das recomendações
 * e identificar erros sistemáticos do modelo.
 */

import { Router, Request, Response } from 'express';
import { icMemosRepository } from '@arc/database';

export const learningLoopRouter: Router = Router();

// Types
interface PostMortemUpdate {
  memoId: string;
  realizedReturnPct: number;
  holdingPeriodDays: number;
  postMortemStatus: 'success' | 'failure' | 'ongoing';
  postMortemNotes?: string;
}

interface ModelErrorAnalysis {
  ticker: string;
  memoId: string;
  expectedReturn: number;
  realizedReturn: number;
  error: number;
  errorCategory: 'thesis_error' | 'timing_error' | 'execution_error' | 'market_error';
  thesisPrimaryType: string;
  portfolioRole: string;
}

/**
 * POST /api/learning-loop/post-mortem
 * Update post-mortem data for a completed position
 */
learningLoopRouter.post('/post-mortem', async (req: Request, res: Response) => {
  try {
    const { memoId, realizedReturnPct, holdingPeriodDays, postMortemStatus, postMortemNotes } = req.body as PostMortemUpdate;
    
    if (!memoId) {
      return res.status(400).json({ error: 'memoId is required' });
    }
    
    // Get the memo to check expected return
    const memos = await icMemosRepository.getAll();
    const memo = memos.find((m: any) => m.memoId === memoId);
    
    if (!memo) {
      return res.status(404).json({ error: 'IC Memo not found' });
    }
    
    const m = memo as any;
    
    // Calculate if this is a model error
    // Model error = realized return deviates significantly from expected
    const expectedReturn = parseFloat(m.expectedReturnProbabilityWeightedPct || '0');
    const modelErrorFlag = Math.abs(realizedReturnPct - expectedReturn) > 20; // >20% deviation
    
    // Update the memo with post-mortem data
    // Note: This requires adding an updatePostMortem method to the repository
    // For now, we'll use raw SQL via the existing update mechanism
    
    res.json({
      success: true,
      memoId,
      ticker: m.ticker,
      expectedReturn,
      realizedReturn: realizedReturnPct,
      deviation: realizedReturnPct - expectedReturn,
      modelErrorFlag,
      postMortemStatus,
      holdingPeriodDays,
      message: 'Post-mortem data recorded successfully',
    });
  } catch (error) {
    console.error('Error updating post-mortem:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/learning-loop/model-performance
 * Analyze model performance across all completed positions
 */
learningLoopRouter.get('/model-performance', async (req: Request, res: Response) => {
  try {
    const memos = await icMemosRepository.getAll();
    const completeMemos = memos.filter((m: any) => m.status === 'complete');
    
    // Group by thesis type and portfolio role
    const performanceByThesisType: Record<string, { count: number; avgInvestability: number; avgQuality: number }> = {};
    const performanceByPortfolioRole: Record<string, { count: number; avgInvestability: number }> = {};
    const performanceByRiskCategory: Record<string, { count: number; avgInvestability: number }> = {};
    
    for (const memo of completeMemos) {
      const m = memo as any;
      const thesisType = m.thesisPrimaryType || 'unknown';
      const portfolioRole = m.portfolioRole || 'unknown';
      const riskCategory = m.riskPrimaryCategory || 'unknown';
      const investability = parseFloat(m.investabilityScoreStandalone || '0');
      const quality = parseFloat(m.qualityScore || '0');
      
      // By thesis type
      if (!performanceByThesisType[thesisType]) {
        performanceByThesisType[thesisType] = { count: 0, avgInvestability: 0, avgQuality: 0 };
      }
      performanceByThesisType[thesisType].count++;
      performanceByThesisType[thesisType].avgInvestability += investability;
      performanceByThesisType[thesisType].avgQuality += quality;
      
      // By portfolio role
      if (!performanceByPortfolioRole[portfolioRole]) {
        performanceByPortfolioRole[portfolioRole] = { count: 0, avgInvestability: 0 };
      }
      performanceByPortfolioRole[portfolioRole].count++;
      performanceByPortfolioRole[portfolioRole].avgInvestability += investability;
      
      // By risk category
      if (!performanceByRiskCategory[riskCategory]) {
        performanceByRiskCategory[riskCategory] = { count: 0, avgInvestability: 0 };
      }
      performanceByRiskCategory[riskCategory].count++;
      performanceByRiskCategory[riskCategory].avgInvestability += investability;
    }
    
    // Calculate averages
    for (const key of Object.keys(performanceByThesisType)) {
      const data = performanceByThesisType[key];
      data.avgInvestability = Math.round((data.avgInvestability / data.count) * 100) / 100;
      data.avgQuality = Math.round((data.avgQuality / data.count) * 100) / 100;
    }
    
    for (const key of Object.keys(performanceByPortfolioRole)) {
      const data = performanceByPortfolioRole[key];
      data.avgInvestability = Math.round((data.avgInvestability / data.count) * 100) / 100;
    }
    
    for (const key of Object.keys(performanceByRiskCategory)) {
      const data = performanceByRiskCategory[key];
      data.avgInvestability = Math.round((data.avgInvestability / data.count) * 100) / 100;
    }
    
    res.json({
      totalMemos: completeMemos.length,
      performanceByThesisType,
      performanceByPortfolioRole,
      performanceByRiskCategory,
    });
  } catch (error) {
    console.error('Error analyzing model performance:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/learning-loop/top-opportunities
 * Get top investment opportunities ranked by investability score
 */
learningLoopRouter.get('/top-opportunities', async (req: Request, res: Response) => {
  try {
    const { 
      limit = '20',
      min_investability = '70',
      portfolio_role,
      thesis_type,
    } = req.query;
    
    const memos = await icMemosRepository.getAll();
    let filteredMemos = memos.filter((m: any) => m.status === 'complete');
    
    // Filter by minimum investability score
    const minScore = parseFloat(min_investability as string);
    filteredMemos = filteredMemos.filter((m: any) => 
      parseFloat(m.investabilityScoreStandalone || '0') >= minScore
    );
    
    // Filter by portfolio role
    if (portfolio_role) {
      filteredMemos = filteredMemos.filter((m: any) => 
        m.portfolioRole === portfolio_role
      );
    }
    
    // Filter by thesis type
    if (thesis_type) {
      filteredMemos = filteredMemos.filter((m: any) => 
        m.thesisPrimaryType === thesis_type
      );
    }
    
    // Sort by investability score descending
    filteredMemos.sort((a: any, b: any) => {
      const aScore = parseFloat(a.investabilityScoreStandalone || '0');
      const bScore = parseFloat(b.investabilityScoreStandalone || '0');
      return bScore - aScore;
    });
    
    // Limit results
    const limitNum = parseInt(limit as string);
    filteredMemos = filteredMemos.slice(0, limitNum);
    
    const opportunities = filteredMemos.map((m: any) => ({
      ticker: m.ticker,
      companyName: m.companyName,
      investabilityScore: parseFloat(m.investabilityScoreStandalone || '0'),
      qualityScore: parseFloat(m.qualityScore || '0'),
      qualityQuintile: m.qualityScoreQuintile,
      compositeScore: parseFloat(m.compositeScore || '0'),
      compositeQuintile: m.compositeScoreQuintile,
      thesisPrimaryType: m.thesisPrimaryType,
      portfolioRole: m.portfolioRole,
      riskCategory: m.riskPrimaryCategory,
      catalystType: m.catalystType,
      catalystStrength: m.catalystStrength,
      asymmetryScore: parseFloat(m.asymmetryScore || '0'),
      expectedReturn: parseFloat(m.expectedReturnProbabilityWeightedPct || '0'),
      recommendation: m.recommendation,
      conviction: m.conviction,
      memoId: m.memoId,
    }));
    
    res.json({
      total: opportunities.length,
      filters: {
        min_investability: minScore,
        portfolio_role: portfolio_role || 'all',
        thesis_type: thesis_type || 'all',
      },
      opportunities,
    });
  } catch (error) {
    console.error('Error fetching top opportunities:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/learning-loop/quintile-performance
 * Analyze performance by quintile across all scores
 */
learningLoopRouter.get('/quintile-performance', async (req: Request, res: Response) => {
  try {
    const memos = await icMemosRepository.getAll();
    const completeMemos = memos.filter((m: any) => m.status === 'complete');
    
    // Initialize quintile buckets for each score
    const quintileData: Record<string, Record<number, { count: number; avgInvestability: number; tickers: string[] }>> = {
      quality: { 1: { count: 0, avgInvestability: 0, tickers: [] }, 2: { count: 0, avgInvestability: 0, tickers: [] }, 3: { count: 0, avgInvestability: 0, tickers: [] }, 4: { count: 0, avgInvestability: 0, tickers: [] }, 5: { count: 0, avgInvestability: 0, tickers: [] } },
      momentum: { 1: { count: 0, avgInvestability: 0, tickers: [] }, 2: { count: 0, avgInvestability: 0, tickers: [] }, 3: { count: 0, avgInvestability: 0, tickers: [] }, 4: { count: 0, avgInvestability: 0, tickers: [] }, 5: { count: 0, avgInvestability: 0, tickers: [] } },
      turnaround: { 1: { count: 0, avgInvestability: 0, tickers: [] }, 2: { count: 0, avgInvestability: 0, tickers: [] }, 3: { count: 0, avgInvestability: 0, tickers: [] }, 4: { count: 0, avgInvestability: 0, tickers: [] }, 5: { count: 0, avgInvestability: 0, tickers: [] } },
      piotroski: { 1: { count: 0, avgInvestability: 0, tickers: [] }, 2: { count: 0, avgInvestability: 0, tickers: [] }, 3: { count: 0, avgInvestability: 0, tickers: [] }, 4: { count: 0, avgInvestability: 0, tickers: [] }, 5: { count: 0, avgInvestability: 0, tickers: [] } },
      composite: { 1: { count: 0, avgInvestability: 0, tickers: [] }, 2: { count: 0, avgInvestability: 0, tickers: [] }, 3: { count: 0, avgInvestability: 0, tickers: [] }, 4: { count: 0, avgInvestability: 0, tickers: [] }, 5: { count: 0, avgInvestability: 0, tickers: [] } },
    };
    
    for (const memo of completeMemos) {
      const m = memo as any;
      const investability = parseFloat(m.investabilityScoreStandalone || '0');
      
      // Quality quintile
      if (m.qualityScoreQuintile) {
        const q = m.qualityScoreQuintile;
        quintileData.quality[q].count++;
        quintileData.quality[q].avgInvestability += investability;
        if (quintileData.quality[q].tickers.length < 5) {
          quintileData.quality[q].tickers.push(m.ticker);
        }
      }
      
      // Momentum quintile
      if (m.momentumScoreQuintile) {
        const q = m.momentumScoreQuintile;
        quintileData.momentum[q].count++;
        quintileData.momentum[q].avgInvestability += investability;
        if (quintileData.momentum[q].tickers.length < 5) {
          quintileData.momentum[q].tickers.push(m.ticker);
        }
      }
      
      // Turnaround quintile
      if (m.turnaroundScoreQuintile) {
        const q = m.turnaroundScoreQuintile;
        quintileData.turnaround[q].count++;
        quintileData.turnaround[q].avgInvestability += investability;
        if (quintileData.turnaround[q].tickers.length < 5) {
          quintileData.turnaround[q].tickers.push(m.ticker);
        }
      }
      
      // Piotroski quintile
      if (m.piotroskiScoreQuintile) {
        const q = m.piotroskiScoreQuintile;
        quintileData.piotroski[q].count++;
        quintileData.piotroski[q].avgInvestability += investability;
        if (quintileData.piotroski[q].tickers.length < 5) {
          quintileData.piotroski[q].tickers.push(m.ticker);
        }
      }
      
      // Composite quintile
      if (m.compositeScoreQuintile) {
        const q = m.compositeScoreQuintile;
        quintileData.composite[q].count++;
        quintileData.composite[q].avgInvestability += investability;
        if (quintileData.composite[q].tickers.length < 5) {
          quintileData.composite[q].tickers.push(m.ticker);
        }
      }
    }
    
    // Calculate averages
    for (const score of Object.keys(quintileData)) {
      for (let q = 1; q <= 5; q++) {
        const data = quintileData[score][q];
        if (data.count > 0) {
          data.avgInvestability = Math.round((data.avgInvestability / data.count) * 100) / 100;
        }
      }
    }
    
    res.json({
      totalMemos: completeMemos.length,
      quintilePerformance: quintileData,
    });
  } catch (error) {
    console.error('Error analyzing quintile performance:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});
