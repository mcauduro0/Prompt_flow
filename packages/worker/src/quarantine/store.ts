/**
 * ARC Investment Factory - Quarantine Store
 * 
 * Stores invalid outputs for debugging, analysis, and reprocessing.
 * Implements explicit reprocessing policy with configurable rules.
 * 
 * Reprocessing Policy:
 * - Items can be marked for manual review or automatic retry
 * - Retry attempts are tracked with configurable max attempts
 * - Items can be resolved (fixed), dismissed (ignored), or escalated
 * - Age-based auto-dismissal for stale items
 */

import { type QuarantineRecord } from '../prompts/types.js';

// ============================================================================
// TYPES
// ============================================================================

export type QuarantineStatus = 
  | 'pending'      // Awaiting review or retry
  | 'retrying'     // Currently being reprocessed
  | 'resolved'     // Successfully reprocessed
  | 'dismissed'    // Manually dismissed (not worth fixing)
  | 'escalated'    // Requires human intervention
  | 'expired';     // Auto-dismissed due to age

export type ResolutionType =
  | 'auto_retry_success'   // Automatic retry succeeded
  | 'manual_fix'           // Manually fixed by operator
  | 'data_updated'         // Source data was updated
  | 'prompt_updated'       // Prompt was modified
  | 'dismissed_stale'      // Too old to matter
  | 'dismissed_duplicate'  // Duplicate of another issue
  | 'dismissed_known_issue'; // Known limitation

export interface ExtendedQuarantineRecord extends QuarantineRecord {
  status: QuarantineStatus;
  retry_count: number;
  max_retries: number;
  last_retry_at?: Date;
  next_retry_at?: Date;
  resolution_type?: ResolutionType;
  resolution_notes?: string;
  resolved_at?: Date;
  resolved_by?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
}

export interface ReprocessingPolicy {
  max_retries: number;
  retry_delay_seconds: number;
  retry_backoff_multiplier: number;
  auto_dismiss_after_hours: number;
  auto_escalate_after_retries: number;
  priority_rules: Array<{
    condition: (record: ExtendedQuarantineRecord) => boolean;
    priority: ExtendedQuarantineRecord['priority'];
  }>;
}

export interface ReprocessingResult {
  record_id: string;
  success: boolean;
  new_status: QuarantineStatus;
  error?: string;
  output?: unknown;
}

// ============================================================================
// DEFAULT POLICY
// ============================================================================

const DEFAULT_POLICY: ReprocessingPolicy = {
  max_retries: 3,
  retry_delay_seconds: 300,  // 5 minutes
  retry_backoff_multiplier: 2,
  auto_dismiss_after_hours: 72,  // 3 days
  auto_escalate_after_retries: 2,
  priority_rules: [
    // Critical: Gate failures
    {
      condition: (r) => r.prompt_id.includes('gate'),
      priority: 'critical',
    },
    // High: Synthesis failures
    {
      condition: (r) => r.context?.stage === 'synthesis',
      priority: 'high',
    },
    // Medium: Research failures
    {
      condition: (r) => r.context?.stage === 'research',
      priority: 'medium',
    },
    // Low: Everything else
    {
      condition: () => true,
      priority: 'low',
    },
  ],
};

// ============================================================================
// QUARANTINE STORE
// ============================================================================

