/**
 * Telemetry Store - Legacy compatibility layer
 * 
 * This module provides a simple in-memory telemetry store for prompt execution tracking.
 * For the new QA Framework v2.0, use the telemetry module from @arc/database instead.
 */

export interface TelemetryEntry {
  promptId: string;
  promptName: string;
  startTime: Date;
  endTime?: Date;
  success: boolean;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface TelemetryRecord {
  run_id: string;
  pipeline_id?: string;
  lane?: string;
  stage?: string;
  prompt_id: string;
  prompt_version?: string;
  executor_type?: string;
  model_name?: string;
  temperature?: number;
  max_tokens?: number;
  input_hash?: string;
  cache_hit?: boolean;
  sources_requested?: string[];
  sources_succeeded?: string[];
  sources_failed?: Array<string | { source: string; reason: string }>;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  success?: boolean;
  error_type?: string;
  error_message?: string;
  retry_count?: number;
  fallback_used?: boolean;
  output_quality_score?: number;
  [key: string]: any;
}

export interface TelemetryStore {
  record(data: TelemetryRecord): Promise<void>;
  recordStart(promptId: string, promptName: string): void;
  recordEnd(promptId: string, success: boolean, latencyMs: number, tokens?: { input: number; output: number }, error?: string): void;
  getEntries(): TelemetryEntry[];
  getEntriesByPrompt(promptName: string): TelemetryEntry[];
  getStats(): {
    totalExecutions: number;
    successRate: number;
    avgLatencyMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  };
  clear(): void;
}

class InMemoryTelemetryStore implements TelemetryStore {
  private entries: Map<string, TelemetryEntry> = new Map();
  private completedEntries: TelemetryEntry[] = [];
  private records: TelemetryRecord[] = [];

  async record(data: TelemetryRecord): Promise<void> {
    this.records.push(data);
    // Also add to completed entries for stats
    this.completedEntries.push({
      promptId: data.prompt_id,
      promptName: data.prompt_id,
      startTime: new Date(),
      endTime: new Date(),
      success: data.success ?? true,
      latencyMs: data.latency_ms,
      inputTokens: data.input_tokens,
      outputTokens: data.output_tokens,
      error: data.error_message,
    });
  }

  recordStart(promptId: string, promptName: string): void {
    this.entries.set(promptId, {
      promptId,
      promptName,
      startTime: new Date(),
      success: false,
    });
  }

  recordEnd(
    promptId: string, 
    success: boolean, 
    latencyMs: number, 
    tokens?: { input: number; output: number }, 
    error?: string
  ): void {
    const entry = this.entries.get(promptId);
    if (entry) {
      entry.endTime = new Date();
      entry.success = success;
      entry.latencyMs = latencyMs;
      entry.inputTokens = tokens?.input;
      entry.outputTokens = tokens?.output;
      entry.error = error;
      this.completedEntries.push(entry);
      this.entries.delete(promptId);
    }
  }

  getEntries(): TelemetryEntry[] {
    return [...this.completedEntries];
  }

  getEntriesByPrompt(promptName: string): TelemetryEntry[] {
    return this.completedEntries.filter(e => e.promptName === promptName);
  }

  getStats(): {
    totalExecutions: number;
    successRate: number;
    avgLatencyMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  } {
    const total = this.completedEntries.length;
    if (total === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        avgLatencyMs: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
      };
    }

    const successful = this.completedEntries.filter(e => e.success).length;
    const totalLatency = this.completedEntries.reduce((sum, e) => sum + (e.latencyMs || 0), 0);
    const totalInput = this.completedEntries.reduce((sum, e) => sum + (e.inputTokens || 0), 0);
    const totalOutput = this.completedEntries.reduce((sum, e) => sum + (e.outputTokens || 0), 0);

    return {
      totalExecutions: total,
      successRate: (successful / total) * 100,
      avgLatencyMs: totalLatency / total,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
    };
  }

  clear(): void {
    this.entries.clear();
    this.completedEntries = [];
    this.records = [];
  }
}

// Singleton instance
let telemetryStore: TelemetryStore | null = null;

export function getTelemetryStore(): TelemetryStore {
  if (!telemetryStore) {
    telemetryStore = new InMemoryTelemetryStore();
  }
  return telemetryStore;
}

export function resetTelemetryStore(): void {
  if (telemetryStore) {
    telemetryStore.clear();
  }
  telemetryStore = null;
}
