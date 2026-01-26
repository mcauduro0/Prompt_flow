/**
 * Piotroski F-Score Calculator
 * 
 * The F-Score is a 0-9 metric developed by Joseph Piotroski (2000) to identify
 * companies with strong fundamentals. Each criterion is worth 1 point.
 * 
 * Criteria:
 * 1. ROA > 0 (positive net income)
 * 2. CFO > 0 (positive operating cash flow)
 * 3. ΔROA > 0 (ROA improved vs prior year)
 * 4. CFO > Net Income (quality of earnings)
 * 5. ΔLeverage < 0 (debt decreased)
 * 6. ΔLiquidity > 0 (current ratio improved)
 * 7. No equity issuance
 * 8. ΔGross Margin > 0
 * 9. ΔAsset Turnover > 0
 * 
 * @author ARC Investment Factory
 */

const FMP_API_KEY = process.env.FMP_API_KEY || 'NzfGEUAOUqFjkYP0Q8AD48TapcCZVUEL';
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

interface FinancialData {
  income: any[];
  balance: any[];
  cashflow: any[];
}

interface PiotroskiResult {
  fscore: number;
  details: {
    roa: number;
    cfo: number;
    deltaRoa: number;
    accruals: number;
    deltaLeverage: number;
    deltaLiquidity: number;
    noEquityIssue: number;
    deltaMargin: number;
    deltaTurnover: number;
  };
  metrics: {
    roa: number;
    cfo: number;
    currentRatio: number;
    grossMargin: number;
    debtToAssets: number;
  };
}

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

async function getFinancialData(ticker: string): Promise<FinancialData | null> {
  try {
    const [income, balance, cashflow] = await Promise.all([
      fetchWithRetry(`${FMP_BASE_URL}/income-statement/${ticker}?period=annual&limit=3&apikey=${FMP_API_KEY}`),
      fetchWithRetry(`${FMP_BASE_URL}/balance-sheet-statement/${ticker}?period=annual&limit=3&apikey=${FMP_API_KEY}`),
      fetchWithRetry(`${FMP_BASE_URL}/cash-flow-statement/${ticker}?period=annual&limit=3&apikey=${FMP_API_KEY}`)
    ]);

    if (!income?.length || !balance?.length || !cashflow?.length) {
      return null;
    }

    return { income, balance, cashflow };
  } catch (error) {
    console.error(`Error fetching financial data for ${ticker}:`, error);
    return null;
  }
}

