/**
 * QA Framework v2.0 - Alert System
 * Phase 3: Implements alert generation, severity classification, and recommendations
 */

import type {
  Lane0Metrics,
  LaneAMetrics,
  LaneBMetrics,
  LaneCMetrics,
  InfrastructureMetrics,
  FunnelMetrics,
  HistoricalComparison,
} from './metrics-calculator.js';

// ============================================================================
// Types
// ============================================================================

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  category: string;
  subcategory?: string;
  message: string;
  recommendation: string;
  metric?: string;
  currentValue?: number;
  threshold?: number;
  trend?: 'improving' | 'stable' | 'declining';
  createdAt: Date;
}

export interface AlertThresholds {
  // Lane 0
  lane0MinIngestion: number;
  lane0MaxDuplicateRate: number;
  lane0MinSourceDiversity: number;
  
  // Lane A
  laneAMinPromotionRate: number;
  laneAMinGatePassRate: number;
  laneAMaxFailureRate: number;
  
  // Lane B
  laneBMinAgentSuccessRate: number;
  laneBMaxCompletionTime: number;
  laneBMinPacketsPerWeek: number;
  
  // Lane C
  laneCMinCompletionRate: number;
  laneCMinConvictionStdDev: number;
  laneCMinPromptSuccessRate: number;
  
  // Infrastructure
  infraMinDataSourceAvailability: number;
  infraMinLLMSuccessRate: number;
  infraMaxLLMLatency: number;
  
  // Funnel
  funnelMinConversionRate: number;
  funnelMinLaneAToB: number;
  funnelMinLaneBToC: number;
}

// Default thresholds
export const DEFAULT_THRESHOLDS: AlertThresholds = {
  // Lane 0
  lane0MinIngestion: 10,
  lane0MaxDuplicateRate: 30,
  lane0MinSourceDiversity: 2,
  
  // Lane A
  laneAMinPromotionRate: 10,
  laneAMinGatePassRate: 30,
  laneAMaxFailureRate: 20,
  
  // Lane B
  laneBMinAgentSuccessRate: 70,
  laneBMaxCompletionTime: 3600, // 1 hour in seconds
  laneBMinPacketsPerWeek: 3,
  
  // Lane C
  laneCMinCompletionRate: 70,
  laneCMinConvictionStdDev: 5,
  laneCMinPromptSuccessRate: 80,
  
  // Infrastructure
  infraMinDataSourceAvailability: 90,
  infraMinLLMSuccessRate: 90,
  infraMaxLLMLatency: 10000, // 10 seconds
  
  // Funnel
  funnelMinConversionRate: 1,
  funnelMinLaneAToB: 20,
  funnelMinLaneBToC: 50,
};

// ============================================================================
// Alert Generator Class
// ============================================================================

export class AlertGenerator {
  private thresholds: AlertThresholds;
  private alerts: Alert[] = [];

