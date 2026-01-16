/**
 * ARC Investment Factory - Research Packets Repository
 * Data access for research_packets table
 * 
 * IMPORTANT: This repository includes JSONB normalization to prevent
 * double-serialization issues with postgres.js driver.
 */
import { eq, desc, gte, and, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { researchPackets, type ResearchPacket, type NewResearchPacket } from '../models/schema.js';

/**
 * Normalize JSONB fields to prevent double-serialization.
 * The postgres.js driver with Drizzle ORM can sometimes serialize
 * objects as strings when inserting into JSONB columns.
 * This function ensures that:
 * 1. If the value is already a string (JSON string), it parses it back to an object
 * 2. If the value is an object, it returns it as-is
 * 3. If the value is null/undefined, it returns null
 */
function normalizeJsonbField<T>(value: T | string | null | undefined): T | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  // If it's a string, try to parse it as JSON
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      // If parsing fails, return the string as-is (it might be a valid string value)
      return value as unknown as T;
    }
  }
  
  // If it's already an object, return as-is
  return value;
}

/**
 * Normalize all JSONB fields in a research packet before insertion.
 * This prevents the double-serialization issue where objects are
 * stored as escaped JSON strings instead of native JSONB objects.
 */
function normalizePacketForInsert(packet: NewResearchPacket): NewResearchPacket {
  return {
    ...packet,
    // Normalize JSONB fields to ensure they are objects, not strings
    packet: normalizeJsonbField(packet.packet) as any,
    decisionBrief: normalizeJsonbField(packet.decisionBrief) as any,
    monitoringPlan: normalizeJsonbField(packet.monitoringPlan) as any,
  };
}

export const researchPacketsRepository = {
  /**
   * Create a new research packet
   * Includes JSONB normalization to prevent double-serialization
   */
  async create(packet: NewResearchPacket): Promise<ResearchPacket> {
    // Normalize JSONB fields before insertion
    const normalizedPacket = normalizePacketForInsert(packet);
    
    const [result] = await db.insert(researchPackets).values(normalizedPacket).returning();
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
   * Includes JSONB normalization to prevent double-serialization
   */
  async createNewVersion(
    ideaId: string,
    updates: Partial<NewResearchPacket>
  ): Promise<ResearchPacket> {
    // Get current version
    const current = await this.getByIdeaId(ideaId);
    const newVersion = (current?.thesisVersion ?? 0) + 1;

    // Normalize JSONB fields in updates
    const normalizedUpdates = {
      ...updates,
      packet: updates.packet ? normalizeJsonbField(updates.packet) : undefined,
      decisionBrief: updates.decisionBrief ? normalizeJsonbField(updates.decisionBrief) : undefined,
      monitoringPlan: updates.monitoringPlan ? normalizeJsonbField(updates.monitoringPlan) : undefined,
    };

    const [result] = await db
      .insert(researchPackets)
      .values({
        ...normalizedUpdates,
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

  /**
   * Update an existing research packet
   * Includes JSONB normalization to prevent double-serialization
   */
  async update(
    packetId: string,
    updates: Partial<NewResearchPacket>
  ): Promise<ResearchPacket | undefined> {
    // Normalize JSONB fields in updates
    const normalizedUpdates: Partial<NewResearchPacket> = { ...updates };
    
    if (updates.packet !== undefined) {
      normalizedUpdates.packet = normalizeJsonbField(updates.packet) as any;
    }
    if (updates.decisionBrief !== undefined) {
      normalizedUpdates.decisionBrief = normalizeJsonbField(updates.decisionBrief) as any;
    }
    if (updates.monitoringPlan !== undefined) {
      normalizedUpdates.monitoringPlan = normalizeJsonbField(updates.monitoringPlan) as any;
    }

    const [result] = await db
      .update(researchPackets)
      .set({
        ...normalizedUpdates,
        updatedAt: new Date(),
      })
      .where(eq(researchPackets.packetId, packetId))
      .returning();

    return result;
  },


};
