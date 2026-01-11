/**
 * ARC Investment Factory - Evidence Repository
 * Data access for evidence table
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '../client.js';
import { evidence, type Evidence, type NewEvidence } from '../models/schema.js';

export const evidenceRepository = {
  /**
   * Create a new evidence record
   */
  async create(ev: NewEvidence): Promise<Evidence> {
    const [result] = await db.insert(evidence).values(ev).returning();
    return result;
  },

  /**
   * Create multiple evidence records in batch
   */
  async createMany(evidenceRecords: NewEvidence[]): Promise<Evidence[]> {
    if (evidenceRecords.length === 0) return [];
    return db.insert(evidence).values(evidenceRecords).returning();
  },

  /**
   * Get evidence by ID
   */
  async getById(evidenceId: string): Promise<Evidence | undefined> {
    const [result] = await db.select().from(evidence).where(eq(evidence.evidenceId, evidenceId));
    return result;
  },

  /**
   * Get all evidence for an idea
   */
  async getByIdeaId(ideaId: string): Promise<Evidence[]> {
    return db.select().from(evidence).where(eq(evidence.ideaId, ideaId));
  },

  /**
   * Get evidence by ticker
   */
  async getByTicker(ticker: string): Promise<Evidence[]> {
    return db.select().from(evidence).where(eq(evidence.ticker, ticker));
  },

  /**
   * Get evidence for multiple ideas
   */
  async getByIdeaIds(ideaIds: string[]): Promise<Evidence[]> {
    if (ideaIds.length === 0) return [];
    return db.select().from(evidence).where(inArray(evidence.ideaId, ideaIds));
  },

  /**
   * Delete evidence for an idea
   */
  async deleteByIdeaId(ideaId: string): Promise<void> {
    await db.delete(evidence).where(eq(evidence.ideaId, ideaId));
  },
};
