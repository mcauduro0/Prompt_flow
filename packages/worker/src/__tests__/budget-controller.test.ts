/**
 * ARC Investment Factory - Budget Controller Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BudgetController, resetBudgetController } from '../budget/controller.js';

describe('BudgetController', () => {
  let controller: BudgetController;

  beforeEach(() => {
    resetBudgetController();
    controller = new BudgetController({
      max_total_tokens: 10000,
      max_total_cost: 1.0,
      max_total_time_seconds: 60,
      warn_threshold_percent: 80,
    });
  });

  afterEach(() => {
    resetBudgetController();
  });

  describe('initRun', () => {
    it('should initialize budget for a run', () => {
      controller.initRun('run_1');
      const state = controller.getBudgetState('run_1');
      
      expect(state).not.toBeNull();
      expect(state?.run_id).toBe('run_1');
      expect(state?.total_tokens_used).toBe(0);
      expect(state?.is_exceeded).toBe(false);
    });

    it('should allow custom config per run', () => {
      controller.initRun('run_1', { max_total_tokens: 5000 });
      const state = controller.getBudgetState('run_1');
      
      expect(state?.max_total_tokens).toBe(5000);
    });
  });

  describe('canExecuteLLM', () => {
    it('should allow LLM calls when budget available', () => {
      controller.initRun('run_1');
      const result = controller.canExecuteLLM('run_1');
      
      expect(result.allowed).toBe(true);
    });

    it('should deny LLM calls when budget not initialized', () => {
      const result = controller.canExecuteLLM('nonexistent');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not initialized');
    });

    it('should deny LLM calls when budget exceeded', () => {
      controller.initRun('run_1');
      
      // Exceed token budget
      controller.recordUsage('run_1', {
        tokens_in: 6000,
        tokens_out: 5000,
        cost: 0.5,
        latency_ms: 1000,
      });
      
      const result = controller.canExecuteLLM('run_1');
      expect(result.allowed).toBe(false);
    });
  });

  describe('canExecute', () => {
    it('should always allow code execution', () => {
      controller.initRun('run_1');
      
      // Exceed budget
      controller.recordUsage('run_1', {
        tokens_in: 10000,
        tokens_out: 5000,
        cost: 2.0,
        latency_ms: 1000,
      });
      
      const result = controller.canExecute('run_1', 'code');
      expect(result.allowed).toBe(true);
    });

    it('should check budget for LLM execution', () => {
      controller.initRun('run_1');
      
      // Exceed budget
      controller.recordUsage('run_1', {
        tokens_in: 10000,
        tokens_out: 5000,
        cost: 2.0,
        latency_ms: 1000,
      });
      
      const result = controller.canExecute('run_1', 'llm');
      expect(result.allowed).toBe(false);
    });
  });

  describe('recordUsage', () => {
    it('should track token usage', () => {
      controller.initRun('run_1');
      
      controller.recordUsage('run_1', {
        tokens_in: 1000,
        tokens_out: 500,
        latency_ms: 1000,
      });
      
      const state = controller.getBudgetState('run_1');
      expect(state?.total_tokens_used).toBe(1500);
    });

    it('should track cost usage', () => {
      controller.initRun('run_1');
      
      controller.recordUsage('run_1', {
        cost: 0.25,
        latency_ms: 1000,
      });
      
      const state = controller.getBudgetState('run_1');
      expect(state?.total_cost_used).toBe(0.25);
    });

    it('should track time usage', () => {
      controller.initRun('run_1');
      
      controller.recordUsage('run_1', { latency_ms: 5000 });
      controller.recordUsage('run_1', { latency_ms: 3000 });
      
      const state = controller.getBudgetState('run_1');
      expect(state?.total_time_ms).toBe(8000);
    });

    it('should mark exceeded when token limit reached', () => {
      controller.initRun('run_1');
      
      controller.recordUsage('run_1', {
        tokens_in: 10000,
        tokens_out: 1,
        latency_ms: 1000,
      });
      
      const state = controller.getBudgetState('run_1');
      expect(state?.is_exceeded).toBe(true);
      expect(state?.exceeded_reason).toBe('token_limit_exceeded');
    });

    it('should mark exceeded when cost limit reached', () => {
      controller.initRun('run_1');
      
      controller.recordUsage('run_1', {
        cost: 1.5,
        latency_ms: 1000,
      });
      
      const state = controller.getBudgetState('run_1');
      expect(state?.is_exceeded).toBe(true);
      expect(state?.exceeded_reason).toBe('cost_limit_exceeded');
    });

    it('should mark exceeded when time limit reached', () => {
      controller.initRun('run_1');
      
      controller.recordUsage('run_1', { latency_ms: 61000 });
      
      const state = controller.getBudgetState('run_1');
      expect(state?.is_exceeded).toBe(true);
      expect(state?.exceeded_reason).toBe('time_limit_exceeded');
    });
  });

  describe('getExtendedBudgetState', () => {
    it('should return extended state with llm_calls_allowed', () => {
      controller.initRun('run_1');
      
      const state = controller.getExtendedBudgetState('run_1');
      
      expect(state?.llm_calls_allowed).toBe(true);
      expect(state?.code_calls_allowed).toBe(true);
    });

    it('should set llm_calls_allowed to false when exceeded', () => {
      controller.initRun('run_1');
      
      controller.recordUsage('run_1', {
        tokens_in: 10000,
        tokens_out: 1,
        latency_ms: 1000,
      });
      
      const state = controller.getExtendedBudgetState('run_1');
      expect(state?.llm_calls_allowed).toBe(false);
    });

    it('should calculate remaining values', () => {
      controller.initRun('run_1');
      
      controller.recordUsage('run_1', {
        tokens_in: 2000,
        cost: 0.3,
        latency_ms: 10000,
      });
      
      const state = controller.getExtendedBudgetState('run_1');
      
      expect(state?.tokens_remaining).toBe(8000);
      expect(state?.cost_remaining).toBeCloseTo(0.7, 2);
      expect(state?.time_remaining_ms).toBe(50000);
    });

    it('should calculate usage percentages', () => {
      controller.initRun('run_1');
      
      controller.recordUsage('run_1', {
        tokens_in: 5000,
        cost: 0.5,
        latency_ms: 30000,
      });
      
      const state = controller.getExtendedBudgetState('run_1');
      
      expect(state?.usage_percent.tokens).toBe(50);
      expect(state?.usage_percent.cost).toBe(50);
      expect(state?.usage_percent.time).toBe(50);
    });

    it('should estimate remaining calls', () => {
      controller.initRun('run_1');
      
      const state = controller.getExtendedBudgetState('run_1');
      expect(state?.estimated_calls_remaining).toBeGreaterThan(0);
    });
  });

  describe('getRealTimeStatus', () => {
    it('should return formatted real-time status', () => {
      controller.initRun('run_1');
      
      controller.recordUsage('run_1', {
        tokens_in: 2000,
        tokens_out: 1000,
        cost: 0.25,
        latency_ms: 15000,
      });
      
      const status = controller.getRealTimeStatus('run_1');
      
      expect(status).not.toBeNull();
      expect(status?.llm_calls_allowed).toBe(true);
      expect(status?.is_exceeded).toBe(false);
      expect(status?.usage.tokens.used).toBe(3000);
      expect(status?.usage.tokens.max).toBe(10000);
      expect(status?.usage.tokens.percent).toBe(30);
      expect(status?.remaining.tokens).toBe(7000);
    });
  });

  describe('getRemainingBudget', () => {
    it('should return remaining budget values', () => {
      controller.initRun('run_1');
      
      controller.recordUsage('run_1', {
        tokens_in: 3000,
        cost: 0.4,
        latency_ms: 20000,
      });
      
      const remaining = controller.getRemainingBudget('run_1');
      
      expect(remaining?.tokens).toBe(7000);
      expect(remaining?.cost).toBeCloseTo(0.6, 2);
      expect(remaining?.time_ms).toBe(40000);
    });
  });

  describe('getUsagePercentage', () => {
    it('should return usage percentages', () => {
      controller.initRun('run_1');
      
      controller.recordUsage('run_1', {
        tokens_in: 2500,
        cost: 0.25,
        latency_ms: 15000,
      });
      
      const usage = controller.getUsagePercentage('run_1');
      
      expect(usage?.tokens).toBe(25);
      expect(usage?.cost).toBe(25);
      expect(usage?.time).toBe(25);
    });
  });

  describe('finalizeRun', () => {
    it('should finalize and remove budget tracking', () => {
      controller.initRun('run_1');
      
      controller.recordUsage('run_1', {
        tokens_in: 1000,
        cost: 0.1,
        latency_ms: 5000,
      });
      
      const finalState = controller.finalizeRun('run_1');
      
      expect(finalState).not.toBeNull();
      expect(controller.getBudgetState('run_1')).toBeNull();
    });
  });

  describe('getActiveBudgets', () => {
    it('should return all active budgets', () => {
      controller.initRun('run_1');
      controller.initRun('run_2');
      controller.initRun('run_3');
      
      const active = controller.getActiveBudgets();
      expect(active.length).toBe(3);
    });
  });

  describe('getActiveExtendedBudgets', () => {
    it('should return all active extended budgets', () => {
      controller.initRun('run_1');
      controller.initRun('run_2');
      
      const active = controller.getActiveExtendedBudgets();
      
      expect(active.length).toBe(2);
      expect(active[0].llm_calls_allowed).toBeDefined();
    });
  });

  describe('getGlobalStats', () => {
    it('should return global statistics', () => {
      controller.initRun('run_1');
      controller.initRun('run_2');
      
      controller.recordUsage('run_1', {
        tokens_in: 10000,
        tokens_out: 1,
        latency_ms: 1000,
      });
      
      const stats = controller.getGlobalStats();
      
      expect(stats.active_runs).toBe(2);
      expect(stats.runs_exceeded).toBe(1);
      expect(stats.total_calls_tracked).toBeGreaterThan(0);
    });
  });

  describe('config management', () => {
    it('should update config', () => {
      controller.updateConfig({ max_total_tokens: 50000 });
      const config = controller.getConfig();
      expect(config.max_total_tokens).toBe(50000);
    });

    it('should return current config', () => {
      const config = controller.getConfig();
      expect(config.max_total_tokens).toBe(10000);
      expect(config.max_total_cost).toBe(1.0);
    });
  });
});
