/**
 * ARC Investment Factory - Portfolio API
 * Endpoints for portfolio management and analysis
 */

import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export const portfolioRouter: Router = Router();

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to portfolio data
const PORTFOLIO_FILE = path.join(__dirname, '../../../../output/portfolio_db.json');
const RUNS_DB_FILE = path.join(__dirname, '../../../../output/runs_db.json');

interface Position {
  id: string;
  ticker: string;
  company_name: string;
  entry_date: string;
  entry_price: number;
  current_price: number;
  shares: number;
  weight_percent: number;
  pnl_percent: number;
  pnl_usd: number;
  style: string;
  conviction: number;
  thesis_summary: string;
  last_updated: string;
}

interface PortfolioSummary {
  total_value: number;
  total_pnl: number;
  total_pnl_percent: number;
  positions_count: number;
  cash_percent: number;
  top_sector: string;
  avg_conviction: number;
}

// Helper to load portfolio data
function loadPortfolioData(): { positions: Position[]; summary: PortfolioSummary } {
  const defaultSummary: PortfolioSummary = {
    total_value: 0,
    total_pnl: 0,
    total_pnl_percent: 0,
    positions_count: 0,
    cash_percent: 100,
    top_sector: 'N/A',
    avg_conviction: 0,
  };
  
  if (!fs.existsSync(PORTFOLIO_FILE)) {
    return { positions: [], summary: defaultSummary };
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf-8'));
    return {
      positions: data.positions || [],
      summary: data.summary || defaultSummary,
    };
  } catch {
    return { positions: [], summary: defaultSummary };
  }
}

// GET /api/portfolio - Get portfolio overview
portfolioRouter.get('/', async (req, res) => {
  try {
    const { positions, summary } = loadPortfolioData();
    
    // Calculate sector breakdown
    const sectorBreakdown: Record<string, number> = {};
    positions.forEach(p => {
      const sector = p.style || 'Other';
      sectorBreakdown[sector] = (sectorBreakdown[sector] || 0) + p.weight_percent;
    });
    
    // Calculate style breakdown
    const styleBreakdown: Record<string, number> = {};
    positions.forEach(p => {
      styleBreakdown[p.style] = (styleBreakdown[p.style] || 0) + 1;
    });
    
    res.json({
      summary,
      positions: positions.map(p => ({
        id: p.id,
        ticker: p.ticker,
        company_name: p.company_name,
        weight_percent: p.weight_percent,
        pnl_percent: p.pnl_percent,
        conviction: p.conviction,
        style: p.style,
        entry_date: p.entry_date,
      })),
      breakdown: {
        by_sector: sectorBreakdown,
        by_style: styleBreakdown,
      },
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// GET /api/portfolio/positions - Get all positions with details
portfolioRouter.get('/positions', async (req, res) => {
  try {
    const { positions } = loadPortfolioData();
    res.json({ positions });
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// GET /api/portfolio/positions/:id - Get single position details
portfolioRouter.get('/positions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { positions } = loadPortfolioData();
    
    const position = positions.find(p => p.id === id || p.ticker === id);
    
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }
    
    res.json({ position });
  } catch (error) {
    console.error('Error fetching position:', error);
    res.status(500).json({ error: 'Failed to fetch position' });
  }
});

// GET /api/portfolio/risk - Get risk metrics
portfolioRouter.get('/risk', async (req, res) => {
  try {
    const { positions, summary } = loadPortfolioData();
    
    // Calculate risk metrics
    const concentrationRisk = positions.length > 0 
      ? Math.max(...positions.map(p => p.weight_percent)) 
      : 0;
    
    const avgConviction = positions.length > 0
      ? positions.reduce((sum, p) => sum + p.conviction, 0) / positions.length
      : 0;
    
    const highConvictionWeight = positions
      .filter(p => p.conviction >= 8)
      .reduce((sum, p) => sum + p.weight_percent, 0);
    
    const losersCount = positions.filter(p => p.pnl_percent < 0).length;
    const winnersCount = positions.filter(p => p.pnl_percent > 0).length;
    
    res.json({
      risk_metrics: {
        concentration_risk: concentrationRisk,
        diversification_score: positions.length > 0 ? Math.min(100, positions.length * 10) : 0,
        avg_conviction: avgConviction,
        high_conviction_weight: highConvictionWeight,
        winners_count: winnersCount,
        losers_count: losersCount,
        win_rate: positions.length > 0 ? (winnersCount / positions.length) * 100 : 0,
      },
      alerts: generateRiskAlerts(positions, summary),
    });
  } catch (error) {
    console.error('Error fetching risk metrics:', error);
    res.status(500).json({ error: 'Failed to fetch risk metrics' });
  }
});

// GET /api/portfolio/performance - Get performance history
portfolioRouter.get('/performance', async (req, res) => {
  try {
    // Load from runs_db to get historical performance
    let performanceHistory: { date: string; value: number; pnl_percent: number }[] = [];
    
    if (fs.existsSync(RUNS_DB_FILE)) {
      const runsData = JSON.parse(fs.readFileSync(RUNS_DB_FILE, 'utf-8'));
      // Extract portfolio snapshots from runs if available
      performanceHistory = runsData.portfolio_snapshots || [];
    }
    
    res.json({
      history: performanceHistory,
      benchmarks: {
        sp500_ytd: 12.5, // Placeholder
        nasdaq_ytd: 18.3, // Placeholder
      },
    });
  } catch (error) {
    console.error('Error fetching performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
});

// Helper function to generate risk alerts
function generateRiskAlerts(positions: Position[], summary: PortfolioSummary): { level: string; message: string }[] {
  const alerts: { level: string; message: string }[] = [];
  
  // Check concentration
  const maxWeight = positions.length > 0 ? Math.max(...positions.map(p => p.weight_percent)) : 0;
  if (maxWeight > 20) {
    alerts.push({
      level: 'warning',
      message: `High concentration: Single position at ${maxWeight.toFixed(1)}% of portfolio`,
    });
  }
  
  // Check diversification
  if (positions.length < 5 && positions.length > 0) {
    alerts.push({
      level: 'info',
      message: `Low diversification: Only ${positions.length} positions`,
    });
  }
  
  // Check for large losses
  const bigLosers = positions.filter(p => p.pnl_percent < -15);
  if (bigLosers.length > 0) {
    alerts.push({
      level: 'warning',
      message: `${bigLosers.length} position(s) with >15% loss`,
    });
  }
  
  // Check cash level
  if (summary.cash_percent > 50) {
    alerts.push({
      level: 'info',
      message: `High cash allocation: ${summary.cash_percent.toFixed(1)}%`,
    });
  }
  
  return alerts;
}
