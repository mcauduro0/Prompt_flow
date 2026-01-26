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
    conviction: number,
    scores?: {
      scoreV4?: number;
      scoreV4Quintile?: string;
      scoreV4Recommendation?: string;
      scoreV4Components?: any;
      turnaroundScore?: number;
      turnaroundQuintile?: number;
      turnaroundRecommendation?: string;
      turnaroundComponents?: any;
    }
  ): Promise<ICMemo | undefined> {
    const updateData: any = {
      memoContent: normalizeJsonbField(memoContent) as any,
      supportingAnalyses: normalizeJsonbField(supportingAnalyses) as any,
      recommendation,
      conviction,
      status: 'complete',
      generationProgress: 100,
      completedAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Add Score v4.0 if provided
    if (scores?.scoreV4 !== undefined) {
      updateData.scoreV4 = String(scores.scoreV4);
      updateData.scoreV4Quintile = scores.scoreV4Quintile;
      updateData.scoreV4Recommendation = scores.scoreV4Recommendation;
      updateData.scoreV4Components = normalizeJsonbField(scores.scoreV4Components);
    }
    
    // Add Turnaround Score if provided
    if (scores?.turnaroundScore !== undefined) {
      updateData.turnaroundScore = String(scores.turnaroundScore);
      updateData.turnaroundQuintile = scores.turnaroundQuintile;
      updateData.turnaroundRecommendation = scores.turnaroundRecommendation;
      updateData.turnaroundComponents = normalizeJsonbField(scores.turnaroundComponents);
    }
    
    const [result] = await db
      .update(icMemos)
      .set(updateData)
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

  /**
   * Update Score v4.0 and Turnaround Score
   */
  async updateScoresV4(
    memoId: string,
    scores: {
      scoreV4: string;
      scoreV4Quintile: string;
      scoreV4Recommendation: string;
      turnaroundScore: string;
      turnaroundQuintile: number;
      turnaroundRecommendation: string;
    }
  ): Promise<ICMemo | undefined> {
    const [result] = await db
      .update(icMemos)
      .set({
        scoreV4: scores.scoreV4,
        scoreV4Quintile: scores.scoreV4Quintile,
        scoreV4Recommendation: scores.scoreV4Recommendation,
        turnaroundScore: scores.turnaroundScore,
        turnaroundQuintile: scores.turnaroundQuintile,
        turnaroundRecommendation: scores.turnaroundRecommendation,
        updatedAt: new Date(),
      })
      .where(eq(icMemos.memoId, memoId))
      .returning();
    return result;
  },

  /**
   * Update all 3 scores (v4.0, Turnaround, Piotroski)
   */
  async updateAllScores(
    memoId: string,
    scores: {
      scoreV4: string | null;
      scoreV4Quintile: string | null;
      scoreV4Recommendation: string | null;
      scoreV4Components: any | null;
      turnaroundScore: string | null;
      turnaroundQuintile: number | null;
      turnaroundRecommendation: string | null;
      turnaroundComponents: any | null;
      piotroskiScore: number | null;
      piotroskiDetails: any | null;
    }
  ): Promise<ICMemo | undefined> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Score v4.0
    if (scores.scoreV4 !== null) {
      updateData.scoreV4 = scores.scoreV4;
      updateData.scoreV4Quintile = scores.scoreV4Quintile;
      updateData.scoreV4Recommendation = scores.scoreV4Recommendation;
      updateData.scoreV4Components = normalizeJsonbField(scores.scoreV4Components);
    }

    // Turnaround Score
    if (scores.turnaroundScore !== null) {
      updateData.turnaroundScore = scores.turnaroundScore;
      updateData.turnaroundQuintile = scores.turnaroundQuintile;
      updateData.turnaroundRecommendation = scores.turnaroundRecommendation;
      updateData.turnaroundComponents = normalizeJsonbField(scores.turnaroundComponents);
    }

    // Piotroski F-Score
    if (scores.piotroskiScore !== null) {
      updateData.piotroskiScore = scores.piotroskiScore;
      updateData.piotroskiDetails = normalizeJsonbField(scores.piotroskiDetails);
    }

    const [result] = await db
      .update(icMemos)
      .set(updateData)
      .where(eq(icMemos.memoId, memoId))
      .returning();
    return result;
  },
};
