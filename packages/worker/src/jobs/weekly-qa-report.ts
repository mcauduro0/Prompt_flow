/**
 * ARC Investment Factory - Weekly QA Report
 * Schedule: Friday 18:00 America/Sao_Paulo
 * 
 * Generates a comprehensive quality assurance report covering:
 * - System health metrics
 * - Research quality metrics
 * - Gate pass/fail rates
 * - Data source reliability
 * - LLM performance
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
} from '@arc/database';

export interface QAReportResult {
  success: boolean;
  reportId: string;
  overallScore: number;
  status: 'pass' | 'warn' | 'fail';
  errors: string[];
  duration_ms: number;
  report?: QAReport;
}

export interface QAReport {
  reportId: string;
  generatedAt: string;
  weekOf: string;
  overallScore: number;
  status: 'pass' | 'warn' | 'fail';
  
  // System metrics
  systemMetrics: {
    laneARunsCompleted: number;
    laneARunsFailed: number;
    laneBRunsCompleted: number;
    laneBRunsFailed: number;
    avgRunDuration: number;
    errorRate: number;
  };
  
  // Research quality
  researchQuality: {
    ideasGenerated: number;
    ideasPromoted: number;
    packetsCompleted: number;
    avgGatePassRate: number;
    gateFailureBreakdown: Record<string, number>;
  };
  
  // Data source health
  dataSourceHealth: {
    fmpAvailability: number;
    polygonAvailability: number;
    secEdgarAvailability: number;
    avgDataFreshness: number;
  };
  
  // LLM performance
  llmPerformance: {
    totalCalls: number;
    successRate: number;
    avgLatency: number;
    avgTokensPerCall: number;
    fallbacksTriggered: number;
  };
  
  // Alerts and recommendations
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    category: string;
    message: string;
    recommendation?: string;
  }>;
  
  // Trends
  trends: {
    ideaGenerationTrend: 'up' | 'stable' | 'down';
    qualityTrend: 'up' | 'stable' | 'down';
    systemHealthTrend: 'up' | 'stable' | 'down';
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
 * Calculate system metrics from run history
 */
async function calculateSystemMetrics(lookbackDays: number): Promise<QAReport['systemMetrics']> {
  const laneARuns = await runsRepository.getByType('daily_discovery', 100);
  const laneBRuns = await runsRepository.getByType('lane_b_research', 100);
  
  const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  
  const recentLaneA = laneARuns.filter(r => new Date(r.runDate) >= cutoffDate);
  const recentLaneB = laneBRuns.filter(r => new Date(r.runDate) >= cutoffDate);
  
  const laneACompleted = recentLaneA.filter(r => r.status === 'completed').length;
  const laneAFailed = recentLaneA.filter(r => r.status === 'failed').length;
  const laneBCompleted = recentLaneB.filter(r => r.status === 'completed').length;
  const laneBFailed = recentLaneB.filter(r => r.status === 'failed').length;
  
  const allRuns = [...recentLaneA, ...recentLaneB];
  const avgDuration = allRuns.length > 0
    ? allRuns.reduce((sum, r) => sum + ((r.payload as any)?.duration_ms || 0), 0) / allRuns.length
    : 0;
  
  const totalRuns = allRuns.length;
  const failedRuns = laneAFailed + laneBFailed;
  const errorRate = totalRuns > 0 ? failedRuns / totalRuns : 0;
  
  return {
    laneARunsCompleted: laneACompleted,
    laneARunsFailed: laneAFailed,
    laneBRunsCompleted: laneBCompleted,
    laneBRunsFailed: laneBFailed,
    avgRunDuration: avgDuration,
    errorRate,
  };
}

/**
 * Calculate research quality metrics
 */
