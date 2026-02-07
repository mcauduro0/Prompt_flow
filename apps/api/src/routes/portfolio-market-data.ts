/**
 * Portfolio Market Data API v3
 * 
 * Provides real-time market data for portfolio positions including:
 * - Current price and previous close
 * - Daily change (%)
 * - 3-month and 12-month returns
 * - Forward P/E and EV/EBITDA
 * - Price targets from IC Memo (bear/base/bull) and upside
 * 
 * Data Sources: 
 * - Polygon.io (primary for US stocks)
 * - FMP (fallback for international stocks)
 * - IC Memo database (price targets)
 */

import { Router, Request, Response } from "express";
import type { Router as RouterType } from "express";
import { icMemosRepository } from "@arc/database";

const router: RouterType = Router();

// API Keys from environment
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || "";
const FMP_API_KEY = process.env.FMP_API_KEY || "";

// ============================================================================
// TYPES
// ============================================================================

interface MarketDataItem {
  ticker: string;
  companyName: string;
  // Price data
  currentPrice: number | null;
  previousClose: number | null;
  changePercent: number | null;
  // Returns
  return3M: number | null;
  return12M: number | null;
  // Valuation
  peForward: number | null;
  evEbitdaForward: number | null;
  // Analyst targets (from IC Memo)
  priceTargetBear: number | null;
  priceTargetBase: number | null;
  priceTargetBull: number | null;
  upsidePercent: number | null;
  // Metadata
  lastUpdated: string;
  dataSource: "polygon" | "fmp" | "mixed";
  priceTargetSource: "ic_memo" | "fmp" | null;
}

interface PolygonSnapshotTicker {
  day?: { c: number };
  prevDay?: { c: number };
}

interface PolygonAggResult {
  c: number;
}

interface FMPQuote {
  price?: number;
  previousClose?: number;
  changesPercentage?: number;
}

interface FMPPriceTarget {
  targetConsensus?: number;
  targetHigh?: number;
  targetLow?: number;
}

interface FMPRatios {
  priceEarningsRatioTTM?: number;
}

interface FMPKeyMetrics {
  enterpriseValueOverEBITDATTM?: number;
}

interface FMPHistorical {
  historical?: Array<{ close: number }>;
}

interface ICMemoPriceTargets {
  bear: number | null;
  base: number | null;
  bull: number | null;
}

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

async function getICMemoPriceTargets(ticker: string): Promise<ICMemoPriceTargets | null> {
  try {
    // Get the most recent IC Memos for this ticker (already ordered by createdAt desc)
    const memos = await icMemosRepository.getByTicker(ticker.toUpperCase());

    if (memos.length === 0) {
      return null;
    }

    // Get the first (most recent) memo
    const memo = memos[0];
    const memoContent = memo.memoContent as any;
    
    if (!memoContent?.valuation?.value_range) {
      return null;
    }

    const valueRange = memoContent.valuation.value_range;
    return {
      bear: valueRange.bear || null,
      base: valueRange.base || null,
      bull: valueRange.bull || null,
    };
  } catch (error) {
    console.error(`IC Memo price target error for ${ticker}:`, error);
    return null;
  }
}

// ============================================================================
// POLYGON API FUNCTIONS
// ============================================================================

async function getPolygonSnapshot(ticker: string): Promise<PolygonSnapshotTicker | null> {
  try {
    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json() as { ticker?: PolygonSnapshotTicker };
    return data.ticker || null;
  } catch (error) {
    console.error(`Polygon snapshot error for ${ticker}:`, error);
    return null;
  }
}

async function getPolygonHistoricalPrice(ticker: string, daysAgo: number): Promise<number | null> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo - 5); // Buffer for weekends/holidays
    
    const from = startDate.toISOString().split('T')[0];
    const to = endDate.toISOString().split('T')[0];
    
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=10&apiKey=${POLYGON_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json() as { results?: PolygonAggResult[] };
    
    // Get the first available price (closest to target date)
    return data.results?.[0]?.c || null;
  } catch (error) {
    console.error(`Polygon historical price error for ${ticker}:`, error);
    return null;
  }
}