export async function calculatePiotroskiFScore(ticker: string): Promise<PiotroskiResult | null> {
  const data = await getFinancialData(ticker);
  
  if (!data || data.income.length < 2 || data.balance.length < 2 || data.cashflow.length < 1) {
    return null;
  }

  // Current and previous period data (most recent first in FMP)
  const incCurr = data.income[0];
  const incPrev = data.income[1];
  const balCurr = data.balance[0];
  const balPrev = data.balance[1];
  const cfCurr = data.cashflow[0];

  let fscore = 0;
  const details = {
    roa: 0,
    cfo: 0,
    deltaRoa: 0,
    accruals: 0,
    deltaLeverage: 0,
    deltaLiquidity: 0,
    noEquityIssue: 0,
    deltaMargin: 0,
    deltaTurnover: 0
  };

  // Extract values with defaults
  const totalAssets = balCurr.totalAssets || 0;
  const totalAssetsPrev = balPrev.totalAssets || 0;
  const netIncome = incCurr.netIncome || 0;
  const netIncomePrev = incPrev.netIncome || 0;
  const cfo = cfCurr.operatingCashFlow || 0;
  const revenue = incCurr.revenue || 0;
  const revenuePrev = incPrev.revenue || 0;
  const grossProfit = incCurr.grossProfit || 0;
  const grossProfitPrev = incPrev.grossProfit || 0;
  const longTermDebt = balCurr.longTermDebt || 0;
  const longTermDebtPrev = balPrev.longTermDebt || 0;
  const currentAssets = balCurr.totalCurrentAssets || 0;
  const currentAssetsPrev = balPrev.totalCurrentAssets || 0;
  const currentLiab = balCurr.totalCurrentLiabilities || 1;
  const currentLiabPrev = balPrev.totalCurrentLiabilities || 1;
  const commonStock = balCurr.commonStock || 0;
  const commonStockPrev = balPrev.commonStock || 0;

  // Calculate metrics
  const roa = totalAssets > 0 ? netIncome / totalAssets : 0;
  const roaPrev = totalAssetsPrev > 0 ? netIncomePrev / totalAssetsPrev : 0;
  const currentRatio = currentLiab > 0 ? currentAssets / currentLiab : 0;
  const currentRatioPrev = currentLiabPrev > 0 ? currentAssetsPrev / currentLiabPrev : 0;
  const grossMargin = revenue > 0 ? grossProfit / revenue : 0;
  const grossMarginPrev = revenuePrev > 0 ? grossProfitPrev / revenuePrev : 0;
  const leverage = totalAssets > 0 ? longTermDebt / totalAssets : 0;
  const leveragePrev = totalAssetsPrev > 0 ? longTermDebtPrev / totalAssetsPrev : 0;
  const assetTurnover = totalAssets > 0 ? revenue / totalAssets : 0;
  const assetTurnoverPrev = totalAssetsPrev > 0 ? revenuePrev / totalAssetsPrev : 0;

  // 1. ROA > 0
  if (roa > 0) {
    fscore += 1;
    details.roa = 1;
  }

  // 2. CFO > 0
  if (cfo > 0) {
    fscore += 1;
    details.cfo = 1;
  }

  // 3. ΔROA > 0
  if (roa > roaPrev) {
    fscore += 1;
    details.deltaRoa = 1;
  }

  // 4. Accruals: CFO > Net Income
  if (cfo > netIncome) {
    fscore += 1;
    details.accruals = 1;
  }

  // 5. ΔLeverage < 0 (debt decreased)
  if (leverage < leveragePrev) {
    fscore += 1;
    details.deltaLeverage = 1;
  }

  // 6. ΔLiquidity > 0 (current ratio improved)
  if (currentRatio > currentRatioPrev) {
    fscore += 1;
    details.deltaLiquidity = 1;
  }

  // 7. No equity issuance
  if (commonStock <= commonStockPrev) {
    fscore += 1;
    details.noEquityIssue = 1;
  }

  // 8. ΔGross Margin > 0
  if (grossMargin > grossMarginPrev) {
    fscore += 1;
    details.deltaMargin = 1;
  }

  // 9. ΔAsset Turnover > 0
  if (assetTurnover > assetTurnoverPrev) {
    fscore += 1;
    details.deltaTurnover = 1;
  }

  return {
    fscore,
    details,
    metrics: {
      roa: roa * 100,
      cfo,
      currentRatio,
      grossMargin: grossMargin * 100,
      debtToAssets: leverage * 100
    }
  };
}

export function getPiotroskiInterpretation(fscore: number): string {
  if (fscore >= 8) return 'Excellent';
  if (fscore >= 7) return 'Strong';
  if (fscore >= 5) return 'Average';
  if (fscore >= 3) return 'Below Average';
  return 'Weak';
}

export function getPiotroskiRecommendation(fscore: number, turnaroundQuintile: number): string {
  // Based on backtest findings: Low Piotroski + High Turnaround = BEST
  if (fscore <= 6 && turnaroundQuintile >= 4) return 'STRONG BUY';
  if (fscore <= 6 && turnaroundQuintile >= 2) return 'BUY';
  if (fscore >= 7 && turnaroundQuintile >= 4) return 'HOLD';
  if (fscore >= 7 && turnaroundQuintile <= 2) return 'AVOID';
  return 'HOLD';
}
