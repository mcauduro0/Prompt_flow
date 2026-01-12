/**
 * ARC Investment Factory - QA Reports Repository
 * Stores weekly QA reports and system health metrics
 */

import { db } from '../client.js';
import { qaReports } from '../models/schema.js';
import { eq, desc, gte, and, sql } from 'drizzle-orm';

export interface QAReportRecord {
  reportId: string;
  reportType: string;
  reportDate: Date;
  overallScore: number;
  status: 'pass' | 'warn' | 'fail';
  payload: unknown;
}

export const qaReportsRepository = {
  /**
   * Create a new QA report
   */
  async create(data: QAReportRecord): Promise<void> {
    await db.insert(qaReports).values({
      reportId: data.reportId,
      reportType: data.reportType,
      reportDate: data.reportDate,
      overallScore: data.overallScore,
      status: data.status,
      payload: data.payload,
    });
  },

  /**
   * Get a report by ID
   */
  async getById(reportId: string): Promise<QAReportRecord | null> {
    const results = await db
      .select()
      .from(qaReports)
      .where(eq(qaReports.reportId, reportId))
      .limit(1);
    
    if (!results[0]) return null;
    return {
      ...results[0],
      status: results[0].status as 'pass' | 'warn' | 'fail',
    };
  },

  /**
   * Get recent reports
   */
  async getRecent(limit: number = 10): Promise<QAReportRecord[]> {
    const results = await db
      .select()
      .from(qaReports)
      .orderBy(desc(qaReports.reportDate))
      .limit(limit);
    
    return results.map(r => ({
      ...r,
      status: r.status as 'pass' | 'warn' | 'fail',
    }));
  },

  /**
   * Get reports by type
   */
  async getByType(reportType: string, limit: number = 10): Promise<QAReportRecord[]> {
    const results = await db
      .select()
      .from(qaReports)
      .where(eq(qaReports.reportType, reportType))
      .orderBy(desc(qaReports.reportDate))
      .limit(limit);
    
    return results.map(r => ({
      ...r,
      status: r.status as 'pass' | 'warn' | 'fail',
    }));
  },

  /**
   * Get the latest report of a specific type
   */
  async getLatestByType(reportType: string): Promise<QAReportRecord | null> {
    const results = await db
      .select()
      .from(qaReports)
      .where(eq(qaReports.reportType, reportType))
      .orderBy(desc(qaReports.reportDate))
      .limit(1);
    
    if (!results[0]) return null;
    return {
      ...results[0],
      status: results[0].status as 'pass' | 'warn' | 'fail',
    };
  },

  /**
   * Get reports from the last N days
   */
  async getRecentDays(days: number): Promise<QAReportRecord[]> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const results = await db
      .select()
      .from(qaReports)
      .where(gte(qaReports.reportDate, cutoffDate))
      .orderBy(desc(qaReports.reportDate));
    
    return results.map(r => ({
      ...r,
      status: r.status as 'pass' | 'warn' | 'fail',
    }));
  },

  /**
   * Get average score over time
   */
  async getAverageScore(days: number = 30): Promise<number> {
    const reports = await this.getRecentDays(days);
    if (reports.length === 0) return 0;
    
    const sum = reports.reduce((acc, r) => acc + r.overallScore, 0);
    return sum / reports.length;
  },

  /**
   * Get score trend (comparing recent vs older reports)
   */
  async getScoreTrend(): Promise<'up' | 'stable' | 'down'> {
    const recentReports = await this.getRecentDays(7);
    
    const cutoffOld = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const cutoffRecent = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const olderResults = await db
      .select()
      .from(qaReports)
      .where(
        and(
          gte(qaReports.reportDate, cutoffOld),
          sql`${qaReports.reportDate} < ${cutoffRecent}`
        )
      );

    if (recentReports.length === 0 || olderResults.length === 0) {
      return 'stable';
    }

    const recentAvg = recentReports.reduce((acc, r) => acc + r.overallScore, 0) / recentReports.length;
    const olderAvg = olderResults.reduce((acc, r) => acc + r.overallScore, 0) / olderResults.length;

    const diff = recentAvg - olderAvg;
    if (diff > 5) return 'up';
    if (diff < -5) return 'down';
    return 'stable';
  },
};
