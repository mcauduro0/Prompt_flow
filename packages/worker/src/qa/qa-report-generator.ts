/**
 * QA Framework v2.0 - Report Generator
 * Phase 3: Main report generation with all metrics, alerts, and historical comparison
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '@arc/database';
import { sql } from 'drizzle-orm';
import { MetricsCalculator, type HistoricalComparison, type TrendData } from './metrics-calculator.js';
import { AlertGenerator, type Alert, type AlertThresholds, DEFAULT_THRESHOLDS } from './alert-system.js';
import { notifyOnCriticalAlerts } from './email-notifications.js';

// ============================================================================
// Types
// ============================================================================

export type ReportStatus = 'healthy' | 'warn' | 'fail';

export interface QAReportV2 {
  reportId: string;
  version: string;
  generatedAt: Date;
  weekOf: string;
  timezone: string;
  
  // Overall
  overallScore: number;
  status: ReportStatus;
  
  // Section Scores
  sectionScores: {
    lane0: number;
    laneA: number;
    laneB: number;
    laneC: number;
    infrastructure: number;
    funnel: number;
  };
  
  // Detailed Metrics
  lane0Metrics: any;
  laneAMetrics: any;
  laneBMetrics: any;
  laneCMetrics: any;
  infrastructureMetrics: any;
  funnelMetrics: any;
  
  // Alerts
  alerts: Alert[];
  alertSummary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  
  // Trends
  trends: HistoricalComparison;
  
  // Metadata
  executionTimeMs: number;
  dataQuality: {
    completeness: number;
    freshness: number;
  };
}

export interface QAReportGeneratorConfig {
  timezone: string;
  thresholds: Partial<AlertThresholds>;
  weights: {
    lane0: number;
    laneA: number;
    laneB: number;
    laneC: number;
    infrastructure: number;
    funnel: number;
  };
}

const DEFAULT_CONFIG: QAReportGeneratorConfig = {
  timezone: 'America/Sao_Paulo',
  thresholds: DEFAULT_THRESHOLDS,
  weights: {
    lane0: 0.10,
    laneA: 0.25,
    laneB: 0.25,
    laneC: 0.15,
    infrastructure: 0.15,
    funnel: 0.10,
  },
};

// ============================================================================
// QA Report Generator Class
// ============================================================================

export class QAReportGenerator {
  private config: QAReportGeneratorConfig;

  constructor(config: Partial<QAReportGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Date Helpers
  // --------------------------------------------------------------------------

  private getWeekStartDate(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  private getWeekEndDate(): Date {
    const weekStart = this.getWeekStartDate();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return weekEnd;
  }

  // --------------------------------------------------------------------------
  // Score Calculation
  // --------------------------------------------------------------------------

  private calculateOverallScore(sectionScores: Record<string, number>): number {
    const { weights } = this.config;
    
    const weightedScore = 
      (sectionScores.lane0 * weights.lane0) +
      (sectionScores.laneA * weights.laneA) +
      (sectionScores.laneB * weights.laneB) +
      (sectionScores.laneC * weights.laneC) +
      (sectionScores.infrastructure * weights.infrastructure) +
      (sectionScores.funnel * weights.funnel);

    return Math.round(Math.max(0, Math.min(100, weightedScore)));
  }

  private determineStatus(score: number, criticalAlerts: number): ReportStatus {
    if (criticalAlerts > 0 || score < 40) return 'fail';
    if (score < 70) return 'warn';
    return 'healthy';
  }

  // --------------------------------------------------------------------------
  // Data Quality Assessment
  // --------------------------------------------------------------------------

  private async assessDataQuality(startDate: Date, endDate: Date): Promise<{ completeness: number; freshness: number }> {
    try {
      // Check completeness: how many tables have data
      const tables = [
        'lane0_ingestion_stats',
        'gate_results',
        'agent_performance',
        'supporting_prompt_results',
        'data_source_calls',
        'llm_calls',
      ];

      let tablesWithData = 0;
      for (const table of tables) {
        try {
          const result = await db.execute(sql.raw(`
            SELECT COUNT(*) as count FROM ${table}
            WHERE created_at >= '${startDate.toISOString()}' AND created_at < '${endDate.toISOString()}'
          `));
          if (Number((result.rows as any[])[0]?.count) > 0) {
            tablesWithData++;
          }
        } catch {
          // Table might not exist
        }
      }
      const completeness = (tablesWithData / tables.length) * 100;

      // Check freshness: most recent data timestamp
      let mostRecentData: Date | null = null;
      for (const table of tables) {
        try {
          const result = await db.execute(sql.raw(`
            SELECT MAX(created_at) as latest FROM ${table}
          `));
          const latest = (result.rows as any[])[0]?.latest;
          if (latest) {
            const latestDate = new Date(latest);
            if (!mostRecentData || latestDate > mostRecentData) {
              mostRecentData = latestDate;
            }
          }
        } catch {
          // Table might not exist
        }
      }

      let freshness = 0;
      if (mostRecentData) {
        const hoursSinceUpdate = (Date.now() - mostRecentData.getTime()) / (1000 * 60 * 60);
        freshness = Math.max(0, 100 - (hoursSinceUpdate * 2)); // Lose 2% per hour
      }

      return {
        completeness: Math.round(completeness),
        freshness: Math.round(freshness),
      };
    } catch (error) {
      console.error('[QAReportGenerator] Error assessing data quality:', error);
      return { completeness: 0, freshness: 0 };
    }
  }

  // --------------------------------------------------------------------------
  // Trend Calculation with Current Values
  // --------------------------------------------------------------------------

  private updateTrendsWithCurrentScores(
    trends: HistoricalComparison,
    currentScores: Record<string, number>
  ): HistoricalComparison {
    const updateTrend = (trend: TrendData, currentScore: number): TrendData => {
      const change = currentScore - trend.previous;
      const changePercent = trend.previous > 0 ? (change / trend.previous) * 100 : 0;
      let trendDirection: 'improving' | 'stable' | 'declining' = 'stable';
      
      if (changePercent > 5) trendDirection = 'improving';
      else if (changePercent < -5) trendDirection = 'declining';

      return {
        current: currentScore,
        previous: trend.previous,
        change,
        changePercent,
        trend: trendDirection,
      };
    };

    return {
      ...trends,
      lane0Trend: updateTrend(trends.lane0Trend, currentScores.lane0),
      laneATrend: updateTrend(trends.laneATrend, currentScores.laneA),
      laneBTrend: updateTrend(trends.laneBTrend, currentScores.laneB),
      laneCTrend: updateTrend(trends.laneCTrend, currentScores.laneC),
      overallTrend: updateTrend(trends.overallTrend, currentScores.overall),
    };
  }

  // --------------------------------------------------------------------------
  // Save Report
  // --------------------------------------------------------------------------

  private async saveReport(report: QAReportV2): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO qa_reports (id, week_of, report_data, overall_score, status, created_at)
        VALUES (
          ${report.reportId},
          ${report.weekOf},
          ${JSON.stringify(report)},
          ${report.overallScore},
          ${report.status},
          ${report.generatedAt.toISOString()}
        )
      `);
      console.log(`[QAReportGenerator] Report saved: ${report.reportId}`);
    } catch (error) {
      console.error('[QAReportGenerator] Error saving report:', error);
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Main Generation Method
  // --------------------------------------------------------------------------

  async generate(): Promise<QAReportV2> {
    const startTime = Date.now();
    const reportId = uuidv4();
    const startDate = this.getWeekStartDate();
    const endDate = this.getWeekEndDate();
    const weekOf = startDate.toISOString().split('T')[0];

    console.log(`[QAReportGenerator v2.0] Generating report ${reportId}`);
    console.log(`[QAReportGenerator v2.0] Week: ${weekOf} to ${endDate.toISOString().split('T')[0]}`);
    console.log(`[QAReportGenerator v2.0] Timezone: ${this.config.timezone}`);

    // Initialize calculators
    const metricsCalculator = new MetricsCalculator(startDate, endDate);
    const alertGenerator = new AlertGenerator(this.config.thresholds);

    // Calculate all metrics
    console.log('[QAReportGenerator v2.0] Calculating Lane 0 metrics...');
    const lane0Metrics = await metricsCalculator.calculateLane0Metrics();

    console.log('[QAReportGenerator v2.0] Calculating Lane A metrics...');
    const laneAMetrics = await metricsCalculator.calculateLaneAMetrics();

    console.log('[QAReportGenerator v2.0] Calculating Lane B metrics...');
    const laneBMetrics = await metricsCalculator.calculateLaneBMetrics();

    console.log('[QAReportGenerator v2.0] Calculating Lane C metrics...');
    const laneCMetrics = await metricsCalculator.calculateLaneCMetrics();

    console.log('[QAReportGenerator v2.0] Calculating infrastructure metrics...');
    const infrastructureMetrics = await metricsCalculator.calculateInfrastructureMetrics();

    console.log('[QAReportGenerator v2.0] Calculating funnel metrics...');
    const funnelMetrics = await metricsCalculator.calculateFunnelMetrics();

    console.log('[QAReportGenerator v2.0] Calculating historical trends...');
    let trends = await metricsCalculator.calculateHistoricalComparison();

    // Section scores
    const sectionScores = {
      lane0: lane0Metrics.score,
      laneA: laneAMetrics.score,
      laneB: laneBMetrics.score,
      laneC: laneCMetrics.score,
      infrastructure: infrastructureMetrics.score,
      funnel: funnelMetrics.score,
    };

    // Overall score
    const overallScore = this.calculateOverallScore(sectionScores);

    // Update trends with current scores
    trends = this.updateTrendsWithCurrentScores(trends, {
      ...sectionScores,
      overall: overallScore,
    });

    // Generate alerts
    console.log('[QAReportGenerator v2.0] Generating alerts...');
    const alerts = alertGenerator.generateAllAlerts(
      lane0Metrics,
      laneAMetrics,
      laneBMetrics,
      laneCMetrics,
      infrastructureMetrics,
      funnelMetrics,
      trends
    );
    const alertSummary = alertGenerator.getSummary();

    // Determine status
    const status = this.determineStatus(overallScore, alertSummary.critical);

    // Assess data quality
    console.log('[QAReportGenerator v2.0] Assessing data quality...');
    const dataQuality = await this.assessDataQuality(startDate, endDate);

    const executionTimeMs = Date.now() - startTime;

    console.log(`[QAReportGenerator v2.0] Report generated - Score: ${overallScore}, Status: ${status}`);
    console.log(`[QAReportGenerator v2.0] Alerts: ${alertSummary.total} (${alertSummary.critical} critical)`);

    // Build report
    const report: QAReportV2 = {
      reportId,
      version: '2.0',
      generatedAt: new Date(),
      weekOf,
      timezone: this.config.timezone,
      overallScore,
      status,
      sectionScores,
      lane0Metrics,
      laneAMetrics,
      laneBMetrics,
      laneCMetrics,
      infrastructureMetrics,
      funnelMetrics,
      alerts,
      alertSummary,
      trends,
      executionTimeMs,
      dataQuality,
    };

    // Save report
    await this.saveReport(report);

    // Send email notification for critical alerts
    await notifyOnCriticalAlerts(
      alerts,
      reportId,
      weekOf,
      overallScore,
      status
    );

    return report;
  }

  // --------------------------------------------------------------------------
  // Get Historical Reports
  // --------------------------------------------------------------------------

  async getHistoricalReports(limit: number = 10): Promise<QAReportV2[]> {
    try {
      const results = await db.execute(sql`
        SELECT report_data
        FROM qa_reports
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);

      return (results.rows as any[]).map(row => {
        const data = typeof row.report_data === 'string' 
          ? JSON.parse(row.report_data) 
          : row.report_data;
        return data as QAReportV2;
      });
    } catch (error) {
      console.error('[QAReportGenerator] Error getting historical reports:', error);
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // Get Latest Report
  // --------------------------------------------------------------------------

  async getLatestReport(): Promise<QAReportV2 | null> {
    try {
      const results = await db.execute(sql`
        SELECT report_data
        FROM qa_reports
        ORDER BY created_at DESC
        LIMIT 1
      `);

      if ((results.rows as any[]).length === 0) return null;

      const data = (results.rows as any[])[0].report_data;
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (error) {
      console.error('[QAReportGenerator] Error getting latest report:', error);
      return null;
    }
  }
}

// ============================================================================
// Export Functions
// ============================================================================

export async function generateQAReportV2(config?: Partial<QAReportGeneratorConfig>): Promise<QAReportV2> {
  const generator = new QAReportGenerator(config);
  return generator.generate();
}

export async function getLatestQAReport(): Promise<QAReportV2 | null> {
  const generator = new QAReportGenerator();
  return generator.getLatestReport();
}

export async function getQAReportHistory(limit?: number): Promise<QAReportV2[]> {
  const generator = new QAReportGenerator();
  return generator.getHistoricalReports(limit);
}

export default QAReportGenerator;
