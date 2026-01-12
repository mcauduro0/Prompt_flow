/**
 * ARC Investment Factory - Quarantine Store
 * 
 * Stores invalid outputs for debugging and analysis.
 * Persists raw output, validation errors, and execution context.
 */

import { type QuarantineRecord } from '../prompts/types.js';

// ============================================================================
// QUARANTINE STORE
// ============================================================================

export class QuarantineStore {
  private records: QuarantineRecord[] = [];
  private maxRecords: number;

  constructor(maxRecords: number = 1000) {
    this.maxRecords = maxRecords;
  }

  /**
   * Add a record to quarantine
   */
  async add(record: Omit<QuarantineRecord, 'id' | 'created_at'>): Promise<string> {
    const id = this.generateId();
    const fullRecord: QuarantineRecord = {
      ...record,
      id,
      created_at: new Date(),
    };

    this.records.push(fullRecord);

    // Trim old records if exceeding max
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }

    console.log(
      `[QuarantineStore] Added record ${id} for prompt ${record.prompt_id} ` +
      `(${record.validation_errors.length} errors)`
    );

    return id;
  }

  /**
   * Get a record by ID
   */
  async getById(id: string): Promise<QuarantineRecord | null> {
    return this.records.find((r) => r.id === id) || null;
  }

  /**
   * Get records by run ID
   */
  async getByRunId(runId: string): Promise<QuarantineRecord[]> {
    return this.records.filter((r) => r.run_id === runId);
  }

  /**
   * Get records by prompt ID
   */
  async getByPromptId(promptId: string): Promise<QuarantineRecord[]> {
    return this.records.filter((r) => r.prompt_id === promptId);
  }

  /**
   * Get recent records
   */
  async getRecent(limit: number = 100): Promise<QuarantineRecord[]> {
    return this.records.slice(-limit).reverse();
  }

  /**
   * Get records within a time range
   */
  async getByTimeRange(start: Date, end: Date): Promise<QuarantineRecord[]> {
    return this.records.filter(
      (r) => r.created_at >= start && r.created_at <= end
    );
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<boolean> {
    const index = this.records.findIndex((r) => r.id === id);
    if (index === -1) return false;
    this.records.splice(index, 1);
    return true;
  }

  /**
   * Delete records older than a given date
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const initialCount = this.records.length;
    this.records = this.records.filter((r) => r.created_at >= date);
    return initialCount - this.records.length;
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    byPromptId: Record<string, number>;
    byErrorType: Record<string, number>;
    recentCount24h: number;
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const byPromptId: Record<string, number> = {};
    const byErrorType: Record<string, number> = {};
    let recentCount24h = 0;

    for (const record of this.records) {
      // Count by prompt ID
      byPromptId[record.prompt_id] = (byPromptId[record.prompt_id] || 0) + 1;

      // Count by error type (first word of first error)
      if (record.validation_errors.length > 0) {
        const errorType = record.validation_errors[0].split(':')[0].trim();
        byErrorType[errorType] = (byErrorType[errorType] || 0) + 1;
      }

      // Count recent
      if (record.created_at >= oneDayAgo) {
        recentCount24h++;
      }
    }

    return {
      total: this.records.length,
      byPromptId,
      byErrorType,
      recentCount24h,
    };
  }

  /**
   * Export records to JSON
   */
  async export(): Promise<string> {
    return JSON.stringify(this.records, null, 2);
  }

  /**
   * Import records from JSON
   */
  async import(json: string): Promise<number> {
    const imported = JSON.parse(json) as QuarantineRecord[];
    for (const record of imported) {
      record.created_at = new Date(record.created_at);
    }
    this.records.push(...imported);
    return imported.length;
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
    return `qr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let storeInstance: QuarantineStore | null = null;

export function getQuarantineStore(): QuarantineStore {
  if (!storeInstance) {
    storeInstance = new QuarantineStore();
  }
  return storeInstance;
}

export function resetQuarantineStore(): void {
  storeInstance = null;
}