async function calculateResearchQuality(lookbackDays: number): Promise<QAReport['researchQuality']> {
  const packets = await researchPacketsRepository.getRecentPackets(lookbackDays);
  
  // Count ideas by status
  const newIdeas = await ideasRepository.getByStatus('new');
  const promotedIdeas = await ideasRepository.getByStatus('promoted');
  
  // Calculate gate pass rate
  let totalGateChecks = 0;
  let passedGateChecks = 0;
  const gateFailures: Record<string, number> = {
    'DATA_SUFFICIENCY': 0,
    'COHERENCE': 0,
    'EDGE_CLAIM': 0,
    'DOWNSIDE_SANITY': 0,
    'STYLE_FIT': 0,
  };

  let completedPackets = 0;

  for (const packet of packets) {
    const packetData = packet.packet as PacketData;
    
    if (packetData?.gateResults) {
      totalGateChecks++;
      if (packetData.gateResults.all_passed) {
        passedGateChecks++;
      } else if (packetData.gateResults.first_failed_gate !== null && packetData.gateResults.first_failed_gate !== undefined) {
        const gateName = getGateName(packetData.gateResults.first_failed_gate);
        gateFailures[gateName] = (gateFailures[gateName] || 0) + 1;
      }
    }
    
    if (packetData?.status === 'complete') {
      completedPackets++;
    }
  }
  
  return {
    ideasGenerated: newIdeas.length + promotedIdeas.length,
    ideasPromoted: promotedIdeas.length,
    packetsCompleted: completedPackets,
    avgGatePassRate: totalGateChecks > 0 ? passedGateChecks / totalGateChecks : 0,
    gateFailureBreakdown: gateFailures,
  };
}

function getGateName(gateId: number): string {
  const names: Record<number, string> = {
    0: 'DATA_SUFFICIENCY',
    1: 'COHERENCE',
    2: 'EDGE_CLAIM',
    3: 'DOWNSIDE_SANITY',
    4: 'STYLE_FIT',
  };
  return names[gateId] || 'UNKNOWN';
}

/**
 * Estimate data source health (would need actual tracking in production)
 */
function estimateDataSourceHealth(): QAReport['dataSourceHealth'] {
  // In production, these would come from actual API call tracking
  return {
    fmpAvailability: 0.98,
    polygonAvailability: 0.99,
    secEdgarAvailability: 0.95,
    avgDataFreshness: 0.92,
  };
}

/**
 * Estimate LLM performance (would need actual tracking in production)
 */
function estimateLLMPerformance(): QAReport['llmPerformance'] {
  // In production, these would come from actual LLM call tracking
  return {
    totalCalls: 150,
    successRate: 0.97,
    avgLatency: 2500,
    avgTokensPerCall: 3000,
    fallbacksTriggered: 3,
  };
}

/**
 * Generate alerts based on metrics
 */
function generateAlerts(
  systemMetrics: QAReport['systemMetrics'],
  researchQuality: QAReport['researchQuality'],
  dataSourceHealth: QAReport['dataSourceHealth'],
  llmPerformance: QAReport['llmPerformance']
): QAReport['alerts'] {
  const alerts: QAReport['alerts'] = [];
  
  // System health alerts
  if (systemMetrics.errorRate > 0.2) {
    alerts.push({
      severity: 'critical',
      category: 'System Health',
      message: `High error rate: ${(systemMetrics.errorRate * 100).toFixed(1)}%`,
      recommendation: 'Review recent error logs and investigate root cause',
    });
  } else if (systemMetrics.errorRate > 0.1) {
    alerts.push({
      severity: 'warning',
      category: 'System Health',
      message: `Elevated error rate: ${(systemMetrics.errorRate * 100).toFixed(1)}%`,
      recommendation: 'Monitor closely and investigate if trend continues',
    });
  }
  
  // Research quality alerts
  if (researchQuality.avgGatePassRate < 0.3) {
    alerts.push({
      severity: 'warning',
      category: 'Research Quality',
      message: `Low gate pass rate: ${(researchQuality.avgGatePassRate * 100).toFixed(1)}%`,
      recommendation: 'Review idea generation criteria and data quality',
    });
  }
  
  // Data source alerts
  if (dataSourceHealth.fmpAvailability < 0.95) {
    alerts.push({
      severity: 'warning',
      category: 'Data Sources',
      message: `FMP availability below threshold: ${(dataSourceHealth.fmpAvailability * 100).toFixed(1)}%`,
      recommendation: 'Check API key status and rate limits',
    });
  }
  
  // LLM performance alerts
  if (llmPerformance.successRate < 0.95) {
    alerts.push({
      severity: 'warning',
      category: 'LLM Performance',
      message: `LLM success rate below threshold: ${(llmPerformance.successRate * 100).toFixed(1)}%`,
      recommendation: 'Review prompt templates and error handling',
    });
  }
  
  if (llmPerformance.fallbacksTriggered > 10) {
    alerts.push({
      severity: 'info',
      category: 'LLM Performance',
      message: `${llmPerformance.fallbacksTriggered} fallbacks triggered this week`,
      recommendation: 'Consider reviewing primary LLM provider status',
    });
  }
  
  // Capacity alerts
  if (researchQuality.packetsCompleted >= LANE_B_WEEKLY_LIMIT * 0.9) {
    alerts.push({
      severity: 'info',
      category: 'Capacity',
      message: 'Approaching weekly research capacity limit',
      recommendation: 'Consider prioritizing highest-conviction ideas',
    });
  }
  
  return alerts;
}

