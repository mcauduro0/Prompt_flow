/**
 * ARC Investment Factory - Security Master Repository
 * Data access for security_master table
 */

import { eq, inArray, ilike, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { securityMaster, type SecurityMaster, type NewSecurityMaster } from '../models/schema.js';

export const securityMasterRepository = {
  /**
   * Create a new security
   */
  async create(security: NewSecurityMaster): Promise<SecurityMaster> {
    const [result] = await db.insert(securityMaster).values(security).returning();
    return result;
  },

  /**
   * Create multiple securities in batch
   */
  async createMany(securities: NewSecurityMaster[]): Promise<SecurityMaster[]> {
    if (securities.length === 0) return [];
    return db.insert(securityMaster).values(securities).returning();
  },

  /**
   * Get security by ID
   */
  async getById(securityId: string): Promise<SecurityMaster | undefined> {
    const [result] = await db
      .select()
      .from(securityMaster)
      .where(eq(securityMaster.securityId, securityId));
    return result;
  },

  /**
   * Get security by ticker
   */
  async getByTicker(ticker: string): Promise<SecurityMaster | undefined> {
    const [result] = await db
      .select()
      .from(securityMaster)
      .where(eq(securityMaster.ticker, ticker.toUpperCase()));
    return result;
  },

  /**
   * Get securities by tickers
   */
  async getByTickers(tickers: string[]): Promise<SecurityMaster[]> {
    if (tickers.length === 0) return [];
    const upperTickers = tickers.map(t => t.toUpperCase());
    return db
      .select()
      .from(securityMaster)
      .where(inArray(securityMaster.ticker, upperTickers));
  },

  /**
   * Search securities by name or ticker
   */
  async search(query: string, limit = 20): Promise<SecurityMaster[]> {
    return db
      .select()
      .from(securityMaster)
      .where(
        sql`${securityMaster.ticker} ILIKE ${`%${query}%`} OR ${securityMaster.companyName} ILIKE ${`%${query}%`}`
      )
      .limit(limit);
  },

  /**
   * Get securities by sector
   */
  async getBySector(sector: string): Promise<SecurityMaster[]> {
    return db
      .select()
      .from(securityMaster)
      .where(eq(securityMaster.sector, sector));
  },

  /**
   * Get securities by region
   */
  async getByRegion(region: string): Promise<SecurityMaster[]> {
    return db
      .select()
      .from(securityMaster)
      .where(eq(securityMaster.region, region));
  },

  /**
   * Upsert security (create or update)
   */
  async upsert(security: NewSecurityMaster): Promise<SecurityMaster> {
    const [result] = await db
      .insert(securityMaster)
      .values(security)
      .onConflictDoUpdate({
        target: securityMaster.ticker,
        set: {
          companyName: security.companyName,
          exchange: security.exchange,
          region: security.region,
          country: security.country,
          currency: security.currency,
          sector: security.sector,
          industry: security.industry,
        },
      })
      .returning();
    return result;
  },

  /**
   * Get all securities (paginated)
   */
  async getAll(limit = 100, offset = 0): Promise<SecurityMaster[]> {
    return db.select().from(securityMaster).limit(limit).offset(offset);
  },

  /**
   * Count total securities
   */
  async count(): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(securityMaster);
    return result?.count ?? 0;
  },

  /**
   * Get distinct sectors
   */
  async getDistinctSectors(): Promise<string[]> {
    const result = await db
      .selectDistinct({ sector: securityMaster.sector })
      .from(securityMaster)
      .where(sql`${securityMaster.sector} IS NOT NULL`);
    return result.map(r => r.sector!);
  },

  /**
   * Get distinct regions
   */
  async getDistinctRegions(): Promise<string[]> {
    const result = await db
      .selectDistinct({ region: securityMaster.region })
      .from(securityMaster)
      .where(sql`${securityMaster.region} IS NOT NULL`);
    return result.map(r => r.region!);
  },
};
