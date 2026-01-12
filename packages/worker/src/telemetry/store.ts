/**
 * ARC Investment Factory - Telemetry Store
 * 
 * Persists execution telemetry for every prompt run.
 * Provides querying and aggregation capabilities for monitoring.
 */

import { type TelemetryRecord, type ExecutionStatus } from '../prompts/types.js';

// ============================================================================
// TELEMETRY STORE
// ============================================================================

export class TelemetryStore {
  private records: TelemetryRecord[] = [];
  private maxRecords: number;
  private logToConsole: boolean;

  constructor(config?: { maxRecords?: number; logToConsole?: boolean }) {
    this.maxRecords = config?.maxRecords || 10000;
    this.logToConsole = config?.logToConsole ?? true;
  }

  /**
   * Record a prompt execution
   */
  async record(telemetry: Omit<TelemetryRecord, 'id'>): Promise<string> {
    const id = this.generateId();
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
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.records.length;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `tel_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let storeInstance: TelemetryStore | null = null;

export function getTelemetryStore(config?: { maxRecords?: number; logToConsole?: boolean }): TelemetryStore {
  if (!storeInstance) {
    storeInstance = new TelemetryStore(config);
  }
  return storeInstance;
}

export function resetTelemetryStore(): void {
  storeInstance = null;
}