// ============================================================================
// FMP API FUNCTIONS (FALLBACK FOR INTERNATIONAL STOCKS)
// ============================================================================

async function getFMPQuote(ticker: string): Promise<FMPQuote | null> {
  try {
    const url = `https://financialmodelingprep.com/api/v3/quote/${ticker}?apikey=${FMP_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json() as FMPQuote[];
    return data[0] || null;
  } catch (error) {
    console.error(`FMP quote error for ${ticker}:`, error);
    return null;
  }
}

async function getFMPPriceTarget(ticker: string): Promise<FMPPriceTarget | null> {
  try {
    const url = `https://financialmodelingprep.com/api/v4/price-target-consensus?symbol=${ticker}&apikey=${FMP_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json() as FMPPriceTarget[];
    return data[0] || null;
  } catch (error) {
    console.error(`FMP price target error for ${ticker}:`, error);
    return null;
  }
}

async function getFMPKeyMetrics(ticker: string): Promise<FMPKeyMetrics | null> {
  try {
    const url = `https://financialmodelingprep.com/api/v3/key-metrics-ttm/${ticker}?apikey=${FMP_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json() as FMPKeyMetrics[];
    return data[0] || null;
  } catch (error) {
    console.error(`FMP key metrics error for ${ticker}:`, error);
    return null;
  }
}

async function getFMPRatios(ticker: string): Promise<FMPRatios | null> {
  try {
    const url = `https://financialmodelingprep.com/api/v3/ratios-ttm/${ticker}?apikey=${FMP_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json() as FMPRatios[];
    return data[0] || null;
  } catch (error) {
    console.error(`FMP ratios error for ${ticker}:`, error);
    return null;
  }
}

