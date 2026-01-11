/**
 * ARC Investment Factory - Novelty State Repository
 * Data access for novelty_state table
 */

import { eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { noveltyState, type NoveltyState, type NewNoveltyState } from '../models/schema.js';

export const noveltyStateRepository = {
  /**
   * Get novelty state for a ticker
   */
  async getByTicker(ticker: string): Promise<NoveltyState | undefined> {
    const [result] = await db
      .select()
      .from(noveltyState)
      .where(eq(noveltyState.ticker, ticker));
    return result;
  },

  /**
   * Get novelty states for multiple tickers
   */
  async getByTickers(tickers: string[]): Promise<NoveltyState[]> {
    if (tickers.length === 0) return [];
    return db.select().from(noveltyState).where(inArray(noveltyState.ticker, tickers));
  },

  /**
   * Get all novelty states
   */
  async getAll(): Promise<NoveltyState[]> {
    return db.select().from(noveltyState);
  },

  /**
   * Upsert novelty state for a ticker
   */
  async upsert(state: NewNoveltyState): Promise<NoveltyState> {
    const [result] = await db
      .insert(noveltyState)
      .values(state)
      .onConflictDoUpdate({
        target: noveltyState.ticker,
        set: {
          lastSeen: state.lastSeen,
          lastEdgeTypes: state.lastEdgeTypes,
          lastStyleTag: state.lastStyleTag,
          seenCount: sql`${noveltyState.seenCount} + 1`,
        },
      })
      .returning();
    return result;
  },

  /**
   * Batch upsert novelty states
   */
  async upsertMany(states: NewNoveltyState[]): Promise<void> {
    if (states.length === 0) return;

    for (const state of states) {
      await this.upsert(state);
    }
  },

  /**
   * Get tickers not seen in N days (for novelty bonus)
   */
  async getTickersNotSeenInDays(days: number): Promise<string[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await db
      .select({ ticker: noveltyState.ticker })
      .from(noveltyState)
      .where(lt(noveltyState.lastSeen, cutoff));

    return result.map(r => r.ticker);
  },

  /**
   * Get tickers seen more than N times in last M days
   */
  async getFrequentTickers(minCount: number, days: number): Promise<string[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await db
      .select({ ticker: noveltyState.ticker })
      .from(noveltyState)
      .where(
        sql`${noveltyState.seenCount} >= ${minCount} AND ${noveltyState.firstSeen} >= ${cutoff}`
      );

    return result.map(r => r.ticker);
  },

  /**
   * Check if ticker has new edge types
   */
  async hasNewEdgeTypes(ticker: string, edgeTypes: string[]): Promise<boolean> {
    const state = await this.getByTicker(ticker);
    if (!state || !state.lastEdgeTypes) return true;

    const previousEdges = new Set(state.lastEdgeTypes as string[]);
    return edgeTypes.some(edge => !previousEdges.has(edge));
  },

  /**
   * Check if style tag changed
   */
  async hasStyleTagChanged(ticker: string, newStyleTag: string): Promise<boolean> {
    const state = await this.getByTicker(ticker);
    if (!state) return true;
    return state.lastStyleTag !== newStyleTag;
  },
};
