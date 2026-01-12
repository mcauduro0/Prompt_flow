/**
 * ARC Investment Factory - Memory Repository
 * Simplified memory access for tracking ticker appearances
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { noveltyState } from '../models/schema.js';

export const memoryRepository = {
  /**
   * Get the last seen date for a ticker
   */
  async getLastSeenDate(ticker: string): Promise<Date | null> {
    const [result] = await db
      .select({ lastSeen: noveltyState.lastSeen })
      .from(noveltyState)
      .where(eq(noveltyState.ticker, ticker));
    
    return result?.lastSeen ?? null;
  },

  /**
   * Record that a ticker was seen (for novelty tracking)
   */
  async recordTickerSeen(ticker: string, ideaId: string): Promise<void> {
    await db
      .insert(noveltyState)
      .values({
        ticker,
        lastSeen: new Date(),
        seenCount: 1,
        firstSeen: new Date(),
      })
      .onConflictDoUpdate({
        target: noveltyState.ticker,
        set: {
          lastSeen: new Date(),
          seenCount: sql`${noveltyState.seenCount} + 1`,
        },
      });
  },

  /**
   * Get all tickers seen in the last N days
   */
  async getRecentTickers(days: number): Promise<string[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await db
      .select({ ticker: noveltyState.ticker })
      .from(noveltyState)
      .where(sql`${noveltyState.lastSeen} >= ${cutoff}`);

    return result.map(r => r.ticker);
  },

  /**
   * Search memory by ticker pattern
   */
  async searchByTicker(pattern: string): Promise<Array<{
    ticker: string;
    lastSeen: Date;
    seenCount: number;
  }>> {
    const result = await db
      .select({
        ticker: noveltyState.ticker,
        lastSeen: noveltyState.lastSeen,
        seenCount: noveltyState.seenCount,
      })
      .from(noveltyState)
      .where(sql`${noveltyState.ticker} ILIKE ${`%${pattern}%`}`)
      .limit(50);

    return result;
  },
};
