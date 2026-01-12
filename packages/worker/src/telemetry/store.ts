/**
 * ARC Investment Factory - Telemetry Store
 * 
 * Persists execution telemetry for every prompt run.
 * Provides querying and aggregation capabilities for monitoring.
 * 
 * Includes lane_outcome tracking for measuring pipeline quality.
 */

import { type TelemetryRecord, type ExecutionStatus, type Lane } from '../prompts/types.js';

// ============================================================================
// TYPES
// ============================================================================

export type LaneOutcome = 
  | 'idea_generated'      // Lane A: Successfully generated an investment idea
  | 'idea_rejected'       // Lane A: Idea rejected by gates
  | 'research_complete'   // Lane B: Full research completed
  | 'research_partial'    // Lane B: Partial research (budget/time constraints)
  | 'research_failed'     // Lane B: Research failed
  | 'monitoring_updated'  // Monitoring: Position updated
  | 'no_action';          // No actionable outcome

export interface LaneOutcomeRecord {
  id: string;
  run_id: string;
  lane: Lane;
  outcome: LaneOutcome;
  ticker: string;
  idea_id?: string;
  prompts_executed: number;
  prompts_succeeded: number;
  prompts_failed: number;
  total_cost: number;
  total_latency_ms: number;
  quality_score?: number;  // 0-100 based on gate pass rates
  created_at: Date;
  metadata?: Record<string, unknown>;
}

export interface QualityMetrics {
  overall_quality_score: number;  // 0-100
  gate_pass_rate: number;         // 0-1
  validation_pass_rate: number;   // 0-1
  data_sufficiency_rate: number;  // 0-1
  coherence_rate: number;         // 0-1
  edge_claim_rate: number;        // 0-1
  style_fit_rate: number;         // 0-1
}

// ============================================================================
// TELEMETRY STORE
// ============================================================================

export class TelemetryStore {
  private records: TelemetryRecord[] = [];
  private laneOutcomes: LaneOutcomeRecord[] = [];
  private maxRecords: number;
  private maxOutcomes: number;
  private logToConsole: boolean;

  constructor(config?: { maxRecords?: number; maxOutcomes?: number; logToConsole?: boolean }) {
    this.maxRecords = config?.maxRecords || 10000;
    this.maxOutcomes = config?.maxOutcomes || 1000;
    this.logToConsole = config?.logToConsole ?? true;
  }

  /**
   * Record a prompt execution
   */
  async record(telemetry: Omit<TelemetryRecord, 'id'>): Promise<string> {
    const id = this.generateId('tel');
    const fullRecord: TelemetryRecord = {
      ...telemetry,
      id,
    };

    this.records.push(fullRecord);

    // Trim old records if exceeding max
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }

    // Log to console if enabled
    if (this.logToConsole) {
      this.logRecord(fullRecord);
    }

