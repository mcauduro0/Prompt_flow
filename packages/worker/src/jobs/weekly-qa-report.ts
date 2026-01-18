/**
 * ARC Investment Factory - Weekly QA Report v2.0
 * Schedule: Friday 18:00 America/Sao_Paulo
 * 
 * Generates a comprehensive quality assurance report covering:
 * - Lane 0: Ingestion quality (Substack, Reddit, FMP Screener)
 * - Lane A: Discovery quality with detailed gate breakdown
 * - Lane B: Research quality with agent performance
 * - Lane C: IC Memo quality with supporting prompt metrics
 * - Data source health (real metrics from telemetry)
 * - LLM performance (real metrics from telemetry)
 * 
 * UPDATED: Now uses MetricsCalculator for advanced telemetry-based metrics
 */
import { v4 as uuidv4 } from 'uuid';
import {
  SYSTEM_TIMEZONE,
  LANE_B_WEEKLY_LIMIT,
  LANE_B_DAILY_LIMIT,
  LANE_A_DAILY_LIMIT,
} from '@arc/shared';
import {
  runsRepository,
  ideasRepository,
  researchPacketsRepository,
  qaReportsRepository,
  icMemosRepository,
} from '@arc/database';
import { telemetry } from '@arc/database';
import MetricsCalculator from '../qa/metrics-calculator.js';

export interface QAReportResult {
  success: boolean;
  reportId: string;
  overallScore: number;
  status: 'pass' | 'warn' | 'fail';
  errors: string[];
  duration_ms: number;
  report?: QAReportV2;
}

export interface QAReportV2 {
  reportId: string;
  generatedAt: string;
  weekOf: string;
  overallScore: number;
  status: 'pass' | 'warn' | 'fail';
  version: '2.0';
  
  // Lane 0: Ingestion Quality (10% weight)
  lane0Metrics: {
    totalIngested: number;
    bySource: Record<string, { count: number; duplicates: number }>;
    duplicateRate: number;
    sourceDiversity: number;
    score: number;
  };
  
  // Lane A: Discovery Quality (25% weight)
  laneAMetrics: {
    runsCompleted: number;
    runsFailed: number;
    ideasGenerated: number;
    ideasPromoted: number;
    promotionRate: number;
    gateStats: {
      byGate: Record<string, { total: number; passed: number; passRate: number }>;
      overallPassRate: number;
      commonFailures: string[];
    };
    score: number;
  };
  
  // Lane B: Research Quality (25% weight)
  laneBMetrics: {
    runsCompleted: number;
    runsFailed: number;
    packetsGenerated: number;
    packetsCompleted: number;
    agentStats: {
      byAgent: Record<string, { total: number; success: number; avgLatency: number; avgQuality: number }>;
      overallSuccessRate: number;
    };
    score: number;
  };
  
  // Lane C: IC Memo Quality (15% weight)
  laneCMetrics: {
    memosGenerated: number;
    memosCompleted: number;
    supportingPromptStats: {
      byPrompt: Record<string, { total: number; success: number; avgLatency: number; avgConfidence: number }>;
      overallSuccessRate: number;
    };
    score: number;
  };
  
  // Infrastructure Health (15% weight)
  infrastructureMetrics: {
    dataSourceHealth: {
      bySource: Record<string, { 
        total: number; 
        success: number; 
        avgLatency: number; 
        rateLimitHits: number;
        successRate: number;
      }>;
      overallHealth: number;
    };
    llmHealth: {
      byProvider: Record<string, {
        total: number;
        success: number;
        avgLatency: number;
        totalTokens: number;
        fallbacks: number;
        successRate: number;
      }>;
      overallHealth: number;
    };
    score: number;
  };
  
  // Funnel Conversion (10% weight)
  funnelMetrics: {
    lane0ToLaneA: number;
    laneAToLaneB: number;
    laneBToLaneC: number;
    overallConversion: number;
    bottlenecks: string[];
    score: number;
  };
  
  // Alerts
  alerts: Array<{
    severity: 'critical' | 'warning' | 'info';
    category: string;
    subcategory?: string;
    message: string;
    recommendation?: string;
  }>;
  
  // Trends (compared to previous week)
  trends: {
    lane0Trend: 'up' | 'stable' | 'down';
    laneATrend: 'up' | 'stable' | 'down';
    laneBTrend: 'up' | 'stable' | 'down';
    laneCTrend: 'up' | 'stable' | 'down';
    overallTrend: 'up' | 'stable' | 'down';
  };
}

