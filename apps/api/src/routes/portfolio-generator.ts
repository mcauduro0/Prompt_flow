/**
 * Portfolio Generator API Routes
 * Generate investable portfolios based on quantitative scores
 */
import { Router, Request, Response } from 'express';
import { icMemosRepository } from '@arc/database';
import type { Router as RouterType } from 'express';

export const portfolioGeneratorRouter: RouterType = Router();

// ============================================================================
// TYPES
// ============================================================================
interface GeneratorConfig {
  scoreType: "composite" | "quality" | "momentum" | "turnaround" | "piotroski";
  targetQuintile: number;
  weightingMethod: "equal" | "score_weighted" | "inverse_volatility";
  maxPositions: number;
  maxSingleWeight: number;
  excludeFunds: boolean;
  minScore?: number;
}

interface GeneratedPosition {
  ticker: string;
  companyName: string;
  weight: number;
  qualityScore: number | null;
  momentumScore: number | null;
  turnaroundScore: number | null;
  piotroskiScore: number | null;
  compositeScore: number | null;
  compositeQuintile: number | null;
  styleTag: string | null;
}

// ============================================================================
// FUND/ETF FILTER
// ============================================================================
const KNOWN_FUND_TICKERS = new Set([
  "DFEOX", "VWUSX", "VEUSX", "VWIAX", "VAIPX", "VFTNX", "VFICX",
  "RGVGX", "FIOFX", "FZTKX", "FZROX", "IGSB", "JEPQ", "IBCZ.DE",
  "SPY", "QQQ", "IWM", "VTI", "VOO", "VEA", "VWO", "BND", "AGG",
]);

const FUND_NAME_KEYWORDS = [
  "FUND", "ETF", "INDEX", "PORTFOLIO", "VANGUARD", "FIDELITY",
  "ISHARES", "DFA ", "AMERICAN FUNDS", "JPMORGAN", "SHARES",
];

function isFundOrETF(ticker: string, companyName: string): boolean {
  const upperTicker = ticker.toUpperCase();
  const upperName = (companyName || "").toUpperCase();
  
  if (KNOWN_FUND_TICKERS.has(upperTicker)) return true;
  if (/^V[A-Z]{3,4}X$/.test(upperTicker)) return true;
  if (/^F[A-Z]{3,4}X$/.test(upperTicker)) return true;
  
  for (const keyword of FUND_NAME_KEYWORDS) {
    if (upperName.includes(keyword)) return true;
  }
  
  return false;
}

// ============================================================================
// DEDUPLICATION HELPER - Keep only the most recent record per ticker
// ============================================================================
function deduplicateByTicker(memos: any[]): any[] {
  const tickerMap = new Map<string, any>();
  
  // Sort by created_at descending to get most recent first
  const sortedMemos = [...memos].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
    const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
    return dateB - dateA;
  });
  
  // Keep only the first (most recent) record for each ticker
  for (const memo of sortedMemos) {
    const ticker = memo.ticker;
    if (ticker && !tickerMap.has(ticker)) {
      tickerMap.set(ticker, memo);
    }
  }
  
  return Array.from(tickerMap.values());
}

