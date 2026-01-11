/**
 * ARC Investment Factory - Runs Repository
 * Data access for runs table (audit trail)
 */

import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { runs, type Run, type NewRun } from '../models/schema.js';

export const runsRepository = {
  /**
   * Create a new run record
   */
  async create(run: NewRun): Promise<Run> {
    const [result] = await db.insert(runs).values(run).returning();
    return result;
  },

  /**
   * Get run by ID
   */
  async getById(runId: string): Promise<Run | undefined> {
    const [result] = await db.select().from(runs).where(eq(runs.runId, runId));
    return result;
  },

  /**
   * Update run status
   */
  async updateStatus(
    runId: string,
    status: 'running' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<Run | undefined> {
    const [result] = await db
      .update(runs)
      .set({
        status,
        errorMessage,
        completedAt: status !== 'running' ? new Date() : undefined,
      })
      .where(eq(runs.runId, runId))
      .returning();
    return result;
  },

  /**
   * Update run payload
   */
  async updatePayload(runId: string, payload: unknown): Promise<Run | undefined> {
    const [result] = await db
      .update(runs)
      .set({ payload })
      .where(eq(runs.runId, runId))
      .returning();
    return result;
  },

  /**
   * Get recent runs by type
   */
  async getRecentByType(runType: string, limit = 10): Promise<Run[]> {
    return db
      .select()
      .from(runs)
      .where(eq(runs.runType, runType))
      .orderBy(desc(runs.runDate))
      .limit(limit);
  },

  /**
   * Get latest run by type
   */
  async getLatestByType(runType: string): Promise<Run | undefined> {
    const [result] = await db
      .select()
      .from(runs)
      .where(eq(runs.runType, runType))
      .orderBy(desc(runs.runDate))
      .limit(1);
    return result;
  },

  /**
   * Check if run already exists for today (idempotency)
   */
  async existsForToday(runType: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(runs)
      .where(
        and(
          eq(runs.runType, runType),
          gte(runs.runDate, today),
          eq(runs.status, 'completed')
        )
      );

    return (result?.count ?? 0) > 0;
  },

  /**
   * Get failed runs for retry
   */
  async getFailedRuns(limit = 10): Promise<Run[]> {
    return db
      .select()
      .from(runs)
      .where(eq(runs.status, 'failed'))
      .orderBy(desc(runs.runDate))
      .limit(limit);
  },

  /**
   * Get runs for date range
   */
  async getForDateRange(startDate: Date, endDate: Date): Promise<Run[]> {
    return db
      .select()
      .from(runs)
      .where(
        and(
          gte(runs.runDate, startDate),
          sql`${runs.runDate} <= ${endDate}`
        )
      )
      .orderBy(desc(runs.runDate));
  },
};
