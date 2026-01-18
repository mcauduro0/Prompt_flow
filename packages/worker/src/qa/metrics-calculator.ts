/**
 * ARC Investment Factory - QA Metrics Calculator
 * Advanced metrics calculation using telemetry data
 * 
 * This class provides comprehensive metrics calculation for the QA Framework v2.0
 * by querying the telemetry tables and aggregating data.
 */
import { telemetry } from '@arc/database';
import {
  runsRepository,
  ideasRepository,
  researchPacketsRepository,
  icMemosRepository,
} from '@arc/database';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface Lane0Metrics {
  totalIngested: number;
  bySource: Record<string, { count: number; duplicates: number }>;
  duplicateRate: number;
  sourceDiversity: number;
  score: number;
}

export interface LaneAMetrics {
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
}

export interface LaneBMetrics {
  runsCompleted: number;
  runsFailed: number;
  packetsGenerated: number;
  packetsCompleted: number;
  agentStats: {
    byAgent: Record<string, { total: number; success: number; avgLatency: number; avgQuality: number }>;
    overallSuccessRate: number;
  };
  score: number;
}

export interface LaneCMetrics {
  memosGenerated: number;
  memosCompleted: number;
  supportingPromptStats: {
    byPrompt: Record<string, { total: number; success: number; avgLatency: number; avgConfidence: number }>;
    overallSuccessRate: number;
  };
  score: number;
}

export interface InfrastructureMetrics {
  dataSourceHealth: {
    bySource: Record<string, { total: number; success: number; avgLatency: number; rateLimitHits: number; successRate: number }>;
    overallHealth: number;
  };
  llmHealth: {
    byProvider: Record<string, { total: number; success: number; avgLatency: number; totalTokens: number; fallbacks: number; successRate: number }>;
    overallHealth: number;
  };
  score: number;
}

export interface FunnelMetrics {
  lane0ToLaneA: number;
  laneAToLaneB: number;
  laneBToLaneC: number;
  overallConversion: number;
  bottlenecks: string[];
  score: number;
}

export interface TrendData {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface HistoricalComparison {
  lane0Trend: TrendData;
  laneATrend: TrendData;
  laneBTrend: TrendData;
  laneCTrend: TrendData;
  overallTrend: TrendData;
  weekOverWeek: Array<{ week: string; score: number }>;
}

// ============================================================================
// MetricsCalculator Class
// ============================================================================

export class MetricsCalculator {
  private startDate: Date;
  private endDate: Date;
  private lookbackDays: number;

  constructor(startDate: Date, endDate: Date) {
    this.startDate = startDate;
    this.endDate = endDate;
    this.lookbackDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  }

  // --------------------------------------------------------------------------
  // Lane 0 Metrics
  // --------------------------------------------------------------------------
  async calculateLane0Metrics() {
    try {
      const lane0Stats = await telemetry.getLane0Stats(this.lookbackDays);
      
      let totalIngested = 0;
      const bySource: Record<string, { count: number; duplicates: number }> = {};
      
      if (Array.isArray(lane0Stats)) {
        for (const stat of lane0Stats) {
          const source = stat.source || 'unknown';
          const count = Number(stat.total_ideas) || 0;
          bySource[source] = { count, duplicates: 0 };
          totalIngested += count;
        }
      }
      
      const sourceCount = Object.keys(bySource).length;
      const sourceDiversity = sourceCount >= 3 ? 100 : (sourceCount / 3) * 100;
      
      // Calculate score: diversity (40%) + volume (60%)
      const volumeScore = Math.min(totalIngested / 50, 1) * 100;
      const score = Math.round(sourceDiversity * 0.4 + volumeScore * 0.6);
      
      return {
        totalIngested,
        bySource,
        duplicateRate: 0,
        sourceDiversity,
        score,
      };
    } catch (error) {
      console.error('[MetricsCalculator] Error calculating Lane 0 metrics:', error);
      return {
        totalIngested: 0,
        bySource: {},
        duplicateRate: 0,
        sourceDiversity: 0,
        score: 0,
      };
    }
  }

