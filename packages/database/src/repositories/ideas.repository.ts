/**
 * ARC Investment Factory - Ideas Repository
 * Data access for ideas table
 */

import { eq, desc, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { ideas, type Idea, type NewIdea } from '../models/schema.js';

export const ideasRepository = {
  /**
   * Create a new idea
   */
  async create(idea: NewIdea): Promise<Idea> {
    const [result] = await db.insert(ideas).values(idea).returning();
    return result;
  },

  /**
   * Create multiple ideas in batch
   */
  async createMany(newIdeas: NewIdea[]): Promise<Idea[]> {
    if (newIdeas.length === 0) return [];
    return db.insert(ideas).values(newIdeas).returning();
  },

  /**
   * Get idea by ID
   */
  async getById(ideaId: string): Promise<Idea | undefined> {
    const [result] = await db.select().from(ideas).where(eq(ideas.ideaId, ideaId));
    return result;
  },

  /**
   * Get ideas by status
   */
  async getByStatus(status: Idea['status'], limit = 100): Promise<Idea[]> {
    return db
      .select()
      .from(ideas)
      .where(eq(ideas.status, status))
      .orderBy(desc(ideas.rankScore))
      .limit(limit);
  },

  /**
   * Get ideas for date range ranked by novelty
   */
  async getIdeaInbox(asOf: string, limit = 120): Promise<Idea[]> {
    return db
      .select()
      .from(ideas)
      .where(eq(ideas.asOf, asOf))
      .orderBy(desc(ideas.rankScore))
      .limit(limit);
  },

  /**
   * Get promoted ideas for a date
   */
  async getPromotedForDate(asOf: string): Promise<Idea[]> {
    return db
      .select()
      .from(ideas)
      .where(and(eq(ideas.asOf, asOf), eq(ideas.status, 'promoted')));
  },

  /**
   * Get ideas by ticker
   */
  async getByTicker(ticker: string, limit = 10): Promise<Idea[]> {
    return db
      .select()
      .from(ideas)
      .where(eq(ideas.ticker, ticker))
      .orderBy(desc(ideas.asOf))
      .limit(limit);
  },

  /**
   * Update idea status
   */
  async updateStatus(
    ideaId: string,
    status: Idea['status'] | 'researched',
    rejectionReason?: string
  ): Promise<Idea | undefined> {
    // Map 'researched' to 'promoted' since schema doesn't have 'researched'
    const actualStatus = status === 'researched' ? 'promoted' : status;
    const [result] = await db
      .update(ideas)
      .set({
        status: actualStatus,
        rejectionReason,
        updatedAt: new Date(),
      })
      .where(eq(ideas.ideaId, ideaId))
      .returning();
    return result;
  },

  /**
   * Update idea scores and rank
   */
  async updateScores(
    ideaId: string,
    score: Idea['score'],
    noveltyScore: string,
    rankScore: string
  ): Promise<Idea | undefined> {
    const [result] = await db
      .update(ideas)
      .set({
        score,
        noveltyScore,
        rankScore,
        updatedAt: new Date(),
      })
      .where(eq(ideas.ideaId, ideaId))
      .returning();
    return result;
  },

  /**
   * Promote ideas to Lane B
   */
  async promoteIdeas(ideaIds: string[]): Promise<Idea[]> {
    if (ideaIds.length === 0) return [];
    return db
      .update(ideas)
      .set({
        status: 'promoted',
        nextAction: 'promote_to_lane_b',
        updatedAt: new Date(),
      })
      .where(inArray(ideas.ideaId, ideaIds))
      .returning();
  },

  /**
   * Count ideas by status for a date
   */
  async countByStatusForDate(asOf: string): Promise<Record<string, number>> {
    const result = await db
      .select({
        status: ideas.status,
        count: sql<number>`count(*)::int`,
      })
      .from(ideas)
      .where(eq(ideas.asOf, asOf))
      .groupBy(ideas.status);

    return result.reduce(
      (acc, row) => {
        acc[row.status] = row.count;
        return acc;
      },
      {} as Record<string, number>
    );
  },

  /**
   * Get ideas that pass all gates for promotion consideration
   */
  async getPromotionCandidates(asOf: string): Promise<Idea[]> {
    return db
      .select()
      .from(ideas)
      .where(
        and(
          eq(ideas.asOf, asOf),
          eq(ideas.status, 'new'),
          sql`${ideas.gateResults}->>'gate_0_data_sufficiency' = 'pass'`,
          sql`${ideas.gateResults}->>'gate_1_coherence' = 'pass'`,
          sql`${ideas.gateResults}->>'gate_2_edge_claim' = 'pass'`,
          sql`${ideas.gateResults}->>'gate_3_downside_shape' = 'pass'`,
          sql`${ideas.gateResults}->>'gate_4_style_fit' = 'pass'`
        )
      )
      .orderBy(desc(sql`(${ideas.score}->>'total')::numeric`));
  },
};
