/**
 * ARC Investment Factory - Manual Ideas Routes
 * Allows users to manually add tickers/companies to Lane A pipeline
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { ideasRepository, runsRepository, securityMasterRepository } from '@arc/database';
import { createFMPClient } from '@arc/retriever';

export const manualIdeasRouter: Router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Resolve company name to ticker using FMP search
 */
async function resolveToTicker(input: string): Promise<{ ticker: string; companyName: string } | null> {
  const fmp = createFMPClient();
  
  // Check if input looks like a ticker (all caps, 1-5 chars)
  const isTicker = /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(input.toUpperCase());
  
  if (isTicker) {
    // Validate ticker exists
    const profileResult = await fmp.getProfile(input.toUpperCase());
    if (profileResult.success && profileResult.data) {
      return {
        ticker: input.toUpperCase(),
        companyName: profileResult.data.companyName || input.toUpperCase(),
      };
    }
  }
  
  // Search by company name
  const searchResult = await fmp.searchCompany(input, 5);
  if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
    const match = searchResult.data[0];
    return {
      ticker: match.symbol,
      companyName: match.name,
    };
  }
  
  return null;
}

/**
 * Create a manual idea entry in the database
 */
async function createManualIdea(
  ticker: string,
  companyName: string,
  source: 'manual_single' | 'manual_batch' | 'manual_upload'
): Promise<any> {
  const fmp = createFMPClient();
  const today = new Date().toISOString().split('T')[0];
  
  // Fetch basic company data
  const [profileResult, metricsResult] = await Promise.all([
    fmp.getProfile(ticker),
    fmp.getKeyMetrics(ticker),
  ]);
  
  const profile: any = profileResult.data || {};
  const metrics: any = metricsResult.data || {};
  
  // Create idea with minimal data - will be enriched by Lane A
  const idea = await ideasRepository.create({
    ticker,
    asOf: today,
    styleTag: 'quality_compounder', // Default, will be updated by Lane A
    oneSentenceHypothesis: `Manual submission for analysis: ${companyName}`,
    mechanism: 'Pending Lane A analysis',
    timeHorizon: '1_3_years',
    edgeType: ['manual_submission'],
    companyName: companyName || profile.companyName || ticker,
    quickMetrics: {
      market_cap_usd: profile.marketCap || null,
      ev_to_ebitda: metrics.evToEbitda || null,
      pe: metrics.pe || null,
      fcf_yield: metrics.fcfYield || null,
      revenue_cagr_3y: metrics.revenueCagr3y || null,
      ebit_margin: metrics.ebitMargin || null,
      net_debt_to_ebitda: metrics.netDebtToEbitda || null,
    },
    gateResults: {
      gate_0_data_sufficiency: 'pass',
      gate_1_coherence: 'pass',
      gate_2_edge_claim: 'pass',
      gate_3_downside_shape: 'pass',
      gate_4_style_fit: 'pass',
    },
    score: {
      total: 50, // Neutral score, pending analysis
      edge_clarity: 5,
      business_quality_prior: 5,
      financial_resilience_prior: 5,
      valuation_tension: 5,
      catalyst_clarity: 5,
      information_availability: 5,
      complexity_penalty: 0,
      disclosure_friction_penalty: 0,
    },
    noveltyScore: '100.00',
    rankScore: '50.000000',
    status: 'new',
    isNewTicker: true,
    isExploration: false,
  });
  
  return idea;
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/manual-ideas/single
 * Add a single ticker or company name
 */
manualIdeasRouter.post('/single', async (req: Request, res: Response) => {
  try {
    const { input } = req.body;
    
    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      res.status(400).json({ error: 'Input (ticker or company name) is required' });
      return;
    }
    
    const trimmedInput = input.trim();
    console.log(`[Manual Ideas] Processing single input: ${trimmedInput}`);
    
    // Resolve to ticker
    const resolved = await resolveToTicker(trimmedInput);
    if (!resolved) {
      res.status(404).json({ 
        error: `Could not find company: ${trimmedInput}`,
        suggestion: 'Try using the exact ticker symbol or full company name',
      });
      return;
    }
    
    // Check if ticker already exists in inbox
    const existingIdeas = await ideasRepository.getByTicker(resolved.ticker, 1);
    const recentIdea = existingIdeas.find(i => {
      const ideaDate = new Date(i.asOf);
      const daysSince = (Date.now() - ideaDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 30 && i.status === 'new';
    });
    
    if (recentIdea) {
      res.status(409).json({
        error: `${resolved.ticker} already exists in the inbox`,
        existingIdeaId: recentIdea.ideaId,
        existingDate: recentIdea.asOf,
      });
      return;
    }
    
    // Create the idea
    const idea = await createManualIdea(resolved.ticker, resolved.companyName, 'manual_single');
    
    console.log(`[Manual Ideas] Created idea for ${resolved.ticker} (${resolved.companyName})`);
    
    res.status(201).json({
      success: true,
      message: `Added ${resolved.ticker} (${resolved.companyName}) to Lane A inbox`,
      idea: {
        ideaId: idea.ideaId,
        ticker: idea.ticker,
        companyName: idea.companyName,
        status: idea.status,
        asOf: idea.asOf,
      },
    });
  } catch (error) {
    console.error('[Manual Ideas] Error adding single idea:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/manual-ideas/batch
 * Add multiple tickers or company names (comma-separated or array)
 */
manualIdeasRouter.post('/batch', async (req: Request, res: Response) => {
  try {
    let inputs: string[] = [];
    
    if (typeof req.body.inputs === 'string') {
      // Comma-separated string
      inputs = req.body.inputs.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    } else if (Array.isArray(req.body.inputs)) {
      inputs = req.body.inputs.map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    } else {
      res.status(400).json({ error: 'inputs must be a comma-separated string or an array' });
      return;
    }
    
    if (inputs.length === 0) {
      res.status(400).json({ error: 'At least one ticker or company name is required' });
      return;
    }
    
    if (inputs.length > 50) {
      res.status(400).json({ error: 'Maximum 50 items per batch. Use file upload for larger lists.' });
      return;
    }
    
    console.log(`[Manual Ideas] Processing batch of ${inputs.length} inputs`);
    
    const results: Array<{
      input: string;
      success: boolean;
      ticker?: string;
      companyName?: string;
      ideaId?: string;
      error?: string;
    }> = [];
    
    for (const input of inputs) {
      try {
        // Resolve to ticker
        const resolved = await resolveToTicker(input);
        if (!resolved) {
          results.push({ input, success: false, error: 'Company not found' });
          continue;
        }
        
        // Check for duplicates
        const existingIdeas = await ideasRepository.getByTicker(resolved.ticker, 1);
        const recentIdea = existingIdeas.find(i => {
          const ideaDate = new Date(i.asOf);
          const daysSince = (Date.now() - ideaDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysSince < 30 && i.status === 'new';
        });
        
        if (recentIdea) {
          results.push({
            input,
            success: false,
            ticker: resolved.ticker,
            companyName: resolved.companyName,
            error: 'Already in inbox',
          });
          continue;
        }
        
        // Create the idea
        const idea = await createManualIdea(resolved.ticker, resolved.companyName, 'manual_batch');
        
        results.push({
          input,
          success: true,
          ticker: resolved.ticker,
          companyName: resolved.companyName,
          ideaId: idea.ideaId,
        });
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        results.push({ input, success: false, error: (error as Error).message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`[Manual Ideas] Batch complete: ${successCount} added, ${failCount} failed`);
    
    res.status(200).json({
      success: true,
      message: `Processed ${inputs.length} items: ${successCount} added, ${failCount} failed`,
      summary: {
        total: inputs.length,
        added: successCount,
        failed: failCount,
      },
      results,
    });
  } catch (error) {
    console.error('[Manual Ideas] Error processing batch:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/manual-ideas/upload
 * Upload a CSV or Excel file with tickers/company names
 */
manualIdeasRouter.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    
    console.log(`[Manual Ideas] Processing uploaded file: ${req.file.originalname}`);
    
    let inputs: string[] = [];
    
    // Parse file based on type
    if (req.file.originalname.endsWith('.csv') || req.file.mimetype === 'text/csv') {
      // Parse CSV
      const content = req.file.buffer.toString('utf-8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
      
      // Look for ticker or company column
      for (const record of records as any[]) {
        const ticker = record.ticker || record.Ticker || record.TICKER || record.symbol || record.Symbol || record.SYMBOL;
        const company = record.company || record.Company || record.COMPANY || record.name || record.Name || record.NAME || record.company_name || record['Company Name'];
        
        if (ticker) {
          inputs.push(ticker);
        } else if (company) {
          inputs.push(company);
        }
      }
    } else {
      // Parse Excel
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const records = XLSX.utils.sheet_to_json(sheet);
      
      for (const record of records as any[]) {
        const ticker = record.ticker || record.Ticker || record.TICKER || record.symbol || record.Symbol || record.SYMBOL;
        const company = record.company || record.Company || record.COMPANY || record.name || record.Name || record.NAME || record.company_name || record['Company Name'];
        
        if (ticker) {
          inputs.push(String(ticker));
        } else if (company) {
          inputs.push(String(company));
        }
      }
    }
    
    // Remove duplicates
    inputs = [...new Set(inputs)];
    
    if (inputs.length === 0) {
      res.status(400).json({ 
        error: 'No valid tickers or company names found in file',
        hint: 'File should have a column named "ticker", "symbol", "company", or "name"',
      });
      return;
    }
    
    if (inputs.length > 200) {
      res.status(400).json({ error: `File contains ${inputs.length} items. Maximum is 200.` });
      return;
    }
    
    console.log(`[Manual Ideas] Found ${inputs.length} items in uploaded file`);
    
    // Process in batches to avoid timeout
    const results: Array<{
      input: string;
      success: boolean;
      ticker?: string;
      companyName?: string;
      ideaId?: string;
      error?: string;
    }> = [];
    
    for (const input of inputs) {
      try {
        const resolved = await resolveToTicker(input);
        if (!resolved) {
          results.push({ input, success: false, error: 'Company not found' });
          continue;
        }
        
        // Check for duplicates
        const existingIdeas = await ideasRepository.getByTicker(resolved.ticker, 1);
        const recentIdea = existingIdeas.find(i => {
          const ideaDate = new Date(i.asOf);
          const daysSince = (Date.now() - ideaDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysSince < 30 && i.status === 'new';
        });
        
        if (recentIdea) {
          results.push({
            input,
            success: false,
            ticker: resolved.ticker,
            companyName: resolved.companyName,
            error: 'Already in inbox',
          });
          continue;
        }
        
        const idea = await createManualIdea(resolved.ticker, resolved.companyName, 'manual_upload');
        
        results.push({
          input,
          success: true,
          ticker: resolved.ticker,
          companyName: resolved.companyName,
          ideaId: idea.ideaId,
        });
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        results.push({ input, success: false, error: (error as Error).message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`[Manual Ideas] Upload complete: ${successCount} added, ${failCount} failed`);
    
    res.status(200).json({
      success: true,
      message: `Processed ${inputs.length} items from file: ${successCount} added, ${failCount} failed`,
      fileName: req.file.originalname,
      summary: {
        total: inputs.length,
        added: successCount,
        failed: failCount,
      },
      results,
    });
  } catch (error) {
    console.error('[Manual Ideas] Error processing upload:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/manual-ideas/search
 * Search for companies by name (for autocomplete)
 */
manualIdeasRouter.post('/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      res.status(400).json({ error: 'Query must be at least 2 characters' });
      return;
    }
    
    const fmp = createFMPClient();
    const searchResult = await fmp.searchCompany(query.trim(), 10);
    
    if (!searchResult.success || !searchResult.data) {
      res.json({ results: [] });
      return;
    }
    
    const results = searchResult.data.map((r: any) => ({
      ticker: r.symbol,
      companyName: r.name,
      exchange: r.stockExchange || r.exchangeShortName,
    }));
    
    res.json({ results });
  } catch (error) {
    console.error('[Manual Ideas] Error searching:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/manual-ideas/template
 * Download a template CSV file for bulk upload
 */
manualIdeasRouter.get('/template', (req: Request, res: Response) => {
  const csvContent = `ticker,company_name,notes
AAPL,Apple Inc.,Example entry with ticker
MSFT,Microsoft Corporation,Another example
,Tesla Inc.,Example with company name only
GOOGL,,Example with ticker only`;
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=manual_ideas_template.csv');
  res.send(csvContent);
});
