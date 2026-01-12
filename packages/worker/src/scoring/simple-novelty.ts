/**
 * Simple novelty scoring for Lane A discovery
 * Full novelty calculation happens during ranking
 */

import { memoryRepository } from '@arc/database';
import { NOVELTY_NEW_TICKER_DAYS, NOVELTY_PENALTY_WINDOW_DAYS } from '@arc/shared';

/**
 * Calculate a simple novelty score (0-1) for a ticker
 * Returns 1.0 for new tickers, lower scores for recently seen tickers
 */
export async function calculateNoveltyScore(ticker: string): Promise<number> {
  try {
    // Check if ticker has been seen before
    const lastSeen = await memoryRepository.getLastSeenDate(ticker);
    
    if (!lastSeen) {
      // New ticker - full novelty
      return 1.0;
    }

    const now = new Date();
    const daysSinceLastSeen = Math.floor(
      (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24)
    );

    // If not seen in 90 days, treat as new
    if (daysSinceLastSeen >= NOVELTY_NEW_TICKER_DAYS) {
      return 1.0;
    }

    // If seen in last 30 days, apply penalty
    if (daysSinceLastSeen <= NOVELTY_PENALTY_WINDOW_DAYS) {
      // Linear decay from 0.5 to 0.2 based on recency
      const penaltyFactor = daysSinceLastSeen / NOVELTY_PENALTY_WINDOW_DAYS;
      return 0.2 + (0.3 * penaltyFactor);
    }

    // Between 30-90 days - moderate novelty
    const noveltyFactor = (daysSinceLastSeen - NOVELTY_PENALTY_WINDOW_DAYS) / 
                          (NOVELTY_NEW_TICKER_DAYS - NOVELTY_PENALTY_WINDOW_DAYS);
    return 0.5 + (0.5 * noveltyFactor);
  } catch (error) {
    console.warn(`[Novelty] Error calculating novelty for ${ticker}:`, (error as Error).message);
    // On error, assume moderate novelty
    return 0.7;
  }
}

export default { calculateNoveltyScore };