// Type for packet data
interface PacketData {
  gateResults?: {
    all_passed?: boolean;
    first_failed_gate?: number | null;
  };
  status?: string;
}

/**
 * Get the start of the current week (Monday)
 */
function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculate Lane 0 metrics using MetricsCalculator
 */
async function calculateLane0Metrics(calculator: MetricsCalculator): Promise<QAReportV2['lane0Metrics']> {
  try {
    const metrics = await calculator.calculateLane0Metrics();
    return {
      totalIngested: metrics.totalIngested || 0,
      bySource: metrics.bySource || {},
      duplicateRate: metrics.duplicateRate || 0,
      sourceDiversity: metrics.sourceDiversity || 0,
      score: metrics.score || 0,
    };
  } catch (error) {
    console.error('[QA Report] Error calculating Lane 0 metrics:', error);
    return {
      totalIngested: 0,
      bySource: {},
      duplicateRate: 0,
      sourceDiversity: 0,
      score: 0,
    };
  }
}

/**
 * Calculate Lane A metrics using MetricsCalculator
 */
async function calculateLaneAMetrics(calculator: MetricsCalculator): Promise<QAReportV2['laneAMetrics']> {
  try {
    const metrics = await calculator.calculateLaneAMetrics();
    return {
      runsCompleted: metrics.runsCompleted || 0,
      runsFailed: metrics.runsFailed || 0,
      ideasGenerated: metrics.ideasGenerated || 0,
      ideasPromoted: metrics.ideasPromoted || 0,
      promotionRate: metrics.promotionRate || 0,
      gateStats: {
        byGate: metrics.gateStats?.byGate || {},
        overallPassRate: metrics.gateStats?.overallPassRate || 0,
        commonFailures: metrics.gateStats?.commonFailures || [],
      },
      score: metrics.score || 0,
    };
  } catch (error) {
    console.error('[QA Report] Error calculating Lane A metrics:', error);
    return {
      runsCompleted: 0,
      runsFailed: 0,
      ideasGenerated: 0,
      ideasPromoted: 0,
      promotionRate: 0,
      gateStats: {
        byGate: {},
        overallPassRate: 0,
        commonFailures: [],
      },
      score: 0,
    };
  }
}

/**
 * Calculate Lane B metrics using MetricsCalculator
 */
async function calculateLaneBMetrics(calculator: MetricsCalculator): Promise<QAReportV2['laneBMetrics']> {
  try {
    const metrics = await calculator.calculateLaneBMetrics();
    return {
      runsCompleted: metrics.runsCompleted || 0,
      runsFailed: metrics.runsFailed || 0,
      packetsGenerated: metrics.packetsGenerated || 0,
      packetsCompleted: metrics.packetsCompleted || 0,
      agentStats: {
        byAgent: metrics.agentStats?.byAgent || {},
        overallSuccessRate: metrics.agentStats?.overallSuccessRate || 0,
      },
      score: metrics.score || 0,
    };
  } catch (error) {
    console.error('[QA Report] Error calculating Lane B metrics:', error);
    return {
      runsCompleted: 0,
      runsFailed: 0,
      packetsGenerated: 0,
      packetsCompleted: 0,
      agentStats: {
        byAgent: {},
        overallSuccessRate: 0,
      },
      score: 0,
    };
  }
}

/**
 * Calculate Lane C metrics using MetricsCalculator
 */
async function calculateLaneCMetrics(calculator: MetricsCalculator): Promise<QAReportV2['laneCMetrics']> {
  try {
    const metrics = await calculator.calculateLaneCMetrics();
    return {
      memosGenerated: metrics.memosGenerated || 0,
      memosCompleted: metrics.memosCompleted || 0,
      supportingPromptStats: {
        byPrompt: metrics.supportingPromptStats?.byPrompt || {},
        overallSuccessRate: metrics.supportingPromptStats?.overallSuccessRate || 0,
      },
      score: metrics.score || 0,
    };
  } catch (error) {
    console.error('[QA Report] Error calculating Lane C metrics:', error);
    return {
      memosGenerated: 0,
      memosCompleted: 0,
      supportingPromptStats: {
        byPrompt: {},
        overallSuccessRate: 0,
      },
      score: 0,
    };
  }
}

