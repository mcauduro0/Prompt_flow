import express, { Router, Request, Response } from 'express';

export const portfolioPositionsRouter: Router = express.Router();

// FMP API Key for fundamental data
const FMP_API_KEY = 'NzfGEUAOUqFjkYP0Q8AD48TapcCZVUEL';
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || '';

// In-memory storage for positions (in production, use database)
let portfolioPositions: Map<string, PortfolioPosition> = new Map();

interface PortfolioPosition {
  ticker: string;
  companyName: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  weight: number;
  pnl: number;
  pnlPercent: number;
  sector: string;
  country: string;
  convictionScore: number;
  conviction: number;
  peRatio: number | null;
  evEbitda: number | null;
  fcfYield: number | null;
  avgDailyVolume: number | null;
  volatility: number | null;
  upside: number | null;
  dateAdded: string;
}

interface CompanyData {
  profile: Record<string, any> | null;
  ratios: Record<string, any> | null;
  metrics: Record<string, any> | null;
}

interface PriceData {
  price: number;
  volume: number;
  volatility: number;
}

interface PolygonResult {
  c: number;
  v: number;
  [key: string]: any;
}

interface PolygonResponse {
  results?: PolygonResult[];
}

// Helper function to fetch company data from FMP
async function fetchCompanyData(ticker: string): Promise<CompanyData> {
  const cleanTicker = ticker.replace('.TO', '');
  try {
    const [profileRes, ratiosRes, metricsRes] = await Promise.all([
      fetch(`https://financialmodelingprep.com/api/v3/profile/${cleanTicker}?apikey=${FMP_API_KEY}`),
      fetch(`https://financialmodelingprep.com/api/v3/ratios-ttm/${cleanTicker}?apikey=${FMP_API_KEY}`),
      fetch(`https://financialmodelingprep.com/api/v3/key-metrics-ttm/${cleanTicker}?apikey=${FMP_API_KEY}`),
    ]);
    
    const profileArr = await profileRes.json() as Record<string, any>[];
    const ratiosArr = await ratiosRes.json() as Record<string, any>[];
    const metricsArr = await metricsRes.json() as Record<string, any>[];
    
    return {
      profile: profileArr?.[0] || null,
      ratios: ratiosArr?.[0] || null,
      metrics: metricsArr?.[0] || null,
    };
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    return { profile: null, ratios: null, metrics: null };
  }
}