  constructor(thresholds: Partial<AlertThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addAlert(
    severity: AlertSeverity,
    category: string,
    message: string,
    recommendation: string,
    options: Partial<Alert> = {}
  ): void {
    this.alerts.push({
      id: this.generateId(),
      severity,
      category,
      message,
      recommendation,
      createdAt: new Date(),
      ...options,
    });
  }

  // --------------------------------------------------------------------------
  // Lane 0 Alerts
  // --------------------------------------------------------------------------

  generateLane0Alerts(metrics: Lane0Metrics): void {
    const category = 'Lane 0 - Ingestion';

    // Critical: No ingestion
    if (metrics.totalIngested === 0) {
      this.addAlert(
        'critical',
        category,
        'No ideas ingested this week',
        'Check Substack, Reddit, and FMP Screener integrations. Verify API keys and network connectivity.',
        { metric: 'totalIngested', currentValue: 0, threshold: this.thresholds.lane0MinIngestion }
      );
    } 
    // Warning: Low ingestion
    else if (metrics.totalIngested < this.thresholds.lane0MinIngestion) {
      this.addAlert(
        'warning',
        category,
        `Low ingestion volume: ${metrics.totalIngested} ideas`,
        'Review source configurations and consider adding new data sources.',
        { metric: 'totalIngested', currentValue: metrics.totalIngested, threshold: this.thresholds.lane0MinIngestion }
      );
    }

    // Warning: High duplicate rate
    if (metrics.duplicateRate > this.thresholds.lane0MaxDuplicateRate) {
      this.addAlert(
        'warning',
        category,
        `High duplicate rate: ${metrics.duplicateRate.toFixed(1)}%`,
        'Review deduplication logic and source overlap.',
        { metric: 'duplicateRate', currentValue: metrics.duplicateRate, threshold: this.thresholds.lane0MaxDuplicateRate }
      );
    }

    // Warning: Low source diversity
    if (metrics.sourceDiversity < this.thresholds.lane0MinSourceDiversity) {
      this.addAlert(
        'warning',
        category,
        `Low source diversity: ${metrics.sourceDiversity} sources`,
        'Enable additional data sources for better coverage.',
        { metric: 'sourceDiversity', currentValue: metrics.sourceDiversity, threshold: this.thresholds.lane0MinSourceDiversity }
      );
    }

    // Warning: High error rate
    if (metrics.errorRate > 10) {
      this.addAlert(
        'warning',
        category,
        `High ingestion error rate: ${metrics.errorRate.toFixed(1)}%`,
        'Review error logs and fix failing integrations.',
        { metric: 'errorRate', currentValue: metrics.errorRate, threshold: 10 }
      );
    }
  }

  // --------------------------------------------------------------------------
  // Lane A Alerts
  // --------------------------------------------------------------------------

  generateLaneAAlerts(metrics: LaneAMetrics): void {
    const category = 'Lane A - Discovery';

    // Critical: Zero gate pass rate
    if (metrics.gateStats.overallPassRate === 0 && metrics.ideasGenerated > 0) {
      this.addAlert(
        'critical',
        category,
        'Zero gate pass rate',
        'Review gate criteria and data quality. Consider relaxing thresholds if too strict.',
        { metric: 'overallPassRate', currentValue: 0, threshold: this.thresholds.laneAMinGatePassRate }
      );
    }
    // Warning: Low gate pass rate
    else if (metrics.gateStats.overallPassRate < this.thresholds.laneAMinGatePassRate) {
      this.addAlert(
        'warning',
        category,
        `Low gate pass rate: ${metrics.gateStats.overallPassRate.toFixed(1)}%`,
        'Review gate criteria and ensure data sources are providing complete information.',
        { metric: 'overallPassRate', currentValue: metrics.gateStats.overallPassRate, threshold: this.thresholds.laneAMinGatePassRate }
      );
    }

    // Warning: Low promotion rate
    if (metrics.promotionRate < this.thresholds.laneAMinPromotionRate && metrics.ideasGenerated > 0) {
      this.addAlert(
        'warning',
        category,
        `Low promotion rate: ${metrics.promotionRate.toFixed(1)}%`,
        'Review scoring criteria and promotion thresholds.',
        { metric: 'promotionRate', currentValue: metrics.promotionRate, threshold: this.thresholds.laneAMinPromotionRate }
      );
    }

    // Critical: High failure rate
    const totalRuns = metrics.runsCompleted + metrics.runsFailed;
    const failureRate = totalRuns > 0 ? (metrics.runsFailed / totalRuns) * 100 : 0;
    if (failureRate > this.thresholds.laneAMaxFailureRate) {
      this.addAlert(
        'critical',
        category,
        `High run failure rate: ${failureRate.toFixed(1)}%`,
        'Check system logs for errors. Review API connectivity and resource availability.',
        { metric: 'failureRate', currentValue: failureRate, threshold: this.thresholds.laneAMaxFailureRate }
      );
    }

    // Specific gate alerts
    for (const [gateId, gateMetrics] of Object.entries(metrics.gateStats.byGate)) {
      if (gateMetrics.passRate < 20 && gateMetrics.totalEvaluated > 5) {
        this.addAlert(
          'warning',
          category,
          `Gate "${gateMetrics.gateName}" has low pass rate: ${gateMetrics.passRate.toFixed(1)}%`,
          `Review criteria for ${gateMetrics.gateName}. Top failure reasons: ${
            gateMetrics.commonFailureReasons.slice(0, 2).map(r => r.reason).join(', ') || 'Unknown'
          }`,
          { subcategory: gateId, metric: 'gatePassRate', currentValue: gateMetrics.passRate, threshold: 20 }
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // Lane B Alerts
  // --------------------------------------------------------------------------

  generateLaneBAlerts(metrics: LaneBMetrics): void {
    const category = 'Lane B - Research';

    // Warning: Low agent success rate
    if (metrics.agentStats.overallSuccessRate < this.thresholds.laneBMinAgentSuccessRate && 
        Object.keys(metrics.agentStats.byAgent).length > 0) {
      this.addAlert(
        'warning',
        category,
        `Low agent success rate: ${metrics.agentStats.overallSuccessRate.toFixed(1)}%`,
        'Review agent prompts and error handling. Check LLM availability.',
        { metric: 'agentSuccessRate', currentValue: metrics.agentStats.overallSuccessRate, threshold: this.thresholds.laneBMinAgentSuccessRate }
      );
    }

    // Warning: Slow completion time
    if (metrics.avgCompletionTime > this.thresholds.laneBMaxCompletionTime && metrics.packetsCompleted > 0) {
      this.addAlert(
        'warning',
        category,
        `Slow research completion: ${(metrics.avgCompletionTime / 60).toFixed(1)} minutes average`,
        'Consider optimizing agent prompts or increasing parallelization.',
        { metric: 'avgCompletionTime', currentValue: metrics.avgCompletionTime, threshold: this.thresholds.laneBMaxCompletionTime }
      );
    }

    // Warning: Low packet volume
    if (metrics.packetsCompleted < this.thresholds.laneBMinPacketsPerWeek) {
      this.addAlert(
        'warning',
        category,
        `Low research output: ${metrics.packetsCompleted} packets this week`,
        'Review Lane A promotion rate and Lane B execution frequency.',
        { metric: 'packetsCompleted', currentValue: metrics.packetsCompleted, threshold: this.thresholds.laneBMinPacketsPerWeek }
      );
    }

    // Specific agent alerts
    for (const [agentId, agentMetrics] of Object.entries(metrics.agentStats.byAgent)) {
      if (agentMetrics.successRate < 50 && agentMetrics.totalExecutions > 3) {
        this.addAlert(
          'warning',
          category,
          `Agent "${agentMetrics.agentName}" has low success rate: ${agentMetrics.successRate.toFixed(1)}%`,
          `Review prompt for ${agentMetrics.agentName}. Check for data availability issues.`,
          { subcategory: agentId, metric: 'agentSuccessRate', currentValue: agentMetrics.successRate, threshold: 50 }
        );
      }
    }

    // Info: Conviction distribution skew
    const totalConviction = metrics.convictionDistribution.high + 
                           metrics.convictionDistribution.medium + 
                           metrics.convictionDistribution.low;
    if (totalConviction > 0) {
      const highPercent = (metrics.convictionDistribution.high / totalConviction) * 100;
      const lowPercent = (metrics.convictionDistribution.low / totalConviction) * 100;
      
      if (highPercent > 80) {
        this.addAlert(
          'info',
          category,
          `High conviction skew: ${highPercent.toFixed(0)}% of packets have high conviction`,
          'This may indicate overly optimistic analysis. Consider reviewing synthesis criteria.',
          { metric: 'convictionDistribution', currentValue: highPercent }
        );
      } else if (lowPercent > 80) {
        this.addAlert(
          'info',
          category,
          `Low conviction skew: ${lowPercent.toFixed(0)}% of packets have low conviction`,
          'This may indicate overly pessimistic analysis or data quality issues.',
          { metric: 'convictionDistribution', currentValue: lowPercent }
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // Lane C Alerts
  // --------------------------------------------------------------------------

  generateLaneCAlerts(metrics: LaneCMetrics): void {
    const category = 'Lane C - IC Memo';

    // Warning: Low completion rate
    const completionRate = metrics.memosGenerated > 0 
      ? (metrics.memosCompleted / metrics.memosGenerated) * 100 
      : 0;
    if (completionRate < this.thresholds.laneCMinCompletionRate && metrics.memosGenerated > 0) {
      this.addAlert(
        'warning',
        category,
        `Low IC Memo completion rate: ${completionRate.toFixed(1)}%`,
        'Review Lane C execution logs for errors. Check LLM availability.',
        { metric: 'completionRate', currentValue: completionRate, threshold: this.thresholds.laneCMinCompletionRate }
      );
    }

    // Warning: Uniform conviction (low std dev)
    if (metrics.convictionStdDev < this.thresholds.laneCMinConvictionStdDev && metrics.memosCompleted > 2) {
      this.addAlert(
        'warning',
        category,
        `Uniform conviction scores: std dev = ${metrics.convictionStdDev.toFixed(1)}`,
        'IC Memos should have varied conviction scores. Review conviction calculation logic.',
        { metric: 'convictionStdDev', currentValue: metrics.convictionStdDev, threshold: this.thresholds.laneCMinConvictionStdDev }
      );
    }

    // Warning: Low supporting prompt success rate
    if (metrics.supportingPromptStats.overallSuccessRate < this.thresholds.laneCMinPromptSuccessRate &&
        Object.keys(metrics.supportingPromptStats.byPrompt).length > 0) {
      this.addAlert(
        'warning',
        category,
        `Low supporting prompt success rate: ${metrics.supportingPromptStats.overallSuccessRate.toFixed(1)}%`,
        'Review supporting prompt configurations and LLM settings.',
        { metric: 'promptSuccessRate', currentValue: metrics.supportingPromptStats.overallSuccessRate, threshold: this.thresholds.laneCMinPromptSuccessRate }
      );
    }

    // Specific prompt alerts
    for (const [promptId, promptMetrics] of Object.entries(metrics.supportingPromptStats.byPrompt)) {
      if (promptMetrics.successRate < 50 && promptMetrics.totalExecutions > 3) {
        this.addAlert(
          'warning',
          category,
          `Prompt "${promptMetrics.promptName}" has low success rate: ${promptMetrics.successRate.toFixed(1)}%`,
          `Review configuration for ${promptMetrics.promptName}.`,
          { subcategory: promptId, metric: 'promptSuccessRate', currentValue: promptMetrics.successRate, threshold: 50 }
        );
      }
    }

    // Info: Recommendation distribution
    const totalRecs = Object.values(metrics.recommendationDistribution).reduce((a, b) => a + b, 0);
    if (totalRecs > 0) {
      const buyPercent = ((metrics.recommendationDistribution.buy || 0) + 
                         (metrics.recommendationDistribution.strong_buy || 0)) / totalRecs * 100;
      const sellPercent = ((metrics.recommendationDistribution.sell || 0) + 
                          (metrics.recommendationDistribution.strong_sell || 0)) / totalRecs * 100;
      
      if (buyPercent > 90) {
        this.addAlert(
          'info',
          category,
          `High buy recommendation rate: ${buyPercent.toFixed(0)}%`,
          'Consider if the analysis is appropriately critical.',
          { metric: 'recommendationDistribution', currentValue: buyPercent }
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // Infrastructure Alerts
  // --------------------------------------------------------------------------

  generateInfrastructureAlerts(metrics: InfrastructureMetrics): void {
    const category = 'Infrastructure';

    // Critical: Low data source availability
    if (metrics.dataSourceHealth.overallAvailability < this.thresholds.infraMinDataSourceAvailability) {
      this.addAlert(
        'critical',
        category,
        `Low data source availability: ${metrics.dataSourceHealth.overallAvailability.toFixed(1)}%`,
        'Check API keys, rate limits, and network connectivity for data sources.',
        { subcategory: 'Data Sources', metric: 'availability', currentValue: metrics.dataSourceHealth.overallAvailability, threshold: this.thresholds.infraMinDataSourceAvailability }
      );
    }

    // Specific data source alerts
    for (const [source, health] of Object.entries(metrics.dataSourceHealth.bySource)) {
      if (health.availability < 80 && health.totalCalls > 5) {
        this.addAlert(
          'warning',
          category,
          `Data source "${source}" has low availability: ${health.availability.toFixed(1)}%`,
          `Check ${source} API status and credentials.`,
          { subcategory: source, metric: 'availability', currentValue: health.availability, threshold: 80 }
        );
      }
    }

    // Critical: Low LLM success rate
    if (metrics.llmPerformance.overallSuccessRate < this.thresholds.infraMinLLMSuccessRate) {
      this.addAlert(
        'critical',
        category,
        `Low LLM success rate: ${metrics.llmPerformance.overallSuccessRate.toFixed(1)}%`,
        'Check LLM provider status, API keys, and rate limits.',
        { subcategory: 'LLM', metric: 'successRate', currentValue: metrics.llmPerformance.overallSuccessRate, threshold: this.thresholds.infraMinLLMSuccessRate }
      );
    }

    // Warning: High LLM latency
    for (const [provider, perf] of Object.entries(metrics.llmPerformance.byProvider)) {
      if (perf.avgLatencyMs > this.thresholds.infraMaxLLMLatency && perf.totalCalls > 5) {
        this.addAlert(
          'warning',
          category,
          `High LLM latency for ${provider}: ${(perf.avgLatencyMs / 1000).toFixed(1)}s average`,
          'Consider using a faster model or optimizing prompts.',
          { subcategory: provider, metric: 'latency', currentValue: perf.avgLatencyMs, threshold: this.thresholds.infraMaxLLMLatency }
        );
      }
    }

    // Info: High token usage
    if (metrics.llmPerformance.totalTokensUsed > 1000000) {
      this.addAlert(
        'info',
        category,
        `High token usage this week: ${(metrics.llmPerformance.totalTokensUsed / 1000000).toFixed(2)}M tokens`,
        'Monitor costs and consider prompt optimization.',
        { subcategory: 'LLM', metric: 'tokenUsage', currentValue: metrics.llmPerformance.totalTokensUsed }
      );
    }
  }

  // --------------------------------------------------------------------------
  // Funnel Alerts
  // --------------------------------------------------------------------------

  generateFunnelAlerts(metrics: FunnelMetrics): void {
    const category = 'Funnel';

    // Warning: Low Lane A to B conversion
    if (metrics.laneAToLaneB < this.thresholds.funnelMinLaneAToB && metrics.laneAToLaneB > 0) {
      this.addAlert(
        'warning',
        category,
        `Low Lane A → B conversion: ${metrics.laneAToLaneB.toFixed(1)}%`,
        'Review promotion criteria and Lane B execution frequency.',
        { metric: 'laneAToLaneB', currentValue: metrics.laneAToLaneB, threshold: this.thresholds.funnelMinLaneAToB }
      );
    }

    // Warning: Low Lane B to C conversion
    if (metrics.laneBToLaneC < this.thresholds.funnelMinLaneBToC && metrics.laneBToLaneC > 0) {
      this.addAlert(
        'warning',
        category,
        `Low Lane B → C conversion: ${metrics.laneBToLaneC.toFixed(1)}%`,
        'Review IC Memo approval process and Lane C execution.',
        { metric: 'laneBToLaneC', currentValue: metrics.laneBToLaneC, threshold: this.thresholds.funnelMinLaneBToC }
      );
    }

    // Info: Overall conversion
    if (metrics.overallConversion < this.thresholds.funnelMinConversionRate) {
      this.addAlert(
        'info',
        category,
        `Low overall conversion: ${metrics.overallConversion.toFixed(2)}%`,
        'This is normal for a selective investment process.',
        { metric: 'overallConversion', currentValue: metrics.overallConversion, threshold: this.thresholds.funnelMinConversionRate }
      );
    }

    // Add bottleneck alerts
    for (const bottleneck of metrics.bottlenecks) {
      this.addAlert(
        'warning',
        category,
        `Bottleneck at ${bottleneck.stage}: ${bottleneck.dropoffRate.toFixed(1)}% drop-off`,
        bottleneck.recommendation,
        { subcategory: bottleneck.stage, metric: 'dropoffRate', currentValue: bottleneck.dropoffRate }
      );
    }
  }

  // --------------------------------------------------------------------------
  // Trend Alerts
  // --------------------------------------------------------------------------

  generateTrendAlerts(trends: HistoricalComparison): void {
    const category = 'Trends';

    // Alert on significant declines
    const trendChecks = [
      { name: 'Lane 0', trend: trends.lane0Trend },
      { name: 'Lane A', trend: trends.laneATrend },
      { name: 'Lane B', trend: trends.laneBTrend },
      { name: 'Lane C', trend: trends.laneCTrend },
      { name: 'Overall', trend: trends.overallTrend },
    ];

    for (const check of trendChecks) {
      if (check.trend.trend === 'declining' && check.trend.changePercent < -20) {
        this.addAlert(
          'warning',
          category,
          `${check.name} score declining: ${check.trend.changePercent.toFixed(1)}% week-over-week`,
          `Investigate ${check.name} metrics for root cause.`,
          { subcategory: check.name, metric: 'trend', currentValue: check.trend.current, trend: check.trend.trend }
        );
      }
    }

    // Info on significant improvements
    for (const check of trendChecks) {
      if (check.trend.trend === 'improving' && check.trend.changePercent > 20) {
        this.addAlert(
          'info',
          category,
          `${check.name} score improving: +${check.trend.changePercent.toFixed(1)}% week-over-week`,
          'Good progress! Continue monitoring.',
          { subcategory: check.name, metric: 'trend', currentValue: check.trend.current, trend: check.trend.trend }
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // Main Generation Method
  // --------------------------------------------------------------------------

  generateAllAlerts(
    lane0Metrics: Lane0Metrics,
    laneAMetrics: LaneAMetrics,
    laneBMetrics: LaneBMetrics,
    laneCMetrics: LaneCMetrics,
    infrastructureMetrics: InfrastructureMetrics,
    funnelMetrics: FunnelMetrics,
    trends: HistoricalComparison
  ): Alert[] {
    this.alerts = []; // Reset alerts

    this.generateLane0Alerts(lane0Metrics);
    this.generateLaneAAlerts(laneAMetrics);
    this.generateLaneBAlerts(laneBMetrics);
    this.generateLaneCAlerts(laneCMetrics);
    this.generateInfrastructureAlerts(infrastructureMetrics);
    this.generateFunnelAlerts(funnelMetrics);
    this.generateTrendAlerts(trends);

    // Sort by severity
    const severityOrder: Record<AlertSeverity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };

    this.alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return this.alerts;
  }

  getAlerts(): Alert[] {
    return this.alerts;
  }

  getCriticalAlerts(): Alert[] {
    return this.alerts.filter(a => a.severity === 'critical');
  }

  getWarningAlerts(): Alert[] {
    return this.alerts.filter(a => a.severity === 'warning');
  }

  getInfoAlerts(): Alert[] {
    return this.alerts.filter(a => a.severity === 'info');
  }

  getAlertsByCategory(category: string): Alert[] {
    return this.alerts.filter(a => a.category === category);
  }

  getSummary(): { total: number; critical: number; warning: number; info: number } {
    return {
      total: this.alerts.length,
      critical: this.getCriticalAlerts().length,
      warning: this.getWarningAlerts().length,
      info: this.getInfoAlerts().length,
    };
  }
}

export default AlertGenerator;