/**
 * Calculate infrastructure metrics using MetricsCalculator
 */
async function calculateInfrastructureMetrics(calculator: MetricsCalculator): Promise<QAReportV2['infrastructureMetrics']> {
  try {
    const metrics = await calculator.calculateInfrastructureMetrics();
    return {
      dataSourceHealth: {
        bySource: metrics.dataSourceHealth?.bySource || {},
        overallHealth: metrics.dataSourceHealth?.overallHealth || 0,
      },
      llmHealth: {
        byProvider: metrics.llmHealth?.byProvider || {},
        overallHealth: metrics.llmHealth?.overallHealth || 0,
      },
      score: metrics.score || 0,
    };
  } catch (error) {
    console.error('[QA Report] Error calculating infrastructure metrics:', error);
    return {
      dataSourceHealth: {
        bySource: {},
        overallHealth: 0,
      },
      llmHealth: {
        byProvider: {},
        overallHealth: 0,
      },
      score: 0,
    };
  }
}

/**
 * Calculate funnel metrics using MetricsCalculator
 */
async function calculateFunnelMetrics(calculator: MetricsCalculator): Promise<QAReportV2['funnelMetrics']> {
  try {
    const metrics = await calculator.calculateFunnelMetrics();
    return {
      lane0ToLaneA: metrics.lane0ToLaneA || 0,
      laneAToLaneB: metrics.laneAToLaneB || 0,
      laneBToLaneC: metrics.laneBToLaneC || 0,
      overallConversion: metrics.overallConversion || 0,
      bottlenecks: metrics.bottlenecks || [],
      score: metrics.score || 0,
    };
  } catch (error) {
    console.error('[QA Report] Error calculating funnel metrics:', error);
    return {
      lane0ToLaneA: 0,
      laneAToLaneB: 0,
      laneBToLaneC: 0,
      overallConversion: 0,
      bottlenecks: [],
      score: 0,
    };
  }
}

/**
 * Generate alerts based on metrics
 * NOTE: Thresholds are LOCKED per governance requirements
 */
