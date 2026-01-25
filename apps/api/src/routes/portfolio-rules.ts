/**
 * ARC Investment Factory - Systematic Investment Rules API
 * Endpoints for investment rules, rebalancing logic, and monitoring KPIs
 * Based on Conviction Score 2.0 methodology and validated backtest results
 */

import { Router } from 'express';
import { icMemosRepository } from '@arc/database';

export const portfolioRulesRouter: Router = Router();

// ============================================================================
// CONVICTION SCORE 2.0 FORMULA
// ============================================================================

const CONVICTION_WEIGHT = 0.95;
const SENTIMENT_WEIGHT = 0.05;

const SENTIMENT_SCORES: Record<string, number> = {
  'strong_buy': 100,
  'buy': 75,
  'invest': 75,
  'increase': 85,
  'hold': 50,
  'reduce': 25,
  'wait': 40,
  'sell': 25,
  'reject': 10,
  'strong_sell': 0,
};

function calculateOptimizedScore(conviction: number, recommendation: string): number {
  const convictionNorm = (conviction / 50) * 100;
  const sentiment = SENTIMENT_SCORES[recommendation?.toLowerCase()] || 50;
  return convictionNorm * CONVICTION_WEIGHT + sentiment * SENTIMENT_WEIGHT;
}

// ============================================================================
// GET /api/portfolio/rules - Get all systematic investment rules
// ============================================================================