  // --------------------------------------------------------------------------
  // Lane A Metrics
  // --------------------------------------------------------------------------
  async calculateLaneAMetrics() {
    try {
      const laneARuns = await runsRepository.getByType('daily_discovery', 100);
      const cutoffDate = new Date(this.startDate);
      const recentRuns = laneARuns.filter(r => new Date(r.runDate) >= cutoffDate);
      
      const runsCompleted = recentRuns.filter(r => r.status === 'completed').length;
      const runsFailed = recentRuns.filter(r => r.status === 'failed').length;
      
      // Get ideas stats
      const newIdeas = await ideasRepository.getByStatus('new');
      const promotedIdeas = await ideasRepository.getByStatus('promoted');
      const ideasGenerated = newIdeas.length + promotedIdeas.length;
      const ideasPromoted = promotedIdeas.length;
      const promotionRate = ideasGenerated > 0 ? (ideasPromoted / ideasGenerated) * 100 : 0;
      
      // Get gate stats from telemetry
      const telemetryGateStats = await telemetry.getGateStats(this.lookbackDays);
      
      const byGate: Record<string, { total: number; passed: number; passRate: number }> = {};
      let totalEvaluations = 0;
      let totalPassed = 0;
      
      if (Array.isArray(telemetryGateStats)) {
        for (const stat of telemetryGateStats) {
          const gateKey = `gate_${stat.gate_id}`;
          const total = Number(stat.total) || 0;
          const passed = Number(stat.passed) || 0;
          
          byGate[gateKey] = {
            total,
            passed,
            passRate: total > 0 ? (passed / total) * 100 : 0,
          };
          
          totalEvaluations += total;
          totalPassed += passed;
        }
      }
      
      const overallPassRate = totalEvaluations > 0 ? (totalPassed / totalEvaluations) * 100 : 0;
      
      // Calculate score
      const runSuccessRate = (runsCompleted + runsFailed) > 0 
        ? (runsCompleted / (runsCompleted + runsFailed)) * 100 
        : 0;
      const score = Math.round(runSuccessRate * 0.3 + promotionRate * 0.3 + overallPassRate * 0.4);
      
      return {
        runsCompleted,
        runsFailed,
        ideasGenerated,
        ideasPromoted,
        promotionRate,
        gateStats: {
          byGate,
          overallPassRate,
          commonFailures: [],
        },
        score,
      };
    } catch (error) {
      console.error('[MetricsCalculator] Error calculating Lane A metrics:', error);
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

  // --------------------------------------------------------------------------
  // Lane B Metrics
  // --------------------------------------------------------------------------
  async calculateLaneBMetrics() {
    try {
      const laneBRuns = await runsRepository.getByType('lane_b_research', 100);
      const cutoffDate = new Date(this.startDate);
      const recentRuns = laneBRuns.filter(r => new Date(r.runDate) >= cutoffDate);
      
      const runsCompleted = recentRuns.filter(r => r.status === 'completed').length;
      const runsFailed = recentRuns.filter(r => r.status === 'failed').length;
      
      // Get packets stats using getRecentPackets
      const allPackets = await researchPacketsRepository.getRecentPackets(this.lookbackDays);
      const packetsGenerated = allPackets.length;
      // Research packets don't have a status field, they exist when complete
      const packetsCompleted = packetsGenerated;
      
      // Get agent stats from telemetry
      const telemetryAgentStats = await telemetry.getAgentStats(this.lookbackDays);
      
      const byAgent: Record<string, { total: number; success: number; avgLatency: number; avgQuality: number }> = {};
      let totalExecutions = 0;
      let totalSuccessful = 0;
      
      if (Array.isArray(telemetryAgentStats)) {
        for (const stat of telemetryAgentStats) {
          const agentName = stat.agent_name || 'unknown';
          const total = Number(stat.total_executions) || 0;
          const successful = Number(stat.successful) || 0;
          
          byAgent[agentName] = {
            total,
            success: successful,
            avgLatency: Number(stat.avg_latency) || 0,
            avgQuality: Number(stat.avg_quality) || 0,
          };
          
          totalExecutions += total;
          totalSuccessful += successful;
        }
      }
      
      const overallSuccessRate = totalExecutions > 0 ? (totalSuccessful / totalExecutions) * 100 : 0;
      
      // Calculate score
      const runSuccessRate = (runsCompleted + runsFailed) > 0 
        ? (runsCompleted / (runsCompleted + runsFailed)) * 100 
        : 0;
      const completionRate = packetsGenerated > 0 
        ? (packetsCompleted / packetsGenerated) * 100 
        : 0;
      const score = Math.round(runSuccessRate * 0.3 + completionRate * 0.3 + overallSuccessRate * 0.4);
      
      return {
        runsCompleted,
        runsFailed,
        packetsGenerated,
        packetsCompleted,
        agentStats: {
          byAgent,
          overallSuccessRate,
        },
        score,
      };
    } catch (error) {
      console.error('[MetricsCalculator] Error calculating Lane B metrics:', error);
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

  // --------------------------------------------------------------------------
  // Lane C Metrics
  // --------------------------------------------------------------------------
  async calculateLaneCMetrics() {
    try {
      const laneCRuns = await runsRepository.getByType('lane_c_memo', 100);
      const cutoffDate = new Date(this.startDate);
      const recentRuns = laneCRuns.filter(r => new Date(r.runDate) >= cutoffDate);
      
      // Get memos stats using getRecent
      const allMemos = await icMemosRepository.getRecent(this.lookbackDays);
      const memosGenerated = allMemos.length;
      const memosCompleted = allMemos.filter(m => m.status === 'complete').length;
      
      // Get supporting prompt stats from telemetry
      const telemetryPromptStats = await telemetry.getSupportingPromptStats(this.lookbackDays);
      
      const byPrompt: Record<string, { total: number; success: number; avgLatency: number; avgConfidence: number }> = {};
      let totalExecutions = 0;
      let totalSuccessful = 0;
      
      if (Array.isArray(telemetryPromptStats)) {
        for (const stat of telemetryPromptStats) {
          const promptName = stat.prompt_name || 'unknown';
          const total = Number(stat.total_executions) || 0;
          const successful = Number(stat.successful) || 0;
          
          byPrompt[promptName] = {
            total,
            success: successful,
            avgLatency: Number(stat.avg_latency) || 0,
            avgConfidence: Number(stat.avg_confidence) || 0,
          };
          
          totalExecutions += total;
          totalSuccessful += successful;
        }
      }
      
      const overallSuccessRate = totalExecutions > 0 ? (totalSuccessful / totalExecutions) * 100 : 0;
      
      // Calculate score
      const completionRate = memosGenerated > 0 
        ? (memosCompleted / memosGenerated) * 100 
        : 0;
      const score = Math.round(completionRate * 0.5 + overallSuccessRate * 0.5);
      
      return {
        memosGenerated,
        memosCompleted,
        supportingPromptStats: {
          byPrompt,
          overallSuccessRate,
        },
        score,
      };
    } catch (error) {
      console.error('[MetricsCalculator] Error calculating Lane C metrics:', error);
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

  // --------------------------------------------------------------------------
  // Infrastructure Metrics
  // --------------------------------------------------------------------------
  async calculateInfrastructureMetrics() {
    try {
      // Get data source health from telemetry
      const dataSourceStats = await telemetry.getDataSourceHealthStats(this.lookbackDays);
      
      const bySource: Record<string, { 
        total: number; 
        success: number; 
        avgLatency: number; 
        rateLimitHits: number;
        successRate: number;
      }> = {};
      let totalCalls = 0;
      let totalSuccessful = 0;
      
      if (Array.isArray(dataSourceStats)) {
        for (const stat of dataSourceStats) {
          const sourceName = stat.source_name || 'unknown';
          const total = Number(stat.total_calls) || 0;
          const successful = Number(stat.successful_calls) || 0;
          
          bySource[sourceName] = {
            total,
            success: successful,
            avgLatency: Number(stat.avg_latency) || 0,
            rateLimitHits: Number(stat.rate_limit_hits) || 0,
            successRate: total > 0 ? (successful / total) * 100 : 0,
          };
          
          totalCalls += total;
          totalSuccessful += successful;
        }
      }
      
      const dataSourceOverallHealth = totalCalls > 0 ? (totalSuccessful / totalCalls) * 100 : 100;
      
      // Get LLM health from telemetry
      const llmStats = await telemetry.getLLMStats(this.lookbackDays);
      
      const byProvider: Record<string, {
        total: number;
        success: number;
        avgLatency: number;
        totalTokens: number;
        fallbacks: number;
        successRate: number;
      }> = {};
      let llmTotalCalls = 0;
      let llmTotalSuccessful = 0;
      
      if (Array.isArray(llmStats)) {
        for (const stat of llmStats) {
          const provider = stat.provider || 'unknown';
          const total = Number(stat.total_calls) || 0;
          const successful = Number(stat.successful_calls) || 0;
          
          if (!byProvider[provider]) {
            byProvider[provider] = {
              total: 0,
              success: 0,
              avgLatency: 0,
              totalTokens: 0,
              fallbacks: 0,
              successRate: 0,
            };
          }
          
          byProvider[provider].total += total;
          byProvider[provider].success += successful;
          byProvider[provider].avgLatency = Number(stat.avg_latency) || 0;
          byProvider[provider].totalTokens += Number(stat.total_input_tokens) + Number(stat.total_output_tokens) || 0;
          byProvider[provider].fallbacks += Number(stat.fallbacks) || 0;
          byProvider[provider].successRate = byProvider[provider].total > 0 
            ? (byProvider[provider].success / byProvider[provider].total) * 100 
            : 0;
          
          llmTotalCalls += total;
          llmTotalSuccessful += successful;
        }
      }
      
      const llmOverallHealth = llmTotalCalls > 0 ? (llmTotalSuccessful / llmTotalCalls) * 100 : 100;
      
      // Calculate overall score
      const score = Math.round((dataSourceOverallHealth + llmOverallHealth) / 2);
      
      return {
        dataSourceHealth: {
          bySource,
          overallHealth: dataSourceOverallHealth,
        },
        llmHealth: {
          byProvider,
          overallHealth: llmOverallHealth,
        },
        score,
      };
    } catch (error) {
      console.error('[MetricsCalculator] Error calculating infrastructure metrics:', error);
      return {
        dataSourceHealth: {
          bySource: {},
          overallHealth: 100,
        },
        llmHealth: {
          byProvider: {},
          overallHealth: 100,
        },
        score: 100,
      };
    }
  }

  // --------------------------------------------------------------------------
  // Funnel Metrics
  // --------------------------------------------------------------------------
  async calculateFunnelMetrics() {
    try {
      // Get counts from each lane
      const lane0Stats = await telemetry.getLane0Stats(this.lookbackDays);
      let lane0Count = 0;
      if (Array.isArray(lane0Stats)) {
        for (const stat of lane0Stats) {
          lane0Count += Number(stat.total_ideas) || 0;
        }
      }
      
      const newIdeas = await ideasRepository.getByStatus('new');
      const promotedIdeas = await ideasRepository.getByStatus('promoted');
      const laneACount = newIdeas.length + promotedIdeas.length;
      
      const allPackets = await researchPacketsRepository.getRecentPackets(this.lookbackDays);
      const laneBCount = allPackets.length;
      
      const allMemos = await icMemosRepository.getRecent(this.lookbackDays);
      const laneCCount = allMemos.filter(m => m.status === 'complete').length;
      
      // Calculate conversion rates
      const lane0ToLaneA = lane0Count > 0 ? (laneACount / lane0Count) * 100 : 0;
      const laneAToLaneB = laneACount > 0 ? (laneBCount / laneACount) * 100 : 0;
      const laneBToLaneC = laneBCount > 0 ? (laneCCount / laneBCount) * 100 : 0;
      const overallConversion = lane0Count > 0 ? (laneCCount / lane0Count) * 100 : 0;
      
      // Identify bottlenecks
      const bottlenecks: string[] = [];
      if (lane0ToLaneA < 50) bottlenecks.push('Lane 0 → Lane A');
      if (laneAToLaneB < 30) bottlenecks.push('Lane A → Lane B');
      if (laneBToLaneC < 50) bottlenecks.push('Lane B → Lane C');
      
      // Calculate score
      const score = Math.round(
        (Math.min(100, lane0ToLaneA) * 0.2) +
        (Math.min(100, laneAToLaneB) * 0.4) +
        (Math.min(100, laneBToLaneC) * 0.4)
      );
      
      return {
        lane0ToLaneA,
        laneAToLaneB,
        laneBToLaneC,
        overallConversion,
        bottlenecks,
        score: Math.max(0, Math.min(100, score)),
      };
    } catch (error) {
      console.error('[MetricsCalculator] Error calculating funnel metrics:', error);
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

  // --------------------------------------------------------------------------
  // Historical Comparison
  // --------------------------------------------------------------------------
  async calculateHistoricalComparison() {
    try {
      // For now, return stable trends - will be enhanced when more data is available
      return {
        lane0Trend: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'stable' as const },
        laneATrend: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'stable' as const },
        laneBTrend: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'stable' as const },
        laneCTrend: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'stable' as const },
        overallTrend: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'stable' as const },
        weekOverWeek: [],
      };
    } catch (error) {
      console.error('[MetricsCalculator] Error calculating historical comparison:', error);
      return {
        lane0Trend: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'stable' as const },
        laneATrend: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'stable' as const },
        laneBTrend: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'stable' as const },
        laneCTrend: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'stable' as const },
        overallTrend: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'stable' as const },
        weekOverWeek: [],
      };
    }
  }
}

export default MetricsCalculator;