function generateAlerts(report: Partial<QAReportV2>): QAReportV2['alerts'] {
  const alerts: QAReportV2['alerts'] = [];
  
  // Lane 0 alerts
  if (report.lane0Metrics) {
    if (report.lane0Metrics.totalIngested === 0) {
      alerts.push({
        severity: 'critical',
        category: 'Lane 0 - Ingestion',
        message: 'No ideas ingested this week',
        recommendation: 'Check Substack, Reddit, and FMP Screener integrations',
      });
    } else if (report.lane0Metrics.totalIngested < 10) {
      alerts.push({
        severity: 'warning',
        category: 'Lane 0 - Ingestion',
        message: `Low ingestion volume: ${report.lane0Metrics.totalIngested} ideas`,
        recommendation: 'Review source configurations and API limits',
      });
    }
    
    if (report.lane0Metrics.sourceDiversity < 50) {
      alerts.push({
        severity: 'warning',
        category: 'Lane 0 - Sources',
        message: `Low source diversity: ${report.lane0Metrics.sourceDiversity.toFixed(0)}%`,
        recommendation: 'Enable additional data sources for better coverage',
      });
    }
  }
  
  // Lane A alerts
  if (report.laneAMetrics) {
    if (report.laneAMetrics.gateStats.overallPassRate === 0) {
      alerts.push({
        severity: 'critical',
        category: 'Lane A - Gates',
        message: 'Zero gate pass rate',
        recommendation: 'Review gate criteria and data quality',
      });
    } else if (report.laneAMetrics.gateStats.overallPassRate < 20) {
      alerts.push({
        severity: 'warning',
        category: 'Lane A - Gates',
        message: `Low gate pass rate: ${report.laneAMetrics.gateStats.overallPassRate.toFixed(1)}%`,
        recommendation: 'Analyze common failure patterns',
      });
    }
    
    if (report.laneAMetrics.runsFailed > report.laneAMetrics.runsCompleted) {
      alerts.push({
        severity: 'critical',
        category: 'Lane A - Runs',
        message: 'More failed runs than completed',
        recommendation: 'Check system logs for errors',
      });
    }
  }
  
  // Lane B alerts
  if (report.laneBMetrics) {
    if (report.laneBMetrics.agentStats.overallSuccessRate < 50) {
      alerts.push({
        severity: 'warning',
        category: 'Lane B - Agents',
        message: `Low agent success rate: ${report.laneBMetrics.agentStats.overallSuccessRate.toFixed(1)}%`,
        recommendation: 'Review agent prompts and error handling',
      });
    }
    
    if (report.laneBMetrics.packetsCompleted === 0 && report.laneBMetrics.packetsGenerated > 0) {
      alerts.push({
        severity: 'critical',
        category: 'Lane B - Research',
        message: 'No research packets completed',
        recommendation: 'Check agent pipeline for blocking issues',
      });
    }
  }
  
  // Lane C alerts
  if (report.laneCMetrics) {
    if (report.laneCMetrics.supportingPromptStats.overallSuccessRate < 70) {
      alerts.push({
        severity: 'warning',
        category: 'Lane C - Prompts',
        message: `Low supporting prompt success rate: ${report.laneCMetrics.supportingPromptStats.overallSuccessRate.toFixed(1)}%`,
        recommendation: 'Review prompt templates and LLM responses',
      });
    }
  }
  
  // Infrastructure alerts
  if (report.infrastructureMetrics) {
    if (report.infrastructureMetrics.dataSourceHealth.overallHealth < 80) {
      alerts.push({
        severity: 'warning',
        category: 'Infrastructure - Data Sources',
        message: `Data source health degraded: ${report.infrastructureMetrics.dataSourceHealth.overallHealth.toFixed(0)}%`,
        recommendation: 'Check API keys and rate limits',
      });
    }
    
    if (report.infrastructureMetrics.llmHealth.overallHealth < 90) {
      alerts.push({
        severity: 'warning',
        category: 'Infrastructure - LLM',
        message: `LLM health degraded: ${report.infrastructureMetrics.llmHealth.overallHealth.toFixed(0)}%`,
        recommendation: 'Check API keys and fallback configurations',
      });
    }
  }
  
  // Funnel alerts
  if (report.funnelMetrics) {
    if (report.funnelMetrics.overallConversion < 1) {
      alerts.push({
        severity: 'info',
        category: 'Funnel',
        message: `Low overall conversion: ${report.funnelMetrics.overallConversion.toFixed(2)}%`,
        recommendation: 'This is normal for a selective investment process',
      });
    }
    
    if (report.funnelMetrics.bottlenecks.length > 0) {
      alerts.push({
        severity: 'warning',
        category: 'Funnel - Bottlenecks',
        message: `Bottlenecks identified: ${report.funnelMetrics.bottlenecks.join(', ')}`,
        recommendation: 'Focus optimization efforts on bottleneck areas',
      });
    }
  }
  
  return alerts;
}

/**
 * Calculate overall score with weighted components
 * NOTE: Weights are LOCKED per governance requirements
 */
function calculateOverallScore(report: Partial<QAReportV2>): number {
  const weights = {
    lane0: 0.10,
    laneA: 0.25,
    laneB: 0.25,
    laneC: 0.15,
    infrastructure: 0.15,
    funnel: 0.10,
  };
  
  const lane0Score = report.lane0Metrics?.score || 0;
  const laneAScore = report.laneAMetrics?.score || 0;
  const laneBScore = report.laneBMetrics?.score || 0;
  const laneCScore = report.laneCMetrics?.score || 0;
  const infraScore = report.infrastructureMetrics?.score || 0;
  const funnelScore = report.funnelMetrics?.score || 0;
  
  return Math.round(
    lane0Score * weights.lane0 +
    laneAScore * weights.laneA +
    laneBScore * weights.laneB +
    laneCScore * weights.laneC +
    infraScore * weights.infrastructure +
    funnelScore * weights.funnel
  );
}

/**
 * Determine status based on score and alerts
 * NOTE: Thresholds are LOCKED per governance requirements
 */
function determineStatus(score: number, alerts: QAReportV2['alerts']): 'pass' | 'warn' | 'fail' {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const warningAlerts = alerts.filter(a => a.severity === 'warning').length;
  
  if (criticalAlerts > 0 || score < 50) return 'fail';
  if (warningAlerts > 2 || score < 70) return 'warn';
  return 'pass';
}

/**
 * Calculate trends compared to previous week using MetricsCalculator
 */