    return id;
  }

  /**
   * Record a lane outcome (pipeline-level result)
   */
  async recordLaneOutcome(outcome: Omit<LaneOutcomeRecord, 'id' | 'created_at'>): Promise<string> {
    const id = this.generateId('out');
    const fullOutcome: LaneOutcomeRecord = {
      ...outcome,
      id,
      created_at: new Date(),
    };

    this.laneOutcomes.push(fullOutcome);

    // Trim old outcomes if exceeding max
    if (this.laneOutcomes.length > this.maxOutcomes) {
      this.laneOutcomes = this.laneOutcomes.slice(-this.maxOutcomes);
    }

    // Log to console if enabled
    if (this.logToConsole) {
      this.logOutcome(fullOutcome);
    }

    return id;
  }

  /**
   * Log a record to console in a structured format
   */
  private logRecord(record: TelemetryRecord): void {
    const status = record.status.toUpperCase();
    const cached = record.cache_hit ? ' [CACHED]' : '';
    const cost = record.cost_estimate ? ` $${record.cost_estimate.toFixed(4)}` : '';
    const tokens = record.tokens_in && record.tokens_out
      ? ` (${record.tokens_in}→${record.tokens_out} tokens)`
      : '';

    console.log(
      `[Telemetry] ${status}${cached} | ` +
      `${record.prompt_id}@${record.prompt_version} | ` +
      `${record.lane}/${record.stage} | ` +
      `${record.latency_ms}ms${cost}${tokens}`
    );

    if (record.status === 'failed' || record.status === 'quarantined') {
      if (record.validation_errors && record.validation_errors.length > 0) {
        console.log(`  Errors: ${record.validation_errors.join('; ')}`);
      }
      if (record.sources_failed && record.sources_failed.length > 0) {
        console.log(`  Failed sources: ${record.sources_failed.map((s: { source: string }) => s.source).join(', ')}`);
      }
    }
  }

  /**
   * Log a lane outcome to console
   */
  private logOutcome(outcome: LaneOutcomeRecord): void {
    const qualityStr = outcome.quality_score !== undefined 
      ? ` | Quality: ${outcome.quality_score}%` 
      : '';
    
    console.log(
      `[LaneOutcome] ${outcome.outcome.toUpperCase()} | ` +
      `${outcome.lane} | ${outcome.ticker} | ` +
      `${outcome.prompts_succeeded}/${outcome.prompts_executed} prompts | ` +
      `$${outcome.total_cost.toFixed(4)} | ${outcome.total_latency_ms}ms${qualityStr}`
    );
  }

  /**
   * Get a record by ID
   */
  async getById(id: string): Promise<TelemetryRecord | null> {
    return this.records.find((r) => r.id === id) || null;
  }

  /**
   * Get records by run ID
   */
  async getByRunId(runId: string): Promise<TelemetryRecord[]> {
    return this.records.filter((r) => r.run_id === runId);
  }

  /**
   * Get records by prompt ID
   */
  async getByPromptId(promptId: string): Promise<TelemetryRecord[]> {
    return this.records.filter((r) => r.prompt_id === promptId);
  }

  /**
   * Get records by status
   */
  async getByStatus(status: ExecutionStatus): Promise<TelemetryRecord[]> {
    return this.records.filter((r) => r.status === status);
  }

  /**
   * Get records within a time range
   */
  async getByTimeRange(start: Date, end: Date): Promise<TelemetryRecord[]> {
    return this.records.filter(
      (r) => r.start_ts >= start && r.start_ts <= end
    );
  }

  /**
   * Get recent records
   */
  async getRecent(limit: number = 100): Promise<TelemetryRecord[]> {
    return this.records.slice(-limit).reverse();
  }

  /**
   * Get lane outcomes by lane
   */
  async getLaneOutcomes(lane?: Lane, limit: number = 100): Promise<LaneOutcomeRecord[]> {
    let outcomes = lane 
      ? this.laneOutcomes.filter((o) => o.lane === lane)
      : this.laneOutcomes;
    
    return outcomes.slice(-limit).reverse();
  }

  /**
   * Get lane outcome statistics
   */
  async getLaneOutcomeStats(timeRangeHours: number = 24): Promise<{
    total: number;
    byLane: Record<string, number>;
    byOutcome: Record<LaneOutcome, number>;
    avgQualityScore: number;
    avgCostPerOutcome: number;
    ideasGenerated: number;
    researchCompleted: number;
  }> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - timeRangeHours * 60 * 60 * 1000);
    
    const recentOutcomes = this.laneOutcomes.filter((o) => o.created_at >= cutoff);

    const stats = {
      total: recentOutcomes.length,
      byLane: {} as Record<string, number>,
      byOutcome: {} as Record<LaneOutcome, number>,
      avgQualityScore: 0,
      avgCostPerOutcome: 0,
      ideasGenerated: 0,
      researchCompleted: 0,
    };

    if (recentOutcomes.length === 0) {
      return stats;
    }

    let totalQuality = 0;
    let qualityCount = 0;
    let totalCost = 0;

    for (const outcome of recentOutcomes) {
      // By lane
      stats.byLane[outcome.lane] = (stats.byLane[outcome.lane] || 0) + 1;

      // By outcome type
      stats.byOutcome[outcome.outcome] = (stats.byOutcome[outcome.outcome] || 0) + 1;

      // Quality score
      if (outcome.quality_score !== undefined) {
        totalQuality += outcome.quality_score;
        qualityCount++;
      }

      // Cost
      totalCost += outcome.total_cost;

      // Specific counts
      if (outcome.outcome === 'idea_generated') stats.ideasGenerated++;
      if (outcome.outcome === 'research_complete') stats.researchCompleted++;
    }

    stats.avgQualityScore = qualityCount > 0 ? totalQuality / qualityCount : 0;
    stats.avgCostPerOutcome = totalCost / recentOutcomes.length;

    return stats;
  }

  /**
   * Calculate quality metrics from gate results
   */
  async getQualityMetrics(timeRangeHours: number = 24): Promise<QualityMetrics> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - timeRangeHours * 60 * 60 * 1000);
    
    const recentRecords = this.records.filter((r) => r.start_ts >= cutoff);

    const metrics: QualityMetrics = {
      overall_quality_score: 0,
      gate_pass_rate: 0,
      validation_pass_rate: 0,
      data_sufficiency_rate: 0,
      coherence_rate: 0,
      edge_claim_rate: 0,
      style_fit_rate: 0,
    };

    if (recentRecords.length === 0) {
      return metrics;
    }

    // Calculate validation pass rate
    const validationPasses = recentRecords.filter((r) => r.validation_pass).length;
    metrics.validation_pass_rate = validationPasses / recentRecords.length;

    // Calculate gate-specific pass rates
    const gateRecords = recentRecords.filter((r) => r.stage === 'gate' || r.prompt_id.includes('gate'));
    if (gateRecords.length > 0) {
      const gatePasses = gateRecords.filter((r) => r.status === 'success').length;
      metrics.gate_pass_rate = gatePasses / gateRecords.length;

      // Specific gates
      const dataSufficiency = gateRecords.filter((r) => r.prompt_id.includes('data_sufficiency'));
      if (dataSufficiency.length > 0) {
        metrics.data_sufficiency_rate = dataSufficiency.filter((r) => r.status === 'success').length / dataSufficiency.length;
      }

      const coherence = gateRecords.filter((r) => r.prompt_id.includes('coherence'));
      if (coherence.length > 0) {
        metrics.coherence_rate = coherence.filter((r) => r.status === 'success').length / coherence.length;
      }

      const edgeClaim = gateRecords.filter((r) => r.prompt_id.includes('edge_claim'));
      if (edgeClaim.length > 0) {
        metrics.edge_claim_rate = edgeClaim.filter((r) => r.status === 'success').length / edgeClaim.length;
      }

      const styleFit = gateRecords.filter((r) => r.prompt_id.includes('style_fit'));
      if (styleFit.length > 0) {
        metrics.style_fit_rate = styleFit.filter((r) => r.status === 'success').length / styleFit.length;
      }
    }

    // Calculate overall quality score (weighted average)
    metrics.overall_quality_score = Math.round(
      (metrics.validation_pass_rate * 30 +
       metrics.gate_pass_rate * 40 +
       metrics.data_sufficiency_rate * 10 +
       metrics.coherence_rate * 10 +
       metrics.edge_claim_rate * 5 +
       metrics.style_fit_rate * 5)
    );

    return metrics;
  }

  /**
   * Get aggregated statistics
   */
  async getStats(timeRangeHours: number = 24): Promise<{
    total: number;
    byStatus: Record<ExecutionStatus, number>;
    byLane: Record<string, number>;
    byPromptId: Record<string, number>;
    cacheHitRate: number;
    avgLatencyMs: number;
    totalCost: number;
    totalTokensIn: number;
    totalTokensOut: number;
    failureRate: number;
    qualityMetrics: QualityMetrics;
    laneOutcomeStats: {
      total: number;
      byLane: Record<string, number>;
      byOutcome: Record<LaneOutcome, number>;
      avgQualityScore: number;
      avgCostPerOutcome: number;
      ideasGenerated: number;
      researchCompleted: number;
    };
  }> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - timeRangeHours * 60 * 60 * 1000);
    
    const recentRecords = this.records.filter((r) => r.start_ts >= cutoff);

    const stats = {
      total: recentRecords.length,
      byStatus: {} as Record<ExecutionStatus, number>,
      byLane: {} as Record<string, number>,
      byPromptId: {} as Record<string, number>,
      cacheHitRate: 0,
      avgLatencyMs: 0,
      totalCost: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      failureRate: 0,
      qualityMetrics: await this.getQualityMetrics(timeRangeHours),
      laneOutcomeStats: await this.getLaneOutcomeStats(timeRangeHours),
    };

    if (recentRecords.length === 0) {
      return stats;
    }

    let cacheHits = 0;
    let totalLatency = 0;
    let failures = 0;

    for (const record of recentRecords) {
      // By status
      stats.byStatus[record.status] = (stats.byStatus[record.status] || 0) + 1;

      // By lane
      stats.byLane[record.lane] = (stats.byLane[record.lane] || 0) + 1;

      // By prompt ID
      stats.byPromptId[record.prompt_id] = (stats.byPromptId[record.prompt_id] || 0) + 1;

      // Cache hits
      if (record.cache_hit) cacheHits++;

      // Latency
      if (record.latency_ms) totalLatency += record.latency_ms;

      // Cost
      if (record.cost_estimate) stats.totalCost += record.cost_estimate;

      // Tokens
      if (record.tokens_in) stats.totalTokensIn += record.tokens_in;
      if (record.tokens_out) stats.totalTokensOut += record.tokens_out;

      // Failures
      if (record.status === 'failed' || record.status === 'quarantined') {
        failures++;
      }
    }

    stats.cacheHitRate = cacheHits / recentRecords.length;
    stats.avgLatencyMs = totalLatency / recentRecords.length;
    stats.failureRate = failures / recentRecords.length;

    return stats;
  }

  /**
   * Get run summary
   */
  async getRunSummary(runId: string): Promise<{
    runId: string;
    promptsExecuted: number;
    promptsSucceeded: number;
    promptsFailed: number;
    promptsSkipped: number;
    promptsQuarantined: number;
    totalLatencyMs: number;
    totalCost: number;
    cacheHits: number;
    startTime?: Date;
    endTime?: Date;
  }> {
    const runRecords = await this.getByRunId(runId);

    const summary = {
      runId,
      promptsExecuted: runRecords.length,
      promptsSucceeded: 0,
      promptsFailed: 0,
      promptsSkipped: 0,
      promptsQuarantined: 0,
      totalLatencyMs: 0,
      totalCost: 0,
      cacheHits: 0,
      startTime: undefined as Date | undefined,
      endTime: undefined as Date | undefined,
    };

    for (const record of runRecords) {
      switch (record.status) {
        case 'success':
          summary.promptsSucceeded++;
          break;
        case 'failed':
          summary.promptsFailed++;
          break;
        case 'skipped':
          summary.promptsSkipped++;
          break;
        case 'quarantined':
          summary.promptsQuarantined++;
          break;
      }

      if (record.latency_ms) summary.totalLatencyMs += record.latency_ms;
      if (record.cost_estimate) summary.totalCost += record.cost_estimate;
      if (record.cache_hit) summary.cacheHits++;

      if (!summary.startTime || record.start_ts < summary.startTime) {
        summary.startTime = record.start_ts;
      }
      if (record.end_ts && (!summary.endTime || record.end_ts > summary.endTime)) {
        summary.endTime = record.end_ts;
      }
    }

    return summary;
  }

  /**
   * Export records to JSONL format
   */
  async exportJsonl(runId?: string): Promise<string> {
    const records = runId
      ? await this.getByRunId(runId)
      : this.records;

    return records
      .map((r) => JSON.stringify(r))
      .join('\n');
  }

  /**
   * Clear all records
   */
  async clear(): Promise<void> {
    this.records = [];
    this.laneOutcomes = [];
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.records.length;
  }

  /**
   * Get outcome count
   */
  getOutcomeCount(): number {
    return this.laneOutcomes.length;
  }

  /**
   * Generate a unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let storeInstance: TelemetryStore | null = null;

export function getTelemetryStore(config?: { maxRecords?: number; maxOutcomes?: number; logToConsole?: boolean }): TelemetryStore {
  if (!storeInstance) {
    storeInstance = new TelemetryStore(config);
  }
  return storeInstance;
}

export function resetTelemetryStore(): void {
  storeInstance = null;
}