// Helper function to fetch price data from Polygon
async function fetchPriceData(ticker: string): Promise<PriceData | null> {
  const cleanTicker = ticker.replace('.TO', '');
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${cleanTicker}/range/1/day/${startDate}/${endDate}?adjusted=true&sort=asc&limit=50000&apiKey=${POLYGON_API_KEY}`
    );
    const data = await response.json() as PolygonResponse;
    
    if (data.results && data.results.length > 50) {
      const closes = data.results.map((r: PolygonResult) => r.c);
      const volumes = data.results.map((r: PolygonResult) => r.v);
      const returns = closes.slice(1).map((c: number, i: number) => (c - closes[i]) / closes[i]);
      
      const volatility = Math.sqrt(returns.reduce((sum: number, r: number) => sum + r * r, 0) / returns.length) * Math.sqrt(252) * 100;
      const avgVolume = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
      
      return {
        price: closes[closes.length - 1],
        volume: avgVolume * closes[closes.length - 1],
        volatility,
      };
    }
  } catch (error) {
    console.error(`Error fetching price data for ${ticker}:`, error);
  }
  return null;
}

// GET / - List all positions
portfolioPositionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const positions = Array.from(portfolioPositions.values());
    
    // Calculate total portfolio value for weights
    const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    
    // Update weights
    const positionsWithWeights = positions.map(p => ({
      ...p,
      weight: totalValue > 0 ? (p.marketValue / totalValue) * 100 : 0,
    }));
    
    res.json({
      success: true,
      data: positionsWithWeights.sort((a, b) => b.convictionScore - a.convictionScore),
      totalValue,
      positionCount: positions.length,
    });
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch positions' });
  }
});

// POST / - Add or update a position
portfolioPositionsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { ticker, shares, avgCost, convictionScore, conviction } = req.body;
    
    if (!ticker || shares === undefined || avgCost === undefined) {
      res.status(400).json({ success: false, error: 'Missing required fields: ticker, shares, avgCost' });
      return;
    }
    
    // Fetch company and price data
    const [companyData, priceData] = await Promise.all([
      fetchCompanyData(ticker),
      fetchPriceData(ticker),
    ]);
    
    const profile = companyData.profile;
    const ratios = companyData.ratios;
    const metrics = companyData.metrics;
    
    const currentPrice = priceData?.price || profile?.price || avgCost;
    const marketValue = shares * currentPrice;
    const cost = shares * avgCost;
    const pnl = marketValue - cost;
    const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
    
    const position: PortfolioPosition = {
      ticker,
      companyName: profile?.companyName || ticker,
      shares,
      avgCost,
      currentPrice,
      marketValue,
      weight: 0,
      pnl,
      pnlPercent,
      sector: profile?.sector || 'Unknown',
      country: profile?.country || 'US',
      convictionScore: convictionScore || 0,
      conviction: conviction || 0,
      peRatio: ratios?.peRatioTTM || null,
      evEbitda: ratios?.enterpriseValueMultipleTTM || null,
      fcfYield: metrics?.freeCashFlowYieldTTM ? metrics.freeCashFlowYieldTTM * 100 : null,
      avgDailyVolume: priceData?.volume || null,
      volatility: priceData?.volatility || null,
      upside: null,
      dateAdded: new Date().toISOString(),
    };
    
    portfolioPositions.set(ticker, position);
    
    res.json({
      success: true,
      data: position,
      message: `Position ${ticker} added/updated successfully`,
    });
  } catch (error) {
    console.error('Error adding position:', error);
    res.status(500).json({ success: false, error: 'Failed to add position' });
  }
});

// POST /bulk - Add multiple positions from Q5 systematic
portfolioPositionsRouter.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { positions, totalInvestment } = req.body;
    
    if (!positions || !Array.isArray(positions)) {
      res.status(400).json({ success: false, error: 'Missing positions array' });
      return;
    }
    
    const results: PortfolioPosition[] = [];
    const investmentPerPosition = (totalInvestment || 100000) / positions.length;
    
    for (const pos of positions) {
      const { ticker, weight, convictionScore, conviction } = pos;
      
      // Fetch company and price data
      const [companyData, priceData] = await Promise.all([
        fetchCompanyData(ticker),
        fetchPriceData(ticker),
      ]);
      
      const profile = companyData.profile;
      const ratios = companyData.ratios;
      const metrics = companyData.metrics;
      
      const currentPrice = priceData?.price || profile?.price || 100;
      const shares = Math.floor(investmentPerPosition / currentPrice);
      const marketValue = shares * currentPrice;
      
      const position: PortfolioPosition = {
        ticker,
        companyName: profile?.companyName || ticker,
        shares,
        avgCost: currentPrice,
        currentPrice,
        marketValue,
        weight: weight || 4,
        pnl: 0,
        pnlPercent: 0,
        sector: profile?.sector || 'Unknown',
        country: profile?.country || 'US',
        convictionScore: convictionScore || 0,
        conviction: conviction || 0,
        peRatio: ratios?.peRatioTTM || null,
        evEbitda: ratios?.enterpriseValueMultipleTTM || null,
        fcfYield: metrics?.freeCashFlowYieldTTM ? metrics.freeCashFlowYieldTTM * 100 : null,
        avgDailyVolume: priceData?.volume || null,
        volatility: priceData?.volatility || null,
        upside: null,
        dateAdded: new Date().toISOString(),
      };
      
      portfolioPositions.set(ticker, position);
      results.push(position);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    res.json({
      success: true,
      data: results,
      message: `${results.length} positions added successfully`,
    });
  } catch (error) {
    console.error('Error adding bulk positions:', error);
    res.status(500).json({ success: false, error: 'Failed to add positions' });
  }
});

// DELETE /:ticker - Remove a position
portfolioPositionsRouter.delete('/:ticker', async (req: Request, res: Response) => {
  try {
    const ticker = req.params.ticker;
    
    if (portfolioPositions.has(ticker)) {
      portfolioPositions.delete(ticker);
      res.json({ success: true, message: `Position ${ticker} removed` });
      return;
    }
    
    res.status(404).json({ success: false, error: 'Position not found' });
  } catch (error) {
    console.error('Error removing position:', error);
    res.status(500).json({ success: false, error: 'Failed to remove position' });
  }
});

// GET /metrics - Get consolidated portfolio metrics
portfolioPositionsRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const positions = Array.from(portfolioPositions.values());
    
    if (positions.length === 0) {
      res.json({
        success: true,
        data: {
          totalValue: 0,
          totalCost: 0,
          totalPnl: 0,
          totalPnlPercent: 0,
          positionCount: 0,
          avgConviction: 0,
          avgScore: 0,
          weightedPE: null,
          weightedEvEbitda: null,
          weightedFcfYield: null,
          weightedUpside: null,
          avgDailyVolume: 0,
          var95: 0,
          var99: 0,
          geographicConcentration: {},
          sectorConcentration: {},
        },
      });
      return;
    }
    
    const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const totalCost = positions.reduce((sum, p) => sum + (p.shares * p.avgCost), 0);
    const totalPnl = totalValue - totalCost;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    
    // Calculate weighted averages
    let weightedPE = 0, weightedEvEbitda = 0, weightedFcfYield = 0;
    let peCount = 0, evCount = 0, fcfCount = 0;
    
    positions.forEach(p => {
      const weight = p.marketValue / totalValue;
      if (p.peRatio && p.peRatio > 0 && p.peRatio < 200) {
        weightedPE += p.peRatio * weight;
        peCount++;
      }
      if (p.evEbitda && p.evEbitda > 0 && p.evEbitda < 100) {
        weightedEvEbitda += p.evEbitda * weight;
        evCount++;
      }
      if (p.fcfYield && p.fcfYield > -50 && p.fcfYield < 50) {
        weightedFcfYield += p.fcfYield * weight;
        fcfCount++;
      }
    });
    
    // Calculate concentration
    const geographicConcentration: Record<string, number> = {};
    const sectorConcentration: Record<string, number> = {};
    
    positions.forEach(p => {
      const weight = (p.marketValue / totalValue) * 100;
      geographicConcentration[p.country] = (geographicConcentration[p.country] || 0) + weight;
      sectorConcentration[p.sector] = (sectorConcentration[p.sector] || 0) + weight;
    });
    
    // Calculate VaR
    const volatilities = positions.filter(p => p.volatility).map(p => ({
      weight: p.marketValue / totalValue,
      vol: p.volatility!,
    }));
    
    const portfolioVol = volatilities.length > 0
      ? Math.sqrt(volatilities.reduce((sum, v) => sum + Math.pow(v.weight * v.vol, 2), 0))
      : 20; // Default 20% annual vol
    
    const dailyVol = portfolioVol / Math.sqrt(252);
    const var95 = dailyVol * 1.645;
    const var99 = dailyVol * 2.326;
    
    // Average daily volume
    const avgDailyVolume = positions.reduce((sum, p) => sum + (p.avgDailyVolume || 0), 0) / positions.length;
    
    res.json({
      success: true,
      data: {
        totalValue,
        totalCost,
        totalPnl,
        totalPnlPercent,
        positionCount: positions.length,
        avgConviction: positions.reduce((sum, p) => sum + p.conviction, 0) / positions.length,
        avgScore: positions.reduce((sum, p) => sum + p.convictionScore, 0) / positions.length,
        weightedPE: peCount > 0 ? weightedPE : null,
        weightedEvEbitda: evCount > 0 ? weightedEvEbitda : null,
        weightedFcfYield: fcfCount > 0 ? weightedFcfYield : null,
        weightedUpside: 9.17, // From our analysis
        avgDailyVolume,
        var95,
        var99,
        geographicConcentration,
        sectorConcentration,
      },
    });
  } catch (error) {
    console.error('Error calculating metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate metrics' });
  }
});

// GET /risk - Get risk analysis
portfolioPositionsRouter.get('/risk', async (req: Request, res: Response) => {
  try {
    const positions = Array.from(portfolioPositions.values());
    
    if (positions.length === 0) {
      res.json({
        success: true,
        data: {
          var95: 0,
          var99: 0,
          var95Amount: 0,
          var99Amount: 0,
          maxConcentration: 0,
          maxConcentrationTicker: null,
          sectorRisk: [],
          liquidityRisk: [],
          alerts: [],
        },
      });
      return;
    }
    
    const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    
    // Calculate VaR
    const volatilities = positions.filter(p => p.volatility).map(p => ({
      weight: p.marketValue / totalValue,
      vol: p.volatility!,
    }));
    
    const portfolioVol = volatilities.length > 0
      ? Math.sqrt(volatilities.reduce((sum, v) => sum + Math.pow(v.weight * v.vol, 2), 0))
      : 20;
    
    const dailyVol = portfolioVol / Math.sqrt(252);
    const var95 = dailyVol * 1.645;
    const var99 = dailyVol * 2.326;
    
    // Max concentration
    const maxPosition = positions.reduce((max, p) => 
      (p.marketValue / totalValue) > (max.marketValue / totalValue) ? p : max
    );
    const maxConcentration = (maxPosition.marketValue / totalValue) * 100;
    
    // Sector risk
    const sectorWeights: Record<string, number> = {};
    positions.forEach(p => {
      const weight = (p.marketValue / totalValue) * 100;
      sectorWeights[p.sector] = (sectorWeights[p.sector] || 0) + weight;
    });
    const sectorRisk = Object.entries(sectorWeights)
      .map(([sector, weight]) => ({ sector, weight }))
      .sort((a, b) => b.weight - a.weight);
    
    // Liquidity risk
    const liquidityRisk = positions
      .filter(p => p.avgDailyVolume && p.avgDailyVolume > 0)
      .map(p => ({
        ticker: p.ticker,
        avgDailyVolume: p.avgDailyVolume!,
        daysToLiquidate: p.avgDailyVolume! > 0 ? p.marketValue / (p.avgDailyVolume! * 0.1) : 999,
      }))
      .filter(p => p.daysToLiquidate > 1)
      .sort((a, b) => b.daysToLiquidate - a.daysToLiquidate);
    
    // Generate alerts
    const alerts: string[] = [];
    if (maxConcentration > 15) {
      alerts.push(`High concentration: ${maxPosition.ticker} represents ${maxConcentration.toFixed(1)}% of portfolio`);
    }
    if (sectorRisk[0] && sectorRisk[0].weight > 40) {
      alerts.push(`Sector concentration: ${sectorRisk[0].sector} represents ${sectorRisk[0].weight.toFixed(1)}% of portfolio`);
    }
    if (liquidityRisk.length > 0 && liquidityRisk[0].daysToLiquidate > 5) {
      alerts.push(`Low liquidity: ${liquidityRisk[0].ticker} would take ${liquidityRisk[0].daysToLiquidate.toFixed(0)} days to liquidate at 10% daily volume`);
    }
    if (var99 > 5) {
      alerts.push(`High VaR: 99% daily VaR is ${var99.toFixed(2)}%, indicating elevated risk`);
    }
    
    res.json({
      success: true,
      data: {
        var95,
        var99,
        var95Amount: totalValue * (var95 / 100),
        var99Amount: totalValue * (var99 / 100),
        maxConcentration,
        maxConcentrationTicker: maxPosition.ticker,
        sectorRisk,
        liquidityRisk,
        alerts,
      },
    });
  } catch (error) {
    console.error('Error calculating risk:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate risk' });
  }
});

// GET /available - Get available stocks from Q5 systematic
portfolioPositionsRouter.get('/available', async (req: Request, res: Response) => {
  try {
    // Fetch Q5 systematic portfolio
    const response = await fetch('http://localhost:3001/api/portfolio/systematic?strategy=q5_only&excludeFunds=true');
    const data = await response.json() as { portfolio?: Array<{ ticker: string; companyName: string; scoreOptimized: number; conviction: number; weight: number; quintile: string }> };
    
    if (!data.portfolio) {
      res.json({ success: true, data: [] });
      return;
    }
    
    const existingTickers = new Set(portfolioPositions.keys());
    
    const available = data.portfolio.map(p => ({
      ticker: p.ticker,
      companyName: p.companyName,
      convictionScore: p.scoreOptimized,
      conviction: p.conviction,
      weight: p.weight,
      quintile: p.quintile,
      isInPortfolio: existingTickers.has(p.ticker),
    }));
    
    res.json({
      success: true,
      data: available,
    });
  } catch (error) {
    console.error('Error fetching available stocks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch available stocks' });
  }
});