async function calculateTrends(calculator: MetricsCalculator): Promise<QAReportV2['trends']> {
  try {
    const historical = await calculator.calculateHistoricalComparison();
    
    const getTrendDirection = (trend: any): 'up' | 'stable' | 'down' => {
      if (!trend) return 'stable';
      if (trend.trend === 'improving') return 'up';
      if (trend.trend === 'declining') return 'down';
      return 'stable';
    };
    
    return {
      lane0Trend: getTrendDirection(historical.lane0Trend),
      laneATrend: getTrendDirection(historical.laneATrend),
      laneBTrend: getTrendDirection(historical.laneBTrend),
      laneCTrend: getTrendDirection(historical.laneCTrend),
      overallTrend: getTrendDirection(historical.overallTrend),
    };
  } catch (error) {
    console.error('[QA Report] Error calculating trends:', error);
    return {
      lane0Trend: 'stable',
      laneATrend: 'stable',
      laneBTrend: 'stable',
      laneCTrend: 'stable',
      overallTrend: 'stable',
    };
  }
}

/**
 * Run the weekly QA report v2.0
 */
export async function runWeeklyQAReport(): Promise<QAReportResult> {
  const startTime = Date.now();
  const reportId = uuidv4();
  const errors: string[] = [];
  const lookbackDays = 7;

  console.log(`[QA Report v2.0] Generating report ${reportId}`);
  console.log(`[QA Report v2.0] Timezone: ${SYSTEM_TIMEZONE}`);

  try {
    const weekStart = getWeekStart();
    const weekOf = weekStart.toISOString().split('T')[0];
    
    // Initialize MetricsCalculator for the lookback period
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const calculator = new MetricsCalculator(startDate, endDate);

    // Calculate all metrics using MetricsCalculator
    console.log('[QA Report v2.0] Calculating Lane 0 metrics...');
    const lane0Metrics = await calculateLane0Metrics(calculator);

    console.log('[QA Report v2.0] Calculating Lane A metrics...');
    const laneAMetrics = await calculateLaneAMetrics(calculator);

    console.log('[QA Report v2.0] Calculating Lane B metrics...');
    const laneBMetrics = await calculateLaneBMetrics(calculator);

    console.log('[QA Report v2.0] Calculating Lane C metrics...');
    const laneCMetrics = await calculateLaneCMetrics(calculator);

    console.log('[QA Report v2.0] Calculating infrastructure metrics...');
    const infrastructureMetrics = await calculateInfrastructureMetrics(calculator);

    console.log('[QA Report v2.0] Calculating funnel metrics...');
    const funnelMetrics = await calculateFunnelMetrics(calculator);

    // Build partial report for alert generation
    const partialReport: Partial<QAReportV2> = {
      lane0Metrics,
      laneAMetrics,
      laneBMetrics,
      laneCMetrics,
      infrastructureMetrics,
      funnelMetrics,
    };

    // Generate alerts
    const alerts = generateAlerts(partialReport);

    // Calculate overall score and status
    const overallScore = calculateOverallScore(partialReport);
    const status = determineStatus(overallScore, alerts);

    // Calculate trends
    const trends = await calculateTrends(calculator);

    // Build the complete report
    const report: QAReportV2 = {
      reportId,
      generatedAt: new Date().toISOString(),
      weekOf,
      overallScore,
      status,
      version: '2.0',
      lane0Metrics,
      laneAMetrics,
      laneBMetrics,
      laneCMetrics,
      infrastructureMetrics,
      funnelMetrics,
      alerts,
      trends,
    };

    // Save the report
    await qaReportsRepository.create({
      reportId,
      reportType: 'weekly_qa_v2',
      reportDate: new Date(),
      overallScore,
      status,
      payload: report,
    });

    console.log(`[QA Report v2.0] Report generated - Score: ${overallScore}, Status: ${status}`);
    console.log(`[QA Report v2.0] Alerts: ${alerts.length} (${alerts.filter(a => a.severity === 'critical').length} critical)`);

    return {
      success: true,
      reportId,
      overallScore,
      status,
      errors,
      duration_ms: Date.now() - startTime,
      report,
    };

  } catch (error) {
    const errorMessage = (error as Error).message;
    errors.push(errorMessage);
    console.error('[QA Report v2.0] Generation failed:', errorMessage);

    return {
      success: false,
      reportId,
      overallScore: 0,
      status: 'fail',
      errors,
      duration_ms: Date.now() - startTime,
    };
  }
}
