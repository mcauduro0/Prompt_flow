/**
 * Simple ranking for Lane A discovery
 * Full scoring happens during Lane B research
 */

import type { StyleTag } from '@arc/shared';

interface RawIdea {
  ticker: string;
  companyName: string;
  thesis: string;
  styleTag: StyleTag;
  catalysts: string[];
  risks: string[];
  marketCap?: number;
  sector?: string;
}

/**
 * Simple ranking based on thesis quality and market cap
 * Returns ideas sorted by rank (best first)
 */
export function rankIdeas(ideas: RawIdea[]): RawIdea[] {
  return [...ideas].sort((a, b) => {
    // Prefer mid-cap over small-cap or large-cap
    const aCapScore = getMarketCapScore(a.marketCap);
    const bCapScore = getMarketCapScore(b.marketCap);
    
    // Prefer longer, more detailed theses
    const aThesisScore = Math.min(a.thesis.length / 100, 3);
    const bThesisScore = Math.min(b.thesis.length / 100, 3);
    
    // Prefer more catalysts
    const aCatalystScore = Math.min(a.catalysts.length, 3);
    const bCatalystScore = Math.min(b.catalysts.length, 3);
    
    const aTotal = aCapScore + aThesisScore + aCatalystScore;
    const bTotal = bCapScore + bThesisScore + bCatalystScore;
    
    return bTotal - aTotal;
  });
}

/**
 * Score market cap (prefer $1B-$20B range)
 */
function getMarketCapScore(marketCap?: number): number {
  if (!marketCap) return 1;
  
  const capInBillions = marketCap / 1_000_000_000;
  
  if (capInBillions >= 1 && capInBillions <= 20) {
    return 3; // Sweet spot
  } else if (capInBillions >= 0.5 && capInBillions <= 50) {
    return 2; // Acceptable
  } else {
    return 1; // Less preferred
  }
}

export default { rankIdeas };