// ============================================================================
// GET /api/portfolio/generator/generate - Generate portfolio based on scores
// ============================================================================
portfolioGeneratorRouter.get("/generate", async (req: Request, res: Response) => {
  try {
    const config: GeneratorConfig = {
      scoreType: (req.query.scoreType as any) || "composite",
      targetQuintile: Number(req.query.quintile) || 5,
      weightingMethod: (req.query.weighting as any) || "equal",
      maxPositions: Number(req.query.maxPositions) || 25,
      maxSingleWeight: Number(req.query.maxWeight) || 10,
      excludeFunds: req.query.excludeFunds !== "false",
      minScore: req.query.minScore ? Number(req.query.minScore) : undefined,
    };

    // Fetch all completed IC Memos with scores
    const memos = await icMemosRepository.getCompleted(500);
    
    // DEDUPLICATE: Keep only the most recent record per ticker
    let dedupedMemos = deduplicateByTicker(memos);

    // Filter out funds/ETFs if requested
    let filteredMemos = config.excludeFunds
      ? dedupedMemos.filter((m: any) => !isFundOrETF(m.ticker, m.companyName || ""))
      : dedupedMemos;

    // Filter by target quintile based on score type
    const getQuintile = (memo: any): number | null => {
      switch (config.scoreType) {
        case "composite": return memo.compositeScoreQuintile;
        case "quality": return memo.qualityScoreQuintile;
        case "momentum": return memo.momentumScoreQuintile;
        case "turnaround": return memo.turnaroundScoreQuintile;
        case "piotroski": return memo.piotroskiScoreQuintile;
        default: return memo.compositeScoreQuintile;
      }
    };

    const getScore = (memo: any): number => {
      switch (config.scoreType) {
        case "composite": return Number(memo.compositeScore) || 0;
        case "quality": return Number(memo.qualityScore) || 0;
        case "momentum": return Number(memo.momentumScore) || 0;
        case "turnaround": return Number(memo.turnaroundScore) || 0;
        case "piotroski": return (Number(memo.piotroskiScore) || 0) * 11.11;
        default: return Number(memo.compositeScore) || 0;
      }
    };

    // Filter by quintile
    filteredMemos = filteredMemos.filter((m: any) => getQuintile(m) === config.targetQuintile);

    // Apply minimum score filter if specified
    if (config.minScore) {
      filteredMemos = filteredMemos.filter((m: any) => getScore(m) >= config.minScore!);
    }

    // Sort by score (descending) and limit positions
    filteredMemos = filteredMemos
      .sort((a: any, b: any) => getScore(b) - getScore(a))
      .slice(0, config.maxPositions);

    if (filteredMemos.length === 0) {
      return res.json({
        positions: [],
        summary: {
          totalPositions: 0,
          avgCompositeScore: 0,
          avgQualityScore: 0,
          avgMomentumScore: 0,
          avgTurnaroundScore: 0,
          avgPiotroskiScore: 0,
          quintileDistribution: {},
          totalWeight: 0,
        },
        config,
        message: "No stocks found matching criteria",
      });
    }

    // Calculate weights based on method
    let positions: GeneratedPosition[] = [];
    const totalScore = filteredMemos.reduce((sum: number, m: any) => sum + getScore(m), 0);

    for (const memo of filteredMemos) {
      let weight: number;
      
      switch (config.weightingMethod) {
        case "score_weighted":
          weight = (getScore(memo) / totalScore) * 100;
          break;
        case "equal":
        default:
          weight = 100 / filteredMemos.length;
          break;
      }

      // Apply max single weight cap
      weight = Math.min(weight, config.maxSingleWeight);

      positions.push({
        ticker: memo.ticker,
        companyName: memo.companyName || "",
        weight: Math.round(weight * 100) / 100,
        qualityScore: memo.qualityScore ? Number(memo.qualityScore) : null,
        momentumScore: memo.momentumScore ? Number(memo.momentumScore) : null,
        turnaroundScore: memo.turnaroundScore ? Number(memo.turnaroundScore) : null,
        piotroskiScore: memo.piotroskiScore,
        compositeScore: memo.compositeScore ? Number(memo.compositeScore) : null,
        compositeQuintile: memo.compositeScoreQuintile,
        styleTag: memo.styleTag,
      });
    }

    // Normalize weights to sum to 100%
    const totalWeight = positions.reduce((sum, p) => sum + p.weight, 0);
    if (totalWeight > 0 && totalWeight !== 100) {
      const factor = 100 / totalWeight;
      positions = positions.map(p => ({
        ...p,
        weight: Math.round(p.weight * factor * 100) / 100,
      }));
    }

    // Calculate summary statistics
    const avgCompositeScore = positions.reduce((sum, p) => sum + (p.compositeScore || 0), 0) / positions.length;
    const avgQualityScore = positions.reduce((sum, p) => sum + (p.qualityScore || 0), 0) / positions.length;
    const avgMomentumScore = positions.reduce((sum, p) => sum + (p.momentumScore || 0), 0) / positions.length;
    const avgTurnaroundScore = positions.reduce((sum, p) => sum + (p.turnaroundScore || 0), 0) / positions.length;
    const avgPiotroskiScore = positions.reduce((sum, p) => sum + (p.piotroskiScore || 0), 0) / positions.length;

    // Quintile distribution
    const quintileDistribution: Record<string, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Q5: 0 };
    positions.forEach(p => {
      if (p.compositeQuintile) {
        quintileDistribution[`Q${p.compositeQuintile}`]++;
      }
    });

    res.json({
      positions,
      summary: {
        totalPositions: positions.length,
        avgCompositeScore: Math.round(avgCompositeScore * 100) / 100,
        avgQualityScore: Math.round(avgQualityScore * 100) / 100,
        avgMomentumScore: Math.round(avgMomentumScore * 100) / 100,
        avgTurnaroundScore: Math.round(avgTurnaroundScore * 100) / 100,
        avgPiotroskiScore: Math.round(avgPiotroskiScore * 100) / 100,
        quintileDistribution,
        totalWeight: Math.round(positions.reduce((sum, p) => sum + p.weight, 0) * 100) / 100,
      },
      config,
    });
  } catch (error) {
    console.error("Portfolio generation error:", error);
    res.status(500).json({ error: "Failed to generate portfolio", details: String(error) });
  }
});

// ============================================================================
// GET /api/portfolio/generator/score-distribution
// ============================================================================
portfolioGeneratorRouter.get("/score-distribution", async (req: Request, res: Response) => {
  try {
    const memos = await icMemosRepository.getCompleted(500);
    
    // DEDUPLICATE: Keep only the most recent record per ticker
    const dedupedMemos = deduplicateByTicker(memos);

    // Calculate distributions
    const distributions = {
      composite: { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Q5: 0 },
      quality: { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Q5: 0 },
      momentum: { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Q5: 0 },
      turnaround: { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Q5: 0 },
      piotroski: { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Q5: 0 },
    };

    dedupedMemos.forEach((m: any) => {
      if (m.compositeScoreQuintile) distributions.composite[`Q${m.compositeScoreQuintile}` as keyof typeof distributions.composite]++;
      if (m.qualityScoreQuintile) distributions.quality[`Q${m.qualityScoreQuintile}` as keyof typeof distributions.quality]++;
      if (m.momentumScoreQuintile) distributions.momentum[`Q${m.momentumScoreQuintile}` as keyof typeof distributions.momentum]++;
      if (m.turnaroundScoreQuintile) distributions.turnaround[`Q${m.turnaroundScoreQuintile}` as keyof typeof distributions.turnaround]++;
      if (m.piotroskiScoreQuintile) distributions.piotroski[`Q${m.piotroskiScoreQuintile}` as keyof typeof distributions.piotroski]++;
    });

    res.json({
      totalMemos: dedupedMemos.length,
      distributions,
    });
  } catch (error) {
    console.error("Score distribution error:", error);
    res.status(500).json({ error: "Failed to get score distribution" });
  }
});
