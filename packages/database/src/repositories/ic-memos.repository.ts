/**
 * IC Memos Repository
 * Lane C - Investment Committee Memos
 */

import { eq, desc, gte, sql, and, inArray } from 'drizzle-orm';
import { db } from '../client.js';
import { icMemos, type ICMemo, type NewICMemo } from '../models/schema.js';

/**
 * Normalize JSONB field to prevent double-serialization
 */
function normalizeJsonbField(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Normalize IC Memo for insert
 */
function normalizeMemoForInsert(memo: NewICMemo): NewICMemo {
  return {
    ...memo,
    memoContent: normalizeJsonbField(memo.memoContent) as any,
    supportingAnalyses: normalizeJsonbField(memo.supportingAnalyses) as any,
  };
}

export const icMemosRepository = {
  /**
   * Create a new IC Memo
   */
  async create(memo: NewICMemo): Promise<ICMemo> {
    const normalizedMemo = normalizeMemoForInsert(memo);
    const [result] = await db.insert(icMemos).values(normalizedMemo).returning();
    return result;
  },

  /**
   * Get IC Memo by ID
   */
  async getById(memoId: string): Promise<ICMemo | undefined> {
    const [result] = await db
      .select()
      .from(icMemos)
      .where(eq(icMemos.memoId, memoId));
    return result;
  },

  /**
   * Get IC Memo by packet ID
   */
  async getByPacketId(packetId: string): Promise<ICMemo | undefined> {
    const [result] = await db
      .select()
      .from(icMemos)
      .where(eq(icMemos.packetId, packetId));
    return result;
  },

  /**
   * Get IC Memo by idea ID
   */
  async getByIdeaId(ideaId: string): Promise<ICMemo | undefined> {
    const [result] = await db
      .select()
      .from(icMemos)
      .where(eq(icMemos.ideaId, ideaId))
      .orderBy(desc(icMemos.createdAt))
      .limit(1);
    return result;
  },

  /**
   * Get all IC Memos
   */
  async getAll(limit = 100): Promise<ICMemo[]> {
    return db
      .select()
      .from(icMemos)
      .orderBy(desc(icMemos.createdAt))
      .limit(limit);
  },

  /**
   * Get IC Memos by status
   */
  async getByStatus(status: ICMemo['status'], limit = 100): Promise<ICMemo[]> {
    return db
      .select()
      .from(icMemos)
      .where(eq(icMemos.status, status))
      .orderBy(desc(icMemos.createdAt))
      .limit(limit);
  },

  /**
   * Get completed IC Memos
   */
  async getCompleted(limit = 100): Promise<ICMemo[]> {
    return db
      .select()
      .from(icMemos)
      .where(eq(icMemos.status, 'complete'))
      .orderBy(desc(icMemos.completedAt))
      .limit(limit);
  },

  /**
   * Get pending IC Memos (awaiting generation)
   */
  async getPending(limit = 100): Promise<ICMemo[]> {
    return db
      .select()
      .from(icMemos)
      .where(eq(icMemos.status, 'pending'))
      .orderBy(desc(icMemos.approvedAt))
      .limit(limit);
  },

  /**
   * Get IC Memos by ticker
   */
  async getByTicker(ticker: string): Promise<ICMemo[]> {
    return db
      .select()
      .from(icMemos)
      .where(eq(icMemos.ticker, ticker))
      .orderBy(desc(icMemos.createdAt));
  },

  /**
   * Update IC Memo status
   */
  async updateStatus(
    memoId: string,
    status: ICMemo['status'],
    errorMessage?: string
  ): Promise<ICMemo | undefined> {
    const updates: Partial<ICMemo> = {
      status,
      updatedAt: new Date(),
    };

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    if (status === 'complete') {
      updates.completedAt = new Date();
    }

    const [result] = await db
      .update(icMemos)
      .set(updates)
      .where(eq(icMemos.memoId, memoId))
      .returning();
    return result;
  },

  /**
   * Update generation progress
   */
  async updateProgress(
    memoId: string,
    progress: number
  ): Promise<ICMemo | undefined> {
    const [result] = await db
      .update(icMemos)
      .set({
        generationProgress: Math.min(100, Math.max(0, progress)),
        updatedAt: new Date(),
      })
      .where(eq(icMemos.memoId, memoId))
      .returning();
    return result;
  },

  /**
   * Update IC Memo content
   */
  async updateContent(
    memoId: string,
    memoContent: ICMemo['memoContent'],
    supportingAnalyses?: ICMemo['supportingAnalyses']
  ): Promise<ICMemo | undefined> {
    const updates: Partial<ICMemo> = {
      memoContent: normalizeJsonbField(memoContent) as any,
      updatedAt: new Date(),
    };

    if (supportingAnalyses) {
      updates.supportingAnalyses = normalizeJsonbField(supportingAnalyses) as any;
    }

    const [result] = await db
      .update(icMemos)
      .set(updates)
      .where(eq(icMemos.memoId, memoId))
      .returning();
    return result;
  },

  /**
   * Update final recommendation
   */
  async updateRecommendation(
    memoId: string,
    recommendation: ICMemo['recommendation'],
    conviction: number
  ): Promise<ICMemo | undefined> {
    const [result] = await db
      .update(icMemos)
      .set({
        recommendation,
        conviction,
        updatedAt: new Date(),
      })
      .where(eq(icMemos.memoId, memoId))
      .returning();
    return result;
  },

  /**
   * Complete IC Memo generation
   */
  async complete(
    memoId: string,
    memoContent: ICMemo['memoContent'],
    supportingAnalyses: ICMemo['supportingAnalyses'],
    recommendation: ICMemo['recommendation'],
    conviction: number
  ): Promise<ICMemo | undefined> {
    const [result] = await db
      .update(icMemos)
      .set({
        memoContent: normalizeJsonbField(memoContent) as any,
        supportingAnalyses: normalizeJsonbField(supportingAnalyses) as any,
        recommendation,
        conviction,
        status: 'complete',
        generationProgress: 100,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(icMemos.memoId, memoId))
      .returning();
    return result;
  },

  /**
   * Mark IC Memo as failed
   */
  async markFailed(
    memoId: string,
    errorMessage: string
  ): Promise<ICMemo | undefined> {
    const [result] = await db
      .update(icMemos)
      .set({
        status: 'failed',
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(icMemos.memoId, memoId))
      .returning();
    return result;
  },

  /**
   * Count IC Memos by status
   */
  async countByStatus(): Promise<Record<string, number>> {
    const result = await db
      .select({
        status: icMemos.status,
        count: sql<number>`count(*)::int`,
      })
      .from(icMemos)
      .groupBy(icMemos.status);

    return result.reduce(
      (acc: Record<string, number>, row: { status: string; count: number }) => {
        acc[row.status] = row.count;
        return acc;
      },
      {} as Record<string, number>
    );
  },

  /**
   * Get recent IC Memos (last N days)
   */
  async getRecent(days: number): Promise<ICMemo[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    return db
      .select()
      .from(icMemos)
      .where(gte(icMemos.asOf, cutoffStr))
      .orderBy(desc(icMemos.createdAt));
  },

  /**
   * Check if packet already has an IC Memo
   */
  async existsForPacket(packetId: string): Promise<boolean> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(icMemos)
      .where(eq(icMemos.packetId, packetId));
    return (result?.count ?? 0) > 0;
  },

  /**
   * Delete IC Memo
   */
  async delete(memoId: string): Promise<boolean> {
    const result = await db
      .delete(icMemos)
      .where(eq(icMemos.memoId, memoId));
    return true;
  },
};