/**
 * Calculate overall score
 */
function calculateOverallScore(
  systemMetrics: QAReport['systemMetrics'],
  researchQuality: QAReport['researchQuality'],
  dataSourceHealth: QAReport['dataSourceHealth'],
  llmPerformance: QAReport['llmPerformance']
): number {
  // Weight different components
  const systemScore = (1 - systemMetrics.errorRate) * 100;
  const researchScore = researchQuality.avgGatePassRate * 100;
  const dataScore = (
    dataSourceHealth.fmpAvailability +
    dataSourceHealth.polygonAvailability +
    dataSourceHealth.secEdgarAvailability
  ) / 3 * 100;
  const llmScore = llmPerformance.successRate * 100;
  
  // Weighted average
  return Math.round(
    systemScore * 0.3 +
    researchScore * 0.3 +
    dataScore * 0.2 +
    llmScore * 0.2
  );
}

/**
 * Determine status based on score and alerts
 */
function determineStatus(score: number, alerts: QAReport['alerts']): 'pass' | 'warn' | 'fail' {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const warningAlerts = alerts.filter(a => a.severity === 'warning').length;
  
  if (criticalAlerts > 0 || score < 60) return 'fail';
  if (warningAlerts > 2 || score < 75) return 'warn';
  return 'pass';
}

/**
 * Run the weekly QA report
 */
export async function runWeeklyQAReport(): Promise<QAReportResult> {
  const startTime = Date.now();
  const reportId = uuidv4();
  const errors: string[] = [];
  const lookbackDays = 7;

  console.log(`[QA Report] Generating report ${reportId}`);
  console.log(`[QA Report] Timezone: ${SYSTEM_TIMEZONE}`);
  console.log(`[QA Report] Weekly cap: ${LANE_B_WEEKLY_LIMIT}, Daily: ${LANE_B_DAILY_LIMIT}`);

  try {
    const weekStart = getWeekStart();
    const weekOf = weekStart.toISOString().split('T')[0];

    // Calculate all metrics
    console.log('[QA Report] Calculating system metrics...');
    const systemMetrics = await calculateSystemMetrics(lookbackDays);

    console.log('[QA Report] Calculating research quality...');
    const researchQuality = await calculateResearchQuality(lookbackDays);

    console.log('[QA Report] Estimating data source health...');
    const dataSourceHealth = estimateDataSourceHealth();

    console.log('[QA Report] Estimating LLM performance...');
    const llmPerformance = estimateLLMPerformance();

    // Generate alerts
    const alerts = generateAlerts(systemMetrics, researchQuality, dataSourceHealth, llmPerformance);

    // Calculate overall score and status
    const overallScore = calculateOverallScore(systemMetrics, researchQuality, dataSourceHealth, llmPerformance);
    const status = determineStatus(overallScore, alerts);

    // Build the report
    const report: QAReport = {
      reportId,
      generatedAt: new Date().toISOString(),
      weekOf,
      overallScore,
      status,
      systemMetrics,
      researchQuality,
      dataSourceHealth,
      llmPerformance,
      alerts,
      trends: {
        ideaGenerationTrend: 'stable',
        qualityTrend: 'stable',
        systemHealthTrend: 'stable',
      },
    };

    // Save the report
    await qaReportsRepository.create({
      reportId,
      reportType: 'weekly_qa',
      reportDate: new Date(),
      overallScore,
      status,
      payload: report,
    });

    console.log(`[QA Report] Report generated - Score: ${overallScore}, Status: ${status}`);
    console.log(`[QA Report] Alerts: ${alerts.length} (${alerts.filter(a => a.severity === 'critical').length} critical)`);

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

    console.error('[QA Report] Generation failed:', errorMessage);

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

export default { runWeeklyQAReport };
