/**
 * ARC Investment Factory - Research Packets Repository
 * Data access for research_packets table
 */

import { eq, desc, gte, and, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { researchPackets, type ResearchPacket, type NewResearchPacket } from '../models/schema.js';

export const researchPacketsRepository = {
  /**
   * Create a new research packet
   */
  async create(packet: NewResearchPacket): Promise<ResearchPacket> {
    const [result] = await db.insert(researchPackets).values(packet).returning();
    return result;
  },

  /**
   * Get packet by ID
   */
  async getById(packetId: string): Promise<ResearchPacket | undefined> {
    const [result] = await db
      .select()
      .from(researchPackets)
      .where(eq(researchPackets.packetId, packetId));
    return result;
  },

  /**
   * Get packet by idea ID
   */
  async getByIdeaId(ideaId: string): Promise<ResearchPacket | undefined> {
    const [result] = await db
      .select()
      .from(researchPackets)
      .where(eq(researchPackets.ideaId, ideaId))
      .orderBy(desc(researchPackets.thesisVersion))
      .limit(1);
    return result;
  },

  /**
   * Get all versions for an idea
   */
  async getAllVersionsByIdeaId(ideaId: string): Promise<ResearchPacket[]> {
    return db
      .select()
      .from(researchPackets)
      .where(eq(researchPackets.ideaId, ideaId))
      .orderBy(desc(researchPackets.thesisVersion));
  },

  /**
   * Get packets by ticker
   */
  async getByTicker(ticker: string): Promise<ResearchPacket[]> {
    return db
      .select()
      .from(researchPackets)
      .where(eq(researchPackets.ticker, ticker))
      .orderBy(desc(researchPackets.asOf));
  },

  /**
   * Get packets from last N days for IC bundle
   */
  async getRecentPackets(days: number): Promise<ResearchPacket[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    return db
      .select()
      .from(researchPackets)
      .where(gte(researchPackets.asOf, cutoffStr))
      .orderBy(desc(researchPackets.updatedAt));
  },

  /**
   * Get packets with monitoring plans
   */
  async getWithMonitoringPlans(): Promise<ResearchPacket[]> {
    return db
      .select()
      .from(researchPackets)
      .where(sql`${researchPackets.monitoringPlan} IS NOT NULL`);
  },

  /**
   * Create new thesis version (immutable update)
   */
  async createNewVersion(
    ideaId: string,
    updates: Partial<NewResearchPacket>
  ): Promise<ResearchPacket> {
    // Get current version
    const current = await this.getByIdeaId(ideaId);
    const newVersion = (current?.thesisVersion ?? 0) + 1;

    const [result] = await db
      .insert(researchPackets)
      .values({
        ...updates,
        ideaId,
        thesisVersion: newVersion,
      } as NewResearchPacket)
      .returning();

    return result;
  },

  /**
   * Count completed packets for current week
   */
  async countWeeklyPackets(): Promise<number> {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(researchPackets)
      .where(gte(researchPackets.asOf, weekStartStr));

    return result?.count ?? 0;
  },
};
