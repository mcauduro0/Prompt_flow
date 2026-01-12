/**
 * Simple gate runner for Lane A discovery pipeline
 * Uses basic heuristics for initial filtering
 */

import { createFMPClient } from '@arc/retriever';

export interface SimpleGateInput {
  ticker: string;
  marketCap?: number;
  thesis: string;
}

export interface SimpleGateResult {
  passed: boolean;
  failedGate?: number;
  reason?: string;
}

/**
 * Run simplified gates for initial idea filtering
 * Full gate evaluation happens during Lane B deep research
 */
export async function runGates(input: SimpleGateInput): Promise<SimpleGateResult> {
  const { ticker, marketCap, thesis } = input;

  // Gate 0: Data Sufficiency - Check if we have basic data
  if (!ticker || ticker.length < 1 || ticker.length > 10) {
    return { passed: false, failedGate: 0, reason: 'Invalid ticker symbol' };
  }

  // Gate 1: Market Cap Filter (avoid micro-caps and mega-caps)
  if (marketCap !== undefined) {
    if (marketCap < 100_000_000) {
      return { passed: false, failedGate: 1, reason: 'Market cap too small (<$100M)' };
    }
    if (marketCap > 500_000_000_000) {
      return { passed: false, failedGate: 1, reason: 'Market cap too large (>$500B)' };
    }
  }

  // Gate 2: Thesis Quality - Basic check
  if (!thesis || thesis.length < 20) {
    return { passed: false, failedGate: 2, reason: 'Thesis too short or missing' };
  }

  // Gate 3: Fetch additional data for downside sanity check
  try {
    const fmp = createFMPClient();
    const metricsResult = await fmp.getKeyMetrics(ticker);
    
    if (metricsResult.success && metricsResult.data) {
      const metrics = metricsResult.data;
      
      // Check leverage (Gate 3 binary override)
      if (metrics.netDebtToEbitda && metrics.netDebtToEbitda > 5) {
        return { 
          passed: false, 
          failedGate: 3, 
          reason: `Excessive leverage: Net Debt/EBITDA = ${metrics.netDebtToEbitda.toFixed(1)}x` 
        };
      }

      // Check liquidity
      if (metrics.currentRatio && metrics.currentRatio < 0.8) {
        return { 
          passed: false, 
          failedGate: 3, 
          reason: `Liquidity risk: Current ratio = ${metrics.currentRatio.toFixed(2)}` 
        };
      }
    }
  } catch (error) {
    // If we can't fetch data, pass with warning
    console.warn(`[Gates] Could not fetch metrics for ${ticker}:`, (error as Error).message);
  }

  // Gate 4: Style fit is checked during idea generation

  return { passed: true };
}

export default { runGates };