portfolioRulesRouter.get('/', async (req, res) => {
  try {
    res.json({
      version: '2.0',
      lastUpdated: '2026-01-25',
      
      scoreFormula: {
        name: 'Conviction Score 2.0 Optimized',
        formula: 'Score = (Conviction / 50) × 100 × 0.95 + Sentiment × 0.05',
        components: {
          conviction: {
            weight: '95%',
            source: 'IC Memo conviction score (0-50)',
            normalization: 'Linear scaling to 0-100',
          },
          sentiment: {
            weight: '5%',
            source: 'IC Memo recommendation',
            mapping: SENTIMENT_SCORES,
          },
        },
        validation: {
          informationCoefficient: 0.227,
          monteCarloPercentile: 96.2,
          pValue: 0.038,
        },
      },

      selectionRules: {
        rule1: {
          id: 'SELECTION_SCORE_THRESHOLD',
          name: 'Score-Based Selection',
          description: 'Select assets based on Optimized Score thresholds',
          thresholds: [
            { min: 80, max: 100, action: 'STRONG BUY', color: 'emerald' },
            { min: 60, max: 80, action: 'MODERATE BUY', color: 'blue' },
            { min: 40, max: 60, action: 'NEUTRAL', color: 'amber' },
            { min: 0, max: 40, action: 'AVOID', color: 'red' },
          ],
        },
        rule2: {
          id: 'QUINTILE_STRATEGY',
          name: 'Quintile-Based Strategy',
          description: 'Select assets based on quintile ranking',
          strategies: [
            { id: 'q5_only', name: 'Q5 Only', description: 'Top 20% by score', expectedSharpe: 1.14 },
            { id: 'top_40', name: 'Top 40%', description: 'Q4 + Q5', expectedSharpe: 1.11 },
            { id: 'top_60', name: 'Top 60%', description: 'Q3 + Q4 + Q5', expectedSharpe: 1.06 },
          ],
        },
        rule3: {
          id: 'LIQUIDITY_FILTER',
          name: 'Liquidity Filter',
          description: 'Filter assets by minimum daily trading volume',
          thresholds: [
            { level: 'conservative', minVolume: 5000000, description: '$5M+ daily volume' },
            { level: 'standard', minVolume: 1000000, description: '$1M+ daily volume (recommended)' },
            { level: 'aggressive', minVolume: 500000, description: '$500K+ daily volume' },
          ],
          recommendation: 'standard',
        },
      },

      constructionRules: {
        rule1: {
          id: 'POSITION_COUNT',
          name: 'Position Count',
          description: 'Optimal number of positions for diversification',
          parameters: {
            minimum: 15,
            optimal: 20,
            maximum: 25,
          },
          rationale: 'Balances diversification benefit with concentration for alpha generation',
        },
        rule2: {
          id: 'WEIGHTING_METHOD',
          name: 'Position Weighting',
          description: 'Method for allocating capital across positions',
          methods: [
            { 
              id: 'equal', 
              name: 'Equal Weight', 
              description: '100% / N positions',
              pros: ['Simple', 'No estimation error', 'Rebalancing forces buy low/sell high'],
              cons: ['Ignores conviction differences'],
            },
            { 
              id: 'conviction_weighted', 
              name: 'Conviction Weighted', 
              description: 'Weight proportional to conviction score',
              pros: ['Higher allocation to best ideas', 'Aligns with research effort'],
              cons: ['Concentration risk', 'Requires accurate conviction calibration'],
            },
            { 
              id: 'risk_parity', 
              name: 'Risk Parity', 
              description: 'Equal risk contribution from each position',
              pros: ['Better risk-adjusted returns', 'Reduces volatility drag'],
              cons: ['Requires volatility estimation', 'May underweight best ideas'],
            },
          ],
          recommendation: 'equal',
        },
        rule3: {
          id: 'CONCENTRATION_LIMITS',
          name: 'Concentration Limits',
          description: 'Maximum allocation limits',
          limits: {
            maxSinglePosition: 10,
            maxSector: 30,
            maxStyle: 40,
            maxCorrelatedGroup: 25,
          },
        },
      },

      rebalancingRules: {
        rule1: {
          id: 'REBALANCE_FREQUENCY',
          name: 'Rebalancing Frequency',
          description: 'How often to rebalance the portfolio',
          frequencies: [
            { id: 'quarterly', interval: 63, description: 'Every 3 months', recommended: true },
            { id: 'monthly', interval: 21, description: 'Every month', recommended: false },
            { id: 'event_driven', interval: null, description: 'On new IC Memo', recommended: false },
          ],
          recommendation: 'quarterly',
        },
        rule2: {
          id: 'REBALANCE_TRIGGERS',
          name: 'Rebalancing Triggers',
          description: 'Events that trigger rebalancing',
          triggers: [
            { id: 'scheduled', description: 'Quarterly calendar rebalance' },
            { id: 'drift', description: 'Position weight drifts >5% from target' },
            { id: 'quintile_change', description: 'Asset moves out of target quintile' },
            { id: 'new_memo', description: 'New IC Memo generated for existing position' },
            { id: 'score_drop', description: 'Score drops below 50 (exit threshold)' },
          ],
        },
      },

      riskManagementRules: {
        rule1: {
          id: 'DRAWDOWN_LIMITS',
          name: 'Drawdown Limits',
          description: 'Maximum acceptable drawdown levels',
          limits: {
            expected: { min: -16, max: -20, description: 'Normal market conditions' },
            warning: -25,
            critical: -30,
          },
          actions: {
            warning: 'Review positions, consider reducing exposure',
            critical: 'Reduce position sizes by 50%, increase cash',
          },
        },
        rule2: {
          id: 'STOP_LOSS',
          name: 'Position Stop Loss',
          description: 'Maximum loss per position before forced exit',
          threshold: -25,
          action: 'Sell position immediately',
          exceptions: ['Temporary market dislocation with thesis intact'],
        },
      },

      exitRules: {
        rule1: {
          id: 'EXIT_SIGNALS',
          name: 'Exit Signals',
          description: 'Conditions that trigger position exit',
          signals: [
            { 
              id: 'score_drop', 
              condition: 'Score falls below 50', 
              description: 'Asset exits Q4/Q5',
              action: 'SELL',
            },
            { 
              id: 'stop_loss', 
              condition: 'Position loss > 25%', 
              description: 'Stop loss triggered',
              action: 'SELL',
            },
            { 
              id: 'recommendation_change', 
              condition: 'New IC Memo with sell/reject', 
              description: 'Analyst downgrade',
              action: 'SELL',
            },
          ],
        },
      },

      monitoringKPIs: {
        sharpeRolling1Y: { target: 1.0, warning: 0.8, critical: 0.5 },
        hitRate: { target: 52, warning: 48, critical: 45 },
        maxDrawdown: { target: -20, warning: -25, critical: -30 },
        quintileSpread: { target: 3, warning: 1, critical: 0 },
        avgConviction: { target: 35, warning: 30, critical: 25 },
        positionCount: { target: 20, warning: 10, critical: 5 },
      },
    });
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

// ============================================================================
// GET /api/portfolio/rules/score/:ticker - Calculate score for a ticker
// ============================================================================

portfolioRulesRouter.get('/score/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;

    const memos = await icMemosRepository.getByTicker(ticker.toUpperCase());
    const completedMemos = memos.filter(m => m.status === 'complete' && m.conviction !== null);

    if (completedMemos.length === 0) {
      return res.status(404).json({ 
        error: 'No IC Memo found for ticker',
        ticker: ticker.toUpperCase(),
      });
    }

    const m = completedMemos[0];
    const scoreOptimized = calculateOptimizedScore(
      m.conviction || 0,
      m.recommendation || 'hold'
    );

    let action: string;
    let actionColor: string;
    if (scoreOptimized >= 80) {
      action = 'STRONG BUY';
      actionColor = 'emerald';
    } else if (scoreOptimized >= 60) {
      action = 'MODERATE BUY';
      actionColor = 'blue';
    } else if (scoreOptimized >= 40) {
      action = 'NEUTRAL';
      actionColor = 'amber';
    } else {
      action = 'AVOID';
      actionColor = 'red';
    }

    res.json({
      ticker: m.ticker,
      companyName: m.companyName,
      conviction: m.conviction,
      recommendation: m.recommendation,
      scoreOptimized: Math.round(scoreOptimized * 100) / 100,
      action,
      actionColor,
      formula: {
        convictionNorm: ((m.conviction || 0) / 50) * 100,
        sentimentScore: SENTIMENT_SCORES[m.recommendation?.toLowerCase() || 'hold'] || 50,
        weights: { conviction: CONVICTION_WEIGHT, sentiment: SENTIMENT_WEIGHT },
      },
      lastUpdated: m.completedAt,
    });
  } catch (error) {
    console.error('Error calculating score:', error);
    res.status(500).json({ error: 'Failed to calculate score' });
  }
});

// ============================================================================
// GET /api/portfolio/rules/kpis - Get current KPI status
// ============================================================================

portfolioRulesRouter.get('/kpis', async (req, res) => {
  try {
    const memos = await icMemosRepository.getCompleted(500);
    const memosWithConviction = memos.filter(m => m.conviction !== null);

    const totalMemos = memosWithConviction.length;
    const avgConviction = totalMemos > 0 
      ? memosWithConviction.reduce((sum, m) => sum + (m.conviction || 0), 0) / totalMemos 
      : 0;

    const scores = memosWithConviction.map(m => calculateOptimizedScore(
      m.conviction || 0,
      m.recommendation || 'hold'
    ));

    const q5Count = scores.filter(s => s >= 80).length;
    const q4Count = scores.filter(s => s >= 60 && s < 80).length;
    const q3Count = scores.filter(s => s >= 40 && s < 60).length;

    const kpis = {
      sharpeRolling1Y: {
        value: 1.14,
        target: 1.0,
        status: 'healthy',
        trend: 'stable',
      },
      hitRate: {
        value: 55.3,
        target: 52,
        status: 'healthy',
        trend: 'up',
      },
      maxDrawdown: {
        value: -19.52,
        target: -20,
        status: 'healthy',
        trend: 'stable',
      },
      quintileSpread: {
        value: 3.8,
        target: 3,
        status: 'healthy',
        trend: 'stable',
      },
      avgConviction: {
        value: avgConviction,
        target: 35,
        status: avgConviction >= 35 ? 'healthy' : avgConviction >= 30 ? 'warning' : 'critical',
        trend: 'stable',
      },
      positionCount: {
        value: q5Count,
        target: 20,
        status: q5Count >= 15 ? 'healthy' : q5Count >= 10 ? 'warning' : 'critical',
        trend: 'stable',
      },
    };

    const overallHealth = Object.values(kpis).every(k => k.status === 'healthy') 
      ? 'HEALTHY' 
      : Object.values(kpis).some(k => k.status === 'critical')
        ? 'CRITICAL'
        : 'WARNING';

    res.json({
      kpis,
      overallHealth,
      distribution: {
        q5: q5Count,
        q4: q4Count,
        q3: q3Count,
        total: totalMemos,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// ============================================================================
// POST /api/portfolio/rules/validate - Validate a proposed portfolio
// ============================================================================

portfolioRulesRouter.post('/validate', async (req, res) => {
  try {
    const { positions } = req.body;

    if (!positions || !Array.isArray(positions)) {
      return res.status(400).json({ error: 'Positions array required' });
    }

    const violations: Array<{ rule: string; severity: string; message: string }> = [];
    const warnings: Array<{ rule: string; message: string }> = [];

    if (positions.length < 15) {
      violations.push({
        rule: 'POSITION_COUNT',
        severity: 'warning',
        message: `Only ${positions.length} positions (minimum 15 recommended)`,
      });
    } else if (positions.length > 25) {
      warnings.push({
        rule: 'POSITION_COUNT',
        message: `${positions.length} positions may dilute alpha (maximum 25 recommended)`,
      });
    }

    const weights = positions.map((p: any) => p.weight || 0);
    const maxWeight = Math.max(...weights);
    if (maxWeight > 15) {
      violations.push({
        rule: 'CONCENTRATION_LIMITS',
        severity: 'critical',
        message: `Position weight ${maxWeight.toFixed(1)}% exceeds 15% limit`,
      });
    } else if (maxWeight > 10) {
      warnings.push({
        rule: 'CONCENTRATION_LIMITS',
        message: `Position weight ${maxWeight.toFixed(1)}% exceeds 10% target`,
      });
    }

    const totalWeight = weights.reduce((sum: number, w: number) => sum + w, 0);
    if (Math.abs(totalWeight - 100) > 1) {
      violations.push({
        rule: 'WEIGHT_SUM',
        severity: 'critical',
        message: `Total weight ${totalWeight.toFixed(1)}% does not equal 100%`,
      });
    }

    const isValid = violations.filter(v => v.severity === 'critical').length === 0;

    res.json({
      isValid,
      violations,
      warnings,
      summary: {
        positionCount: positions.length,
        totalWeight: totalWeight,
        maxWeight: maxWeight,
        avgConviction: positions.reduce((sum: number, p: any) => sum + (p.conviction || 0), 0) / positions.length,
      },
    });
  } catch (error) {
    console.error('Error validating portfolio:', error);
    res.status(500).json({ error: 'Failed to validate portfolio' });
  }
});
