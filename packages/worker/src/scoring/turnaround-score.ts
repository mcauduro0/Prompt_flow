/**
 * Turnaround Score Calculator
 * 
 * The Turnaround Score (0-100) identifies capital dislocation and brutal value creation potential.
 * Unlike Piotroski (which measures absolute quality), this score measures IMPROVEMENT and MOMENTUM.
 * 
 * Formula:
 * Turnaround Score = 40% × Fundamental Improvement + 30% × Price Dislocation + 30% × Momentum Confirmation
 * 
 * Based on backtest findings:
 * - Q4 (scores 60-80) is the "sweet spot" with highest returns
 * - Low Piotroski + High Turnaround = BEST combination (+926% in 5 years)
 * 
 * @author ARC Investment Factory
 */

const FMP_API_KEY = process.env.FMP_API_KEY || 'NzfGEUAOUqFjkYP0Q8AD48TapcCZVUEL';
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

interface TurnaroundResult {
  score: number;
  quintile: number;
  components: {
    fundamentalImprovement: number;
    priceDislocation: number;
    momentumConfirmation: number;
  };
  details: {
    deltaRoe: number | null;
    deltaOpMargin: number | null;
    revenueAcceleration: number | null;
    deltaEbitdaMargin: number | null;
    distanceFromLow: number | null;
    peDiscount: number | null;
    momentum1m: number | null;
    momentumAcceleration: number | null;
    volumeTrend: number | null;
  };
  recommendation: string;
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

function normalizeMetric(value: number, minVal: number, maxVal: number, inverse = false): number {
  if (isNaN(value) || minVal === maxVal) return 50;
  let normalized = ((value - minVal) / (maxVal - minVal)) * 100;
  normalized = Math.max(0, Math.min(100, normalized));
  return inverse ? 100 - normalized : normalized;
}

function winsorize(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, value));
}