export class QuarantineStore {
  private records: Map<string, ExtendedQuarantineRecord> = new Map();
  private maxRecords: number;
  private policy: ReprocessingPolicy;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: {
    maxRecords?: number;
    policy?: Partial<ReprocessingPolicy>;
    cleanupIntervalSeconds?: number;
  }) {
    this.maxRecords = config?.maxRecords || 1000;
    this.policy = { ...DEFAULT_POLICY, ...config?.policy };

    // Start periodic cleanup
    const cleanupInterval = (config?.cleanupIntervalSeconds || 3600) * 1000;
    this.cleanupInterval = setInterval(() => this.runCleanup(), cleanupInterval);
  }

  /**
   * Add a record to quarantine
   */
  async add(record: Omit<QuarantineRecord, 'id' | 'created_at'>): Promise<string> {
    const id = this.generateId();
    
    // Determine priority based on rules
    const priority = this.determinePriority(record);

    const fullRecord: ExtendedQuarantineRecord = {
      ...record,
      id,
      created_at: new Date(),
      status: 'pending',
      retry_count: 0,
      max_retries: this.policy.max_retries,
      priority,
      tags: this.extractTags(record),
    };

    // Calculate next retry time
    fullRecord.next_retry_at = new Date(
      Date.now() + this.policy.retry_delay_seconds * 1000
    );

    this.records.set(id, fullRecord);

    // Trim old records if exceeding max
    if (this.records.size > this.maxRecords) {
      this.trimOldRecords();
    }

    console.log(
      `[QuarantineStore] Added record ${id} for prompt ${record.prompt_id} ` +
      `(${record.validation_errors.length} errors, priority: ${priority})`
    );

    return id;
  }

  /**
   * Mark a record for retry
   */
  async markForRetry(id: string): Promise<boolean> {
    const record = this.records.get(id);
    if (!record) return false;

    if (record.retry_count >= record.max_retries) {
      record.status = 'escalated';
      console.warn(`[QuarantineStore] Record ${id} exceeded max retries, escalating`);
      return false;
    }

    record.status = 'retrying';
    record.last_retry_at = new Date();
    record.retry_count++;

    // Calculate next retry with backoff
    const delay = this.policy.retry_delay_seconds * 
      Math.pow(this.policy.retry_backoff_multiplier, record.retry_count);
    record.next_retry_at = new Date(Date.now() + delay * 1000);

    this.records.set(id, record);
    return true;
  }

  /**
   * Record retry result
   */
  async recordRetryResult(
    id: string,
    success: boolean,
    output?: unknown,
    error?: string
  ): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;

    if (success) {
      record.status = 'resolved';
      record.resolution_type = 'auto_retry_success';
      record.resolved_at = new Date();
      console.log(`[QuarantineStore] Record ${id} resolved via auto-retry`);
    } else {
      if (record.retry_count >= this.policy.auto_escalate_after_retries) {
        record.status = 'escalated';
        console.warn(`[QuarantineStore] Record ${id} escalated after ${record.retry_count} retries`);
      } else {
        record.status = 'pending';
      }
    }

    this.records.set(id, record);
  }

  /**
   * Manually resolve a record
   */
  async resolve(
    id: string,
    resolution: {
      type: ResolutionType;
      notes?: string;
      resolved_by?: string;
    }
  ): Promise<boolean> {
    const record = this.records.get(id);
    if (!record) return false;

    record.status = 'resolved';
    record.resolution_type = resolution.type;
    record.resolution_notes = resolution.notes;
    record.resolved_by = resolution.resolved_by;
    record.resolved_at = new Date();

    this.records.set(id, record);
    console.log(`[QuarantineStore] Record ${id} manually resolved: ${resolution.type}`);
    return true;
  }

  /**
   * Dismiss a record
   */
  async dismiss(
    id: string,
    reason: 'stale' | 'duplicate' | 'known_issue',
    notes?: string
  ): Promise<boolean> {
    const record = this.records.get(id);
    if (!record) return false;

    record.status = 'dismissed';
    record.resolution_type = `dismissed_${reason}` as ResolutionType;
    record.resolution_notes = notes;
    record.resolved_at = new Date();

    this.records.set(id, record);
    console.log(`[QuarantineStore] Record ${id} dismissed: ${reason}`);
    return true;
  }

  /**
   * Escalate a record
   */
  async escalate(id: string, notes?: string): Promise<boolean> {
    const record = this.records.get(id);
    if (!record) return false;

    record.status = 'escalated';
    record.resolution_notes = notes;

    this.records.set(id, record);
    console.warn(`[QuarantineStore] Record ${id} escalated for human review`);
    return true;
  }

  /**
   * Get records ready for retry
   */
  async getReadyForRetry(): Promise<ExtendedQuarantineRecord[]> {
    const now = new Date();
    const ready: ExtendedQuarantineRecord[] = [];

    for (const record of this.records.values()) {
      if (
        record.status === 'pending' &&
        record.retry_count < record.max_retries &&
        record.next_retry_at &&
        record.next_retry_at <= now
      ) {
        ready.push(record);
      }
    }

    // Sort by priority (critical first) then by age (oldest first)
    return ready.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.created_at.getTime() - b.created_at.getTime();
    });
  }

  /**
   * Get records by status
   */
  async getByStatus(status: QuarantineStatus): Promise<ExtendedQuarantineRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.status === status);
  }

  /**
   * Get records by priority
   */
  async getByPriority(priority: ExtendedQuarantineRecord['priority']): Promise<ExtendedQuarantineRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.priority === priority);
  }

  /**
   * Get a record by ID
   */
  async getById(id: string): Promise<ExtendedQuarantineRecord | null> {
    return this.records.get(id) || null;
  }

  /**
   * Get records by run ID
   */
  async getByRunId(runId: string): Promise<ExtendedQuarantineRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.run_id === runId);
  }

  /**
   * Get records by prompt ID
   */
  async getByPromptId(promptId: string): Promise<ExtendedQuarantineRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.prompt_id === promptId);
  }

  /**
   * Get recent records
   */
  async getRecent(limit: number = 100): Promise<ExtendedQuarantineRecord[]> {
    return Array.from(this.records.values())
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }

  /**
   * Run cleanup (auto-dismiss old records)
   */
  private async runCleanup(): Promise<{ dismissed: number; deleted: number }> {
    const now = new Date();
    const dismissCutoff = new Date(
      now.getTime() - this.policy.auto_dismiss_after_hours * 60 * 60 * 1000
    );

    let dismissed = 0;
    let deleted = 0;

    for (const [id, record] of this.records) {
      // Auto-dismiss old pending records
      if (
        record.status === 'pending' &&
        record.created_at < dismissCutoff
      ) {
        record.status = 'expired';
        record.resolution_type = 'dismissed_stale';
        record.resolved_at = now;
        this.records.set(id, record);
        dismissed++;
      }

      // Delete very old resolved/dismissed records (7 days)
      const deleteCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (
        (record.status === 'resolved' || record.status === 'dismissed' || record.status === 'expired') &&
        record.resolved_at &&
        record.resolved_at < deleteCutoff
      ) {
        this.records.delete(id);
        deleted++;
      }
    }

    if (dismissed > 0 || deleted > 0) {
      console.log(`[QuarantineStore] Cleanup: ${dismissed} dismissed, ${deleted} deleted`);
    }

    return { dismissed, deleted };
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<QuarantineStatus, number>;
    byPriority: Record<string, number>;
    byPromptId: Record<string, number>;
    byErrorType: Record<string, number>;
    recentCount24h: number;
    pendingRetries: number;
    escalatedCount: number;
    avgRetryCount: number;
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stats = {
      total: this.records.size,
      byStatus: {} as Record<QuarantineStatus, number>,
      byPriority: {} as Record<string, number>,
      byPromptId: {} as Record<string, number>,
      byErrorType: {} as Record<string, number>,
      recentCount24h: 0,
      pendingRetries: 0,
      escalatedCount: 0,
      avgRetryCount: 0,
    };

    let totalRetries = 0;

    for (const record of this.records.values()) {
      // By status
      stats.byStatus[record.status] = (stats.byStatus[record.status] || 0) + 1;

      // By priority
      stats.byPriority[record.priority] = (stats.byPriority[record.priority] || 0) + 1;

      // By prompt ID
      stats.byPromptId[record.prompt_id] = (stats.byPromptId[record.prompt_id] || 0) + 1;

      // By error type
      if (record.validation_errors.length > 0) {
        const errorType = record.validation_errors[0].split(':')[0].trim();
        stats.byErrorType[errorType] = (stats.byErrorType[errorType] || 0) + 1;
      }

      // Recent count
      if (record.created_at >= oneDayAgo) {
        stats.recentCount24h++;
      }

      // Pending retries
      if (record.status === 'pending' && record.retry_count < record.max_retries) {
        stats.pendingRetries++;
      }

      // Escalated
      if (record.status === 'escalated') {
        stats.escalatedCount++;
      }

      // Total retries
      totalRetries += record.retry_count;
    }

    stats.avgRetryCount = this.records.size > 0 ? totalRetries / this.records.size : 0;

    return stats;
  }

  /**
   * Get current policy
   */
  getPolicy(): ReprocessingPolicy {
    return { ...this.policy };
  }

  /**
   * Update policy
   */
  updatePolicy(updates: Partial<ReprocessingPolicy>): void {
    this.policy = { ...this.policy, ...updates };
  }

  /**
   * Export records to JSON
   */
  async export(): Promise<string> {
    return JSON.stringify(Array.from(this.records.values()), null, 2);
  }

  /**
   * Clear all records
   */
  async clear(): Promise<void> {
    this.records.clear();
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.records.size;
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Determine priority based on policy rules
   */
  private determinePriority(
    record: Omit<QuarantineRecord, 'id' | 'created_at'>
  ): ExtendedQuarantineRecord['priority'] {
    const tempRecord = {
      ...record,
      id: '',
      created_at: new Date(),
      status: 'pending' as QuarantineStatus,
      retry_count: 0,
      max_retries: this.policy.max_retries,
      priority: 'low' as const,
      tags: [],
    };

    for (const rule of this.policy.priority_rules) {
      if (rule.condition(tempRecord)) {
        return rule.priority;
      }
    }

    return 'low';
  }

  /**
   * Extract tags from record
   */
  private extractTags(record: Omit<QuarantineRecord, 'id' | 'created_at'>): string[] {
    const tags: string[] = [];

    // Add prompt-related tags
    if (record.prompt_id.includes('gate')) tags.push('gate');
    if (record.prompt_id.includes('synthesis')) tags.push('synthesis');
    if (record.prompt_id.includes('analysis')) tags.push('analysis');

    // Add error-related tags
    for (const error of record.validation_errors) {
      if (error.toLowerCase().includes('schema')) tags.push('schema_error');
      if (error.toLowerCase().includes('timeout')) tags.push('timeout');
      if (error.toLowerCase().includes('rate limit')) tags.push('rate_limit');
    }

    return [...new Set(tags)];
  }

  /**
   * Trim old records when exceeding max
   */
  private trimOldRecords(): void {
    // Sort by created_at and keep newest
    const sorted = Array.from(this.records.entries())
      .sort((a, b) => b[1].created_at.getTime() - a[1].created_at.getTime());

    const toKeep = sorted.slice(0, this.maxRecords);
    this.records = new Map(toKeep);
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `qr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let storeInstance: QuarantineStore | null = null;

export function getQuarantineStore(config?: {
  maxRecords?: number;
  policy?: Partial<ReprocessingPolicy>;
}): QuarantineStore {
  if (!storeInstance) {
    storeInstance = new QuarantineStore(config);
  }
  return storeInstance;
}

export function resetQuarantineStore(): void {
  if (storeInstance) {
    storeInstance.shutdown();
  }
  storeInstance = null;
}
