/**
 * ARC Investment Factory - System API
 * Endpoints for system status, data providers, and run history
 */

import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export const systemRouter: Router = Router();

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const RUNS_DB_FILE = path.join(__dirname, '../../../../output/runs_db.json');
const ENV_FILE = path.join(__dirname, '../../../../.env');

interface DataProviderStatus {
  name: string;
  status: 'connected' | 'error' | 'not_configured';
  last_check: string;
  requests_today: number;
  rate_limit: number;
  error_message?: string;
}

interface RunRecord {
  run_id: string;
  lane: string;
  ticker?: string;
  status: 'completed' | 'failed' | 'running';
  started_at: string;
  completed_at?: string;
  duration_ms: number;
  tokens_used: number;
  cost_usd: number;
  prompts_executed: number;
  ideas_generated?: number;
  error_message?: string;
}

// GET /api/system/status - Get overall system status
systemRouter.get('/status', async (req, res) => {
  try {
    // Check environment variables for API keys
    const envVars = process.env;
    
    const providers: DataProviderStatus[] = [
      {
        name: 'OpenAI (GPT-5.2)',
        status: envVars.OPENAI_API_KEY ? 'connected' : 'not_configured',
        last_check: new Date().toISOString(),
        requests_today: 0,
        rate_limit: 10000,
      },
      {
        name: 'Google (Gemini 2.5)',
        status: envVars.GEMINI_API_KEY ? 'connected' : 'not_configured',
        last_check: new Date().toISOString(),
        requests_today: 0,
        rate_limit: 1500,
      },
      {
        name: 'Anthropic (Claude Opus 4)',
        status: envVars.ANTHROPIC_API_KEY ? 'connected' : 'not_configured',
        last_check: new Date().toISOString(),
        requests_today: 0,
        rate_limit: 4000,
      },
      {
        name: 'Polygon.io',
        status: envVars.POLYGON_API_KEY ? 'connected' : 'not_configured',
        last_check: new Date().toISOString(),
        requests_today: 0,
        rate_limit: 5000,
      },
      {
        name: 'Financial Modeling Prep',
        status: envVars.FMP_API_KEY ? 'connected' : 'not_configured',
        last_check: new Date().toISOString(),
        requests_today: 0,
        rate_limit: 250,
      },
      {
        name: 'FRED (Federal Reserve)',
        status: 'connected', // FRED is free
        last_check: new Date().toISOString(),
        requests_today: 0,
        rate_limit: 120,
      },
      {
        name: 'Reddit API',
        status: 'connected', // Using public endpoints
        last_check: new Date().toISOString(),
        requests_today: 0,
        rate_limit: 60,
      },
      {
        name: 'Fiscal AI',
        status: envVars.FISCAL_AI_API_KEY ? 'connected' : 'not_configured',
        last_check: new Date().toISOString(),
        requests_today: 0,
        rate_limit: 100,
      },
    ];
    
    // Calculate overall health
    const connectedCount = providers.filter(p => p.status === 'connected').length;
    const healthScore = (connectedCount / providers.length) * 100;
    
    res.json({
      health: {
        score: healthScore,
        status: healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'degraded' : 'critical',
        last_updated: new Date().toISOString(),
      },
      providers,
      system: {
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime_seconds: process.uptime(),
        memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    res.status(500).json({ error: 'Failed to fetch system status' });
  }
});

// GET /api/system/providers - Get detailed provider status
systemRouter.get('/providers', async (req, res) => {
  try {
    const envVars = process.env;
    
    const llmProviders = [
      {
        name: 'OpenAI',
        model: 'gpt-5.2-chat-latest',
        status: envVars.OPENAI_API_KEY ? 'active' : 'not_configured',
        prompts_assigned: 85,
        cost_per_1m_input: 5.00,
        cost_per_1m_output: 20.00,
      },
      {
        name: 'Google',
        model: 'gemini-2.5-pro-preview-05-06',
        status: envVars.GEMINI_API_KEY ? 'active' : 'not_configured',
        prompts_assigned: 22,
        cost_per_1m_input: 1.25,
        cost_per_1m_output: 5.00,
      },
      {
        name: 'Anthropic',
        model: 'claude-opus-4-20250514',
        status: envVars.ANTHROPIC_API_KEY ? 'active' : 'not_configured',
        prompts_assigned: 9,
        cost_per_1m_input: 15.00,
        cost_per_1m_output: 75.00,
      },
    ];
    
    const dataProviders = [
      {
        name: 'Polygon.io',
        type: 'Market Data',
        status: envVars.POLYGON_API_KEY ? 'active' : 'not_configured',
        capabilities: ['Real-time prices', 'Historical data', 'News', 'Financials'],
      },
      {
        name: 'Financial Modeling Prep',
        type: 'Fundamentals',
        status: envVars.FMP_API_KEY ? 'active' : 'not_configured',
        capabilities: ['Company profiles', 'Financial ratios', 'Screener', 'SEC filings'],
      },
      {
        name: 'FRED',
        type: 'Macro Data',
        status: 'active',
        capabilities: ['Treasury yields', 'Economic indicators', 'Inflation data'],
      },
      {
        name: 'Reddit',
        type: 'Social Sentiment',
        status: 'active',
        capabilities: ['WSB sentiment', 'Trending tickers', 'Discussion analysis'],
      },
    ];
    
    res.json({
      llm_providers: llmProviders,
      data_providers: dataProviders,
    });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// GET /api/system/runs - Get run history
systemRouter.get('/runs', async (req, res) => {
  try {
    const { lane, status, limit = 50 } = req.query;
    
    let runs: RunRecord[] = [];
    
    if (fs.existsSync(RUNS_DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(RUNS_DB_FILE, 'utf-8'));
      runs = data.runs || [];
    }
    
    // Also check output directory for run files
    const outputDir = path.join(__dirname, '../../../../output');
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      const runFiles = files.filter(f => f.startsWith('lane_') && f.endsWith('.json'));
      
      for (const file of runFiles) {
        try {
          const runData = JSON.parse(fs.readFileSync(path.join(outputDir, file), 'utf-8'));
          const existingRun = runs.find(r => r.run_id === runData.run_id);
          
          if (!existingRun && runData.run_id) {
            runs.push({
              run_id: runData.run_id,
              lane: runData.lane || (file.includes('lane_a') ? 'lane_a' : 'lane_b'),
              ticker: runData.ticker,
              status: runData.status || 'completed',
              started_at: runData.started_at || runData.timestamp,
              completed_at: runData.completed_at,
              duration_ms: runData.duration_ms || runData.execution_time_ms || 0,
              tokens_used: runData.tokens_used || runData.telemetry?.tokens_used || 0,
              cost_usd: runData.cost_usd || runData.telemetry?.cost_usd || 0,
              prompts_executed: runData.prompts_executed || 1,
              ideas_generated: runData.ideas?.length || runData.ideas_generated,
            });
          }
        } catch {
          // Skip invalid files
        }
      }
    }
    
    // Sort by date descending
    runs.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    
    // Apply filters
    let filtered = runs;
    
    if (lane && lane !== 'all') {
      filtered = filtered.filter(r => r.lane === lane);
    }
    
    if (status && status !== 'all') {
      filtered = filtered.filter(r => r.status === status);
    }
    
    // Apply limit
    filtered = filtered.slice(0, Number(limit));
    
    // Calculate stats
    const stats = {
      total_runs: runs.length,
      completed: runs.filter(r => r.status === 'completed').length,
      failed: runs.filter(r => r.status === 'failed').length,
      total_tokens: runs.reduce((sum, r) => sum + r.tokens_used, 0),
      total_cost: runs.reduce((sum, r) => sum + r.cost_usd, 0),
      avg_duration_ms: runs.length > 0 
        ? runs.reduce((sum, r) => sum + r.duration_ms, 0) / runs.length 
        : 0,
    };
    
    res.json({
      runs: filtered,
      stats,
    });
  } catch (error) {
    console.error('Error fetching runs:', error);
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

// GET /api/system/runs/:id - Get single run details
systemRouter.get('/runs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check output directory for the run file
    const outputDir = path.join(__dirname, '../../../../output');
    const files = fs.readdirSync(outputDir);
    const runFile = files.find(f => f.includes(id) && f.endsWith('.json'));
    
    if (runFile) {
      const runData = JSON.parse(fs.readFileSync(path.join(outputDir, runFile), 'utf-8'));
      return res.json({ run: runData });
    }
    
    // Check runs_db
    if (fs.existsSync(RUNS_DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(RUNS_DB_FILE, 'utf-8'));
      const run = (data.runs || []).find((r: RunRecord) => r.run_id === id);
      if (run) {
        return res.json({ run });
      }
    }
    
    res.status(404).json({ error: 'Run not found' });
  } catch (error) {
    console.error('Error fetching run:', error);
    res.status(500).json({ error: 'Failed to fetch run' });
  }
});

// GET /api/system/logs - Get recent system logs
systemRouter.get('/logs', async (req, res) => {
  try {
    const { level = 'all', limit = 100 } = req.query;
    
    // For now, return empty logs - would integrate with actual logging system
    const logs: { timestamp: string; level: string; message: string; source: string }[] = [];
    
    res.json({
      logs,
      filters: {
        levels: ['info', 'warning', 'error', 'debug'],
      },
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});
