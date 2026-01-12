/**
 * ARC Investment Factory - Quarantine Store Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QuarantineStore, resetQuarantineStore } from '../quarantine/store.js';

describe('QuarantineStore', () => {
  let store: QuarantineStore;

  const createMockRecord = (overrides = {}) => ({
    run_id: 'run_123',
    prompt_id: 'test_prompt',
    prompt_version: '1.0.0',
    raw_output: '{"invalid": "json',
    validation_errors: ['Schema validation failed'],
    context: {
      ticker: 'AAPL',
      lane: 'lane_a',
      stage: 'research',
    },
    ...overrides,
  });

  beforeEach(() => {
    resetQuarantineStore();
    store = new QuarantineStore({
      maxRecords: 100,
      policy: {
        max_retries: 3,
        retry_delay_seconds: 1,
        retry_backoff_multiplier: 2,
        auto_dismiss_after_hours: 72,
        auto_escalate_after_retries: 2,
      },
      cleanupIntervalSeconds: 3600,
    });
  });

  afterEach(() => {
    store.shutdown();
    resetQuarantineStore();
  });

  describe('add', () => {
    it('should add a record to quarantine', async () => {
      const id = await store.add(createMockRecord());
      expect(id).toMatch(/^qr_/);
      expect(store.getCount()).toBe(1);
    });

    it('should assign priority based on prompt type', async () => {
      const gateId = await store.add(createMockRecord({ prompt_id: 'data_sufficiency_gate' }));
      const record = await store.getById(gateId);
      expect(record?.priority).toBe('critical');
    });

    it('should assign pending status to new records', async () => {
      const id = await store.add(createMockRecord());
      const record = await store.getById(id);
      expect(record?.status).toBe('pending');
    });

    it('should calculate next retry time', async () => {
      const id = await store.add(createMockRecord());
      const record = await store.getById(id);
      expect(record?.next_retry_at).toBeDefined();
    });

    it('should extract tags from record', async () => {
      const id = await store.add(createMockRecord({ prompt_id: 'synthesis_gate' }));
      const record = await store.getById(id);
      expect(record?.tags).toContain('gate');
    });
  });

  describe('markForRetry', () => {
    it('should mark record for retry', async () => {
      const id = await store.add(createMockRecord());
      const result = await store.markForRetry(id);
      
      expect(result).toBe(true);
      
      const record = await store.getById(id);
      expect(record?.status).toBe('retrying');
      expect(record?.retry_count).toBe(1);
    });

    it('should not allow retry beyond max retries', async () => {
      const id = await store.add(createMockRecord());
      
      // Exhaust retries
      await store.markForRetry(id);
      await store.recordRetryResult(id, false);
      await store.markForRetry(id);
      await store.recordRetryResult(id, false);
      await store.markForRetry(id);
      await store.recordRetryResult(id, false);
      
      const result = await store.markForRetry(id);
      expect(result).toBe(false);
      
      const record = await store.getById(id);
      expect(record?.status).toBe('escalated');
    });

    it('should apply exponential backoff', async () => {
      const id = await store.add(createMockRecord());
      
      await store.markForRetry(id);
      const record1 = await store.getById(id);
      const firstDelay = record1!.next_retry_at!.getTime() - Date.now();
      
      await store.recordRetryResult(id, false);
      await store.markForRetry(id);
      const record2 = await store.getById(id);
      const secondDelay = record2!.next_retry_at!.getTime() - Date.now();
      
      // Second delay should be longer (backoff)
      expect(secondDelay).toBeGreaterThan(firstDelay);
    });
  });

  describe('recordRetryResult', () => {
    it('should resolve record on successful retry', async () => {
      const id = await store.add(createMockRecord());
      await store.markForRetry(id);
      await store.recordRetryResult(id, true);
      
      const record = await store.getById(id);
      expect(record?.status).toBe('resolved');
      expect(record?.resolution_type).toBe('auto_retry_success');
    });

    it('should return to pending on failed retry', async () => {
      const id = await store.add(createMockRecord());
      await store.markForRetry(id);
      await store.recordRetryResult(id, false);
      
      const record = await store.getById(id);
      expect(record?.status).toBe('pending');
    });

    it('should escalate after multiple failures', async () => {
      const id = await store.add(createMockRecord());
      
      // First retry
      await store.markForRetry(id);
      await store.recordRetryResult(id, false);
      
      // Second retry
      await store.markForRetry(id);
      await store.recordRetryResult(id, false);
      
      const record = await store.getById(id);
      expect(record?.status).toBe('escalated');
    });
  });

  describe('resolve', () => {
    it('should manually resolve a record', async () => {
      const id = await store.add(createMockRecord());
      
      const result = await store.resolve(id, {
        type: 'manual_fix',
        notes: 'Fixed the prompt template',
        resolved_by: 'operator@example.com',
      });
      
      expect(result).toBe(true);
      
      const record = await store.getById(id);
      expect(record?.status).toBe('resolved');
      expect(record?.resolution_type).toBe('manual_fix');
      expect(record?.resolution_notes).toBe('Fixed the prompt template');
    });
  });

  describe('dismiss', () => {
    it('should dismiss a record as stale', async () => {
      const id = await store.add(createMockRecord());
      
      await store.dismiss(id, 'stale', 'Too old to matter');
      
      const record = await store.getById(id);
      expect(record?.status).toBe('dismissed');
      expect(record?.resolution_type).toBe('dismissed_stale');
    });

    it('should dismiss a record as duplicate', async () => {
      const id = await store.add(createMockRecord());
      
      await store.dismiss(id, 'duplicate');
      
      const record = await store.getById(id);
      expect(record?.resolution_type).toBe('dismissed_duplicate');
    });
  });

  describe('escalate', () => {
    it('should escalate a record for human review', async () => {
      const id = await store.add(createMockRecord());
      
      await store.escalate(id, 'Needs manual investigation');
      
      const record = await store.getById(id);
      expect(record?.status).toBe('escalated');
      expect(record?.resolution_notes).toBe('Needs manual investigation');
    });
  });

  describe('getReadyForRetry', () => {
    it('should return records ready for retry', async () => {
      // Create store with very short retry delay
      const quickStore = new QuarantineStore({
        policy: {
          max_retries: 3,
          retry_delay_seconds: 0.01,
          retry_backoff_multiplier: 1,
          auto_dismiss_after_hours: 72,
          auto_escalate_after_retries: 2,
        },
      });

      await quickStore.add(createMockRecord({ prompt_id: 'prompt_1' }));
      await quickStore.add(createMockRecord({ prompt_id: 'prompt_2' }));
      
      // Wait for retry delay
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const ready = await quickStore.getReadyForRetry();
      expect(ready.length).toBe(2);
      
      quickStore.shutdown();
    });

    it('should sort by priority', async () => {
      const quickStore = new QuarantineStore({
        policy: {
          max_retries: 3,
          retry_delay_seconds: 0.01,
          retry_backoff_multiplier: 1,
          auto_dismiss_after_hours: 72,
          auto_escalate_after_retries: 2,
        },
      });

      await quickStore.add(createMockRecord({ prompt_id: 'regular_prompt' }));
      await quickStore.add(createMockRecord({ prompt_id: 'critical_gate' }));
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const ready = await quickStore.getReadyForRetry();
      expect(ready[0].priority).toBe('critical');
      
      quickStore.shutdown();
    });
  });

  describe('getByStatus', () => {
    it('should filter by status', async () => {
      const id1 = await store.add(createMockRecord({ prompt_id: 'prompt_1' }));
      const id2 = await store.add(createMockRecord({ prompt_id: 'prompt_2' }));
      
      await store.resolve(id1, { type: 'manual_fix' });
      
      const pending = await store.getByStatus('pending');
      const resolved = await store.getByStatus('resolved');
      
      expect(pending.length).toBe(1);
      expect(resolved.length).toBe(1);
    });
  });

  describe('getByPriority', () => {
    it('should filter by priority', async () => {
      await store.add(createMockRecord({ prompt_id: 'gate_prompt' }));
      await store.add(createMockRecord({ prompt_id: 'regular_prompt' }));
      
      const critical = await store.getByPriority('critical');
      expect(critical.length).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return comprehensive statistics', async () => {
      await store.add(createMockRecord({ prompt_id: 'prompt_1' }));
      await store.add(createMockRecord({ prompt_id: 'prompt_2' }));
      const id3 = await store.add(createMockRecord({ prompt_id: 'gate_prompt' }));
      
      await store.escalate(id3);
      
      const stats = await store.getStats();
      
      expect(stats.total).toBe(3);
      expect(stats.byStatus.pending).toBe(2);
      expect(stats.byStatus.escalated).toBe(1);
      expect(stats.escalatedCount).toBe(1);
    });
  });

  describe('policy management', () => {
    it('should return current policy', () => {
      const policy = store.getPolicy();
      expect(policy.max_retries).toBe(3);
    });

    it('should update policy', () => {
      store.updatePolicy({ max_retries: 5 });
      const policy = store.getPolicy();
      expect(policy.max_retries).toBe(5);
    });
  });
});