export async function calculateTurnaroundScore(ticker: string): Promise<TurnaroundResult | null> {
  try {
    // Fetch all required data
    const [income, balance, prices, quote] = await Promise.all([
      fetchWithRetry(`${FMP_BASE_URL}/income-statement/${ticker}?period=annual&limit=3&apikey=${FMP_API_KEY}`),
      fetchWithRetry(`${FMP_BASE_URL}/balance-sheet-statement/${ticker}?period=annual&limit=3&apikey=${FMP_API_KEY}`),
      fetchWithRetry(`${FMP_BASE_URL}/historical-price-full/${ticker}?timeseries=365&apikey=${FMP_API_KEY}`),
      fetchWithRetry(`${FMP_BASE_URL}/quote/${ticker}?apikey=${FMP_API_KEY}`)
    ]);

    if (!income?.length || !balance?.length || !prices?.historical?.length) {
      return null;
    }

    const priceHistory = prices.historical.reverse(); // Oldest first
    const quoteData = quote?.[0] || {};

    // ============================================================
    // FUNDAMENTAL IMPROVEMENT (40%)
    // ============================================================
    const fundamentalComponents: { name: string; score: number; weight: number }[] = [];
    const details: TurnaroundResult['details'] = {
      deltaRoe: null,
      deltaOpMargin: null,
      revenueAcceleration: null,
      deltaEbitdaMargin: null,
      distanceFromLow: null,
      peDiscount: null,
      momentum1m: null,
      momentumAcceleration: null,
      volumeTrend: null
    };

    if (income.length >= 2 && balance.length >= 2) {
      const incCurr = income[0];
      const incPrev = income[1];
      const balCurr = balance[0];
      const balPrev = balance[1];

      // ΔROE
      const equityCurr = balCurr.totalStockholdersEquity || 0;
      const equityPrev = balPrev.totalStockholdersEquity || 0;
      const niCurr = incCurr.netIncome || 0;
      const niPrev = incPrev.netIncome || 0;

      if (equityCurr > 0 && equityPrev > 0) {
        const roeCurr = niCurr / equityCurr;
        const roePrev = niPrev / equityPrev;
        const deltaRoe = winsorize((roeCurr - roePrev) * 100, -20, 20);
        details.deltaRoe = deltaRoe;
        const roeScore = normalizeMetric(deltaRoe, -10, 10);
        fundamentalComponents.push({ name: 'deltaRoe', score: roeScore, weight: 0.25 });
      }

      // ΔOperating Margin
      const revCurr = incCurr.revenue || 0;
      const revPrev = incPrev.revenue || 0;
      const opIncCurr = incCurr.operatingIncome || 0;
      const opIncPrev = incPrev.operatingIncome || 0;

      if (revCurr > 0 && revPrev > 0) {
        const opMarginCurr = opIncCurr / revCurr;
        const opMarginPrev = opIncPrev / revPrev;
        const deltaMargin = winsorize((opMarginCurr - opMarginPrev) * 100, -10, 10);
        details.deltaOpMargin = deltaMargin;
        const marginScore = normalizeMetric(deltaMargin, -5, 5);
        fundamentalComponents.push({ name: 'deltaOpMargin', score: marginScore, weight: 0.25 });
      }

      // Revenue Acceleration
      if (income.length >= 3) {
        const incPrev2 = income[2];
        const revPrev2 = incPrev2.revenue || 0;

        if (revPrev > 0 && revPrev2 > 0) {
          const growthCurr = (revCurr - revPrev) / revPrev;
          const growthPrev = (revPrev - revPrev2) / revPrev2;
          const acceleration = winsorize((growthCurr - growthPrev) * 100, -30, 30);
          details.revenueAcceleration = acceleration;
          const accelScore = normalizeMetric(acceleration, -20, 20);
          fundamentalComponents.push({ name: 'revenueAcceleration', score: accelScore, weight: 0.25 });
        }
      }

      // ΔEBITDA Margin
      const ebitdaCurr = incCurr.ebitda || 0;
      const ebitdaPrev = incPrev.ebitda || 0;

      if (revCurr > 0 && revPrev > 0) {
        const ebitdaMarginCurr = ebitdaCurr / revCurr;
        const ebitdaMarginPrev = ebitdaPrev / revPrev;
        const deltaEbitda = winsorize((ebitdaMarginCurr - ebitdaMarginPrev) * 100, -10, 10);
        details.deltaEbitdaMargin = deltaEbitda;
        const ebitdaScore = normalizeMetric(deltaEbitda, -5, 5);
        fundamentalComponents.push({ name: 'deltaEbitdaMargin', score: ebitdaScore, weight: 0.25 });
      }
    }

    const fundamentalScore = fundamentalComponents.length > 0
      ? fundamentalComponents.reduce((sum, c) => sum + c.score * c.weight, 0) / 
        fundamentalComponents.reduce((sum, c) => sum + c.weight, 0)
      : 50;

    // ============================================================
    // PRICE DISLOCATION (30%)
    // ============================================================
    const dislocationComponents: { name: string; score: number; weight: number }[] = [];

    // Distance from 52W Low
    if (priceHistory.length >= 200) {
      const prices252 = priceHistory.slice(-252);
      const high52w = Math.max(...prices252.map((p: any) => p.high));
      const low52w = Math.min(...prices252.map((p: any) => p.low));
      const currentPrice = prices252[prices252.length - 1].close;

      if (high52w > low52w) {
        const positionVsLow = ((currentPrice - low52w) / (high52w - low52w)) * 100;
        details.distanceFromLow = positionVsLow;
        // Closer to low = higher score (inverted)
        const lowScore = normalizeMetric(positionVsLow, 0, 100, true);
        dislocationComponents.push({ name: 'distanceFromLow', score: lowScore, weight: 0.50 });
      }
    }

    // P/E Discount (vs market average ~20)
    const pe = quoteData.pe || null;
    if (pe !== null && pe > 0 && pe < 100) {
      const peDiscount = winsorize((20 - pe) / 20 * 100, -100, 100);
      details.peDiscount = peDiscount;
      const peScore = normalizeMetric(peDiscount, -50, 50);
      dislocationComponents.push({ name: 'peDiscount', score: peScore, weight: 0.50 });
    }

    const dislocationScore = dislocationComponents.length > 0
      ? dislocationComponents.reduce((sum, c) => sum + c.score * c.weight, 0) /
        dislocationComponents.reduce((sum, c) => sum + c.weight, 0)
      : 50;

    // ============================================================
    // MOMENTUM CONFIRMATION (30%)
    // ============================================================
    const momentumComponents: { name: string; score: number; weight: number }[] = [];

    // Momentum 1M
    if (priceHistory.length >= 21) {
      const mom1m = (priceHistory[priceHistory.length - 1].close / 
                    priceHistory[priceHistory.length - 21].close - 1) * 100;
      const mom1mWinsorized = winsorize(mom1m, -30, 30);
      details.momentum1m = mom1mWinsorized;
      const mom1mScore = normalizeMetric(mom1mWinsorized, -20, 20);
      momentumComponents.push({ name: 'momentum1m', score: mom1mScore, weight: 0.40 });
    }

    // Momentum Acceleration (3M vs 12M annualized)
    if (priceHistory.length >= 252) {
      const mom3m = (priceHistory[priceHistory.length - 1].close / 
                    priceHistory[priceHistory.length - 63].close - 1) * 100;
      const mom12m = (priceHistory[priceHistory.length - 1].close / 
                     priceHistory[priceHistory.length - 252].close - 1) * 100;
      const acceleration = winsorize(mom3m - (mom12m / 4), -50, 50);
      details.momentumAcceleration = acceleration;
      const accelScore = normalizeMetric(acceleration, -30, 30);
      momentumComponents.push({ name: 'momentumAcceleration', score: accelScore, weight: 0.30 });
    }

    // Volume Trend
    if (priceHistory.length >= 63) {
      const volRecent = priceHistory.slice(-21).reduce((sum: number, p: any) => sum + p.volume, 0) / 21;
      const volOlder = priceHistory.slice(-63, -21).reduce((sum: number, p: any) => sum + p.volume, 0) / 42;
      
      if (volOlder > 0) {
        const volChange = winsorize((volRecent / volOlder - 1) * 100, -50, 100);
        details.volumeTrend = volChange;
        const volScore = normalizeMetric(volChange, -50, 100);
        momentumComponents.push({ name: 'volumeTrend', score: volScore, weight: 0.30 });
      }
    }

    const momentumScore = momentumComponents.length > 0
      ? momentumComponents.reduce((sum, c) => sum + c.score * c.weight, 0) /
        momentumComponents.reduce((sum, c) => sum + c.weight, 0)
      : 50;

    // ============================================================
    // TOTAL TURNAROUND SCORE
    // ============================================================
    const totalScore = 0.40 * fundamentalScore + 0.30 * dislocationScore + 0.30 * momentumScore;

    // Determine quintile
    let quintile: number;
    if (totalScore >= 80) quintile = 5;
    else if (totalScore >= 60) quintile = 4;
    else if (totalScore >= 40) quintile = 3;
    else if (totalScore >= 20) quintile = 2;
    else quintile = 1;

    // Determine recommendation based on backtest findings
    let recommendation: string;
    if (quintile >= 4) recommendation = 'STRONG BUY';
    else if (quintile === 3) recommendation = 'BUY';
    else if (quintile === 2) recommendation = 'HOLD';
    else recommendation = 'AVOID';

    return {
      score: Math.round(totalScore * 10) / 10,
      quintile,
      components: {
        fundamentalImprovement: Math.round(fundamentalScore * 10) / 10,
        priceDislocation: Math.round(dislocationScore * 10) / 10,
        momentumConfirmation: Math.round(momentumScore * 10) / 10
      },
      details,
      recommendation
    };

  } catch (error) {
    console.error(`Error calculating Turnaround Score for ${ticker}:`, error);
    return null;
  }
}

export function getTurnaroundQuintileLabel(quintile: number): string {
  switch (quintile) {
    case 5: return 'Very High Turnaround Potential';
    case 4: return 'High Turnaround Potential';
    case 3: return 'Moderate Turnaround Potential';
    case 2: return 'Low Turnaround Potential';
    default: return 'Very Low Turnaround Potential';
  }
}

export function getCombinedRecommendation(piotroskiScore: number, turnaroundQuintile: number): string {
  // Based on backtest: Low Piotroski + High Turnaround = BEST
  if (piotroskiScore <= 6 && turnaroundQuintile >= 4) return 'STRONG BUY';
  if (piotroskiScore <= 6 && turnaroundQuintile >= 2) return 'BUY';
  if (piotroskiScore >= 7 && turnaroundQuintile >= 4) return 'HOLD';
  if (piotroskiScore >= 7 && turnaroundQuintile <= 2) return 'AVOID';
  return 'HOLD';
}
