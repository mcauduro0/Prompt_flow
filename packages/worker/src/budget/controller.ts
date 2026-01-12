/**
 * ARC Investment Factory - Budget Controller
 * 
 * Controls budget per run with configurable limits.
 * Prevents LLM calls when budget is exceeded.
 * Code functions can continue for graceful shutdown.
 */

import { type BudgetState, type ExecutorType } from '../prompts/types.js';

// ============================================================================
// BUDGET CONFIG
// ============================================================================

export interface BudgetConfig {
  max_total_tokens: number;
  max_total_cost: number;
  max_total_time_seconds: number;
}

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  max_total_tokens: 100000,    // 100K tokens per run
  max_total_cost: 5.0,         // $5 per run
  max_total_time_seconds: 600, // 10 minutes per run
};

// ============================================================================
// BUDGET CONTROLLER
// ============================================================================

export class BudgetController {
  private budgets: Map<string, BudgetState> = new Map();
  private config: BudgetConfig;

  constructor(config?: Partial<BudgetConfig>) {
    this.config = { ...DEFAULT_BUDGET_CONFIG, ...config };
  }

  /**
   * Initialize budget tracking for a run
   */
  initRun(runId: string, customConfig?: Partial<BudgetConfig>): void {
    const runConfig = { ...this.config, ...customConfig };
    
    this.budgets.set(runId, {
      run_id: runId,
      total_tokens_used: 0,
      total_cost_used: 0,
      total_time_ms: 0,
      max_total_tokens: runConfig.max_total_tokens,
      max_total_cost: runConfig.max_total_cost,
      max_total_time_ms: runConfig.max_total_time_seconds * 1000,
      is_exceeded: false,
    });

    console.log(
      `[BudgetController] Initialized budget for run ${runId}: ` +
      `${runConfig.max_total_tokens} tokens, $${runConfig.max_total_cost}, ` +
      `${runConfig.max_total_time_seconds}s`
    );
  }

  /**
   * Check if budget allows an LLM call
   */
  canExecuteLLM(runId: string): { allowed: boolean; reason?: string } {
    const budget = this.budgets.get(runId);
    
    if (!budget) {
      return { allowed: false, reason: 'Budget not initialized for this run' };
    }

    if (budget.is_exceeded) {
      return { allowed: false, reason: budget.exceeded_reason };
    }

    // Check tokens
    if (budget.total_tokens_used >= budget.max_total_tokens) {
      this.markExceeded(runId, 'token_limit_exceeded');
      return { allowed: false, reason: 'Token limit exceeded' };
    }

    // Check cost
    if (budget.total_cost_used >= budget.max_total_cost) {
      this.markExceeded(runId, 'cost_limit_exceeded');
      return { allowed: false, reason: 'Cost limit exceeded' };
    }

    // Check time
    if (budget.total_time_ms >= budget.max_total_time_ms) {
      this.markExceeded(runId, 'time_limit_exceeded');
      return { allowed: false, reason: 'Time limit exceeded' };
    }

    return { allowed: true };
  }

  /**
   * Check if any execution is allowed (code functions can run even after budget exceeded)
   */
  canExecute(runId: string, executorType: ExecutorType): { allowed: boolean; reason?: string } {
    // Code functions can always run for graceful shutdown
    if (executorType === 'code') {
      return { allowed: true };
    }

    // LLM and hybrid require budget check
    return this.canExecuteLLM(runId);
  }

  /**
   * Record usage after an execution
   */
  recordUsage(
    runId: string,
    usage: {
      tokens_in?: number;
      tokens_out?: number;
      cost?: number;
      latency_ms: number;
    }
  ): void {
    const budget = this.budgets.get(runId);
    if (!budget) {
      console.warn(`[BudgetController] No budget found for run ${runId}`);
      return;
    }

    // Update totals
    if (usage.tokens_in) budget.total_tokens_used += usage.tokens_in;
    if (usage.tokens_out) budget.total_tokens_used += usage.tokens_out;
    if (usage.cost) budget.total_cost_used += usage.cost;
    budget.total_time_ms += usage.latency_ms;

    // Check if limits exceeded
    if (budget.total_tokens_used >= budget.max_total_tokens) {
      this.markExceeded(runId, 'token_limit_exceeded');
    } else if (budget.total_cost_used >= budget.max_total_cost) {
      this.markExceeded(runId, 'cost_limit_exceeded');
    } else if (budget.total_time_ms >= budget.max_total_time_ms) {
      this.markExceeded(runId, 'time_limit_exceeded');
    }

    this.budgets.set(runId, budget);
  }

  /**
   * Mark budget as exceeded
   */
  private markExceeded(runId: string, reason: string): void {
    const budget = this.budgets.get(runId);
    if (!budget || budget.is_exceeded) return;

    budget.is_exceeded = true;
    budget.exceeded_reason = reason;
    this.budgets.set(runId, budget);

    console.warn(
      `[BudgetController] Budget exceeded for run ${runId}: ${reason} ` +
      `(tokens: ${budget.total_tokens_used}/${budget.max_total_tokens}, ` +
      `cost: $${budget.total_cost_used.toFixed(4)}/$${budget.max_total_cost}, ` +
      `time: ${budget.total_time_ms}ms/${budget.max_total_time_ms}ms)`
    );
  }

  /**
   * Get current budget state for a run
   */
  getBudgetState(runId: string): BudgetState | null {
    return this.budgets.get(runId) || null;
  }

  /**
   * Get remaining budget for a run
   */
  getRemainingBudget(runId: string): {
    tokens: number;
    cost: number;
    time_ms: number;
  } | null {
    const budget = this.budgets.get(runId);
    if (!budget) return null;

    return {
      tokens: Math.max(0, budget.max_total_tokens - budget.total_tokens_used),
      cost: Math.max(0, budget.max_total_cost - budget.total_cost_used),
      time_ms: Math.max(0, budget.max_total_time_ms - budget.total_time_ms),
    };
  }

  /**
   * Get usage percentage for a run
   */
  getUsagePercentage(runId: string): {
    tokens: number;
    cost: number;
    time: number;
  } | null {
    const budget = this.budgets.get(runId);
    if (!budget) return null;

    return {
      tokens: (budget.total_tokens_used / budget.max_total_tokens) * 100,
      cost: (budget.total_cost_used / budget.max_total_cost) * 100,
      time: (budget.total_time_ms / budget.max_total_time_ms) * 100,
    };
  }

  /**
   * Finalize and clean up budget tracking for a run
   */
  finalizeRun(runId: string): BudgetState | null {
    const budget = this.budgets.get(runId);
    if (!budget) return null;

    console.log(
      `[BudgetController] Finalized run ${runId}: ` +
      `${budget.total_tokens_used} tokens, $${budget.total_cost_used.toFixed(4)}, ` +
      `${budget.total_time_ms}ms` +
      (budget.is_exceeded ? ` (EXCEEDED: ${budget.exceeded_reason})` : '')
    );

    this.budgets.delete(runId);
    return budget;
  }

  /**
   * Get all active budgets
   */
  getActiveBudgets(): BudgetState[] {
    return Array.from(this.budgets.values());
  }

  /**
   * Update global config
   */
  updateConfig(config: Partial<BudgetConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current config
   */
  getConfig(): BudgetConfig {
    return { ...this.config };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let controllerInstance: BudgetController | null = null;

export function getBudgetController(config?: Partial<BudgetConfig>): BudgetController {
  if (!controllerInstance) {
    controllerInstance = new BudgetController(config);
  }
  return controllerInstance;
}

export function resetBudgetController(): void {
  controllerInstance = null;
}