async function getFMPHistoricalPrice(ticker: string, daysAgo: number): Promise<number | null> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo - 5);
    
    const from = startDate.toISOString().split('T')[0];
    const to = endDate.toISOString().split('T')[0];
    
    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${ticker}?from=${from}&to=${to}&apikey=${FMP_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json() as FMPHistorical;
    
    // Get the first available price (closest to target date)
    return data.historical?.[0]?.close || null;
  } catch (error) {
    console.error(`FMP historical price error for ${ticker}:`, error);
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if ticker is likely an international stock
 * International tickers typically have a suffix like .L (London), .HE (Helsinki), etc.
 */
function isInternationalTicker(ticker: string): boolean {
  return ticker.includes('.');
}

/**
 * Get the clean ticker for API calls
 * For FMP, international tickers need the exchange suffix
 * For Polygon, we only use US tickers without suffix
 */
function getCleanTicker(ticker: string, forPolygon: boolean = false): string {
  if (forPolygon) {
    // Polygon only supports US stocks, remove any suffix
    return ticker.split('.')[0].toUpperCase();
  }
  // FMP supports international tickers with their exchange suffix
  return ticker.toUpperCase();
}

// ============================================================================
// COMBINED DATA FETCHER
// ============================================================================

async function getMarketDataForTicker(ticker: string, companyName: string): Promise<MarketDataItem> {
  let dataSource: "polygon" | "fmp" | "mixed" = "polygon";
  let priceTargetSource: "ic_memo" | "fmp" | null = null;
  
  // Initialize result
  const result: MarketDataItem = {
    ticker,
    companyName,
    currentPrice: null,
    previousClose: null,
    changePercent: null,
    return3M: null,
    return12M: null,
    peForward: null,
    evEbitdaForward: null,
    priceTargetBear: null,
    priceTargetBase: null,
    priceTargetBull: null,
    upsidePercent: null,
    lastUpdated: new Date().toISOString(),
    dataSource: "polygon",
    priceTargetSource: null,
  };

  const isInternational = isInternationalTicker(ticker);
  const polygonTicker = getCleanTicker(ticker, true);
  const fmpTicker = getCleanTicker(ticker, false);

  // =========================================================================
  // PRICE DATA: Try Polygon first for US stocks, FMP for international
  // =========================================================================
  
  if (!isInternational) {
    // US stock: Try Polygon first
    const polygonSnapshot = await getPolygonSnapshot(polygonTicker);
    
    if (polygonSnapshot && (polygonSnapshot.day?.c || polygonSnapshot.prevDay?.c)) {
      result.currentPrice = polygonSnapshot.day?.c || polygonSnapshot.prevDay?.c || null;
      result.previousClose = polygonSnapshot.prevDay?.c || null;
      
      if (result.currentPrice && result.previousClose) {
        result.changePercent = ((result.currentPrice - result.previousClose) / result.previousClose) * 100;
      }
    } else {
      // Polygon failed, fallback to FMP
      dataSource = "fmp";
      const fmpQuote = await getFMPQuote(fmpTicker);
      
      if (fmpQuote) {
        result.currentPrice = fmpQuote.price || null;
        result.previousClose = fmpQuote.previousClose || null;
        result.changePercent = fmpQuote.changesPercentage || null;
      }
    }
  } else {
    // International stock: Use FMP directly
    dataSource = "fmp";
    const fmpQuote = await getFMPQuote(fmpTicker);
    
    if (fmpQuote) {
      result.currentPrice = fmpQuote.price || null;
      result.previousClose = fmpQuote.previousClose || null;
      result.changePercent = fmpQuote.changesPercentage || null;
    }
  }

  // =========================================================================
  // HISTORICAL PRICES FOR RETURNS
  // =========================================================================
  
  let price3MAgo: number | null = null;
  let price12MAgo: number | null = null;
  
  if (!isInternational) {
    // US stock: Try Polygon first, then FMP
    price3MAgo = await getPolygonHistoricalPrice(polygonTicker, 90);
    if (!price3MAgo) {
      price3MAgo = await getFMPHistoricalPrice(fmpTicker, 90);
      if (price3MAgo && dataSource === "polygon") dataSource = "mixed";
    }
    
    price12MAgo = await getPolygonHistoricalPrice(polygonTicker, 365);
    if (!price12MAgo) {
      price12MAgo = await getFMPHistoricalPrice(fmpTicker, 365);
      if (price12MAgo && dataSource === "polygon") dataSource = "mixed";
    }
  } else {
    // International: Use FMP
    price3MAgo = await getFMPHistoricalPrice(fmpTicker, 90);
    price12MAgo = await getFMPHistoricalPrice(fmpTicker, 365);
  }

  if (result.currentPrice && price3MAgo) {
    result.return3M = ((result.currentPrice - price3MAgo) / price3MAgo) * 100;
  }
  
  if (result.currentPrice && price12MAgo) {
    result.return12M = ((result.currentPrice - price12MAgo) / price12MAgo) * 100;
  }

  // =========================================================================
  // VALUATION METRICS (always from FMP)
  // =========================================================================
  
  const fmpRatios = await getFMPRatios(fmpTicker);
  const fmpKeyMetrics = await getFMPKeyMetrics(fmpTicker);
  
  if (fmpRatios) {
    result.peForward = fmpRatios.priceEarningsRatioTTM || null;
    if (dataSource === "polygon") dataSource = "mixed";
  }
  
  if (fmpKeyMetrics) {
    result.evEbitdaForward = fmpKeyMetrics.enterpriseValueOverEBITDATTM || null;
  }

  // =========================================================================
  // PRICE TARGETS: First try IC Memo, then fallback to FMP
  // =========================================================================
  
  // Try to get price targets from IC Memo first
  const icMemoTargets = await getICMemoPriceTargets(ticker);
  
  if (icMemoTargets && icMemoTargets.base) {
    result.priceTargetBear = icMemoTargets.bear;
    result.priceTargetBase = icMemoTargets.base;
    result.priceTargetBull = icMemoTargets.bull;
    priceTargetSource = "ic_memo";
    
    if (result.currentPrice && result.priceTargetBase) {
      result.upsidePercent = ((result.priceTargetBase - result.currentPrice) / result.currentPrice) * 100;
    }
  } else {
    // Fallback to FMP for price targets
    const fmpPriceTarget = await getFMPPriceTarget(fmpTicker);
    
    if (fmpPriceTarget && fmpPriceTarget.targetConsensus) {
      result.priceTargetBear = fmpPriceTarget.targetLow || null;
      result.priceTargetBase = fmpPriceTarget.targetConsensus || null;
      result.priceTargetBull = fmpPriceTarget.targetHigh || null;
      priceTargetSource = "fmp";
      
      if (result.currentPrice && result.priceTargetBase) {
        result.upsidePercent = ((result.priceTargetBase - result.currentPrice) / result.currentPrice) * 100;
      }
    }
  }

  result.dataSource = dataSource;
  result.priceTargetSource = priceTargetSource;
  return result;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * GET /api/portfolio/market-data
 * 
 * Fetches market data for a list of tickers
 * Query params:
 *   - tickers: comma-separated list of ticker symbols
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const tickersParam = req.query.tickers as string;
    
    if (!tickersParam) {
      res.status(400).json({ error: "Missing 'tickers' query parameter" });
      return;
    }

    const tickers = tickersParam.split(",").map(t => t.trim()).filter(Boolean);
    
    if (tickers.length === 0) {
      res.status(400).json({ error: "No valid tickers provided" });
      return;
    }

    // Limit to 50 tickers per request to avoid rate limiting
    const limitedTickers = tickers.slice(0, 50);

    // Fetch data for all tickers in parallel (with some batching)
    const results: MarketDataItem[] = [];
    const batchSize = 5; // Reduced batch size for more API calls per ticker
    
    for (let i = 0; i < limitedTickers.length; i += batchSize) {
      const batch = limitedTickers.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(ticker => getMarketDataForTicker(ticker, ""))
      );
      results.push(...batchResults);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < limitedTickers.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    res.json({
      data: results,
      meta: {
        requested: tickers.length,
        returned: results.length,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error("Market data fetch error:", error);
    res.status(500).json({ error: "Failed to fetch market data", details: String(error) });
  }
});

/**
 * GET /api/portfolio/market-data/:ticker
 * 
 * Fetches market data for a single ticker
 */
router.get("/:ticker", async (req: Request, res: Response) => {
  try {
    const { ticker } = req.params;
    const companyName = req.query.name as string || "";
    
    const data = await getMarketDataForTicker(ticker, companyName);
    
    res.json(data);
  } catch (error) {
    console.error(`Market data fetch error for ${req.params.ticker}:`, error);
    res.status(500).json({ error: "Failed to fetch market data", details: String(error) });
  }
});

/**
 * POST /api/portfolio/market-data/batch
 * 
 * Fetches market data for multiple tickers with company names
 * Body: { positions: [{ ticker: string, companyName: string }] }
 */
router.post("/batch", async (req: Request, res: Response) => {
  try {
    const { positions } = req.body;
    
    if (!positions || !Array.isArray(positions)) {
      res.status(400).json({ error: "Missing 'positions' array in request body" });
      return;
    }

    // Limit to 50 positions per request
    const limitedPositions = positions.slice(0, 50);

    // Fetch data for all positions in parallel (with batching)
    const results: MarketDataItem[] = [];
    const batchSize = 5;
    
    for (let i = 0; i < limitedPositions.length; i += batchSize) {
      const batch = limitedPositions.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((pos: { ticker: string; companyName: string }) => 
          getMarketDataForTicker(pos.ticker, pos.companyName)
        )
      );
      results.push(...batchResults);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < limitedPositions.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    res.json({
      data: results,
      meta: {
        requested: positions.length,
        returned: results.length,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error("Batch market data fetch error:", error);
    res.status(500).json({ error: "Failed to fetch market data", details: String(error) });
  }
});

export const portfolioMarketDataRouter: RouterType = router;
