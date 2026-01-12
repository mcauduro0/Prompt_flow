/**
 * ARC Investment Factory - Budget Controller
 * 
 * Controls budget per run with configurable limits.
 * Prevents LLM calls when budget is exceeded.
 * Code functions can continue for graceful shutdown.
 * 
 * Exposes real-time budget state including llm_calls_allowed flag.
 */

import { type BudgetState, type ExecutorType } from '../prompts/types.js';

// ============================================================================
// BUDGET CONFIG
// ============================================================================

export interface BudgetConfig {
  max_total_tokens: number;
  max_total_cost: number;
  max_total_time_seconds: number;
  warn_threshold_percent?: number;  // Warn when budget reaches this percentage
}

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  max_total_tokens: 100000,    // 100K tokens per run
  max_total_cost: 5.0,         // $5 per run
  max_total_time_seconds: 600, // 10 minutes per run
  warn_threshold_percent: 80,  // Warn at 80%
};

// ============================================================================
// EXTENDED BUDGET STATE
// ============================================================================

export interface ExtendedBudgetState extends BudgetState {
  llm_calls_allowed: boolean;
  code_calls_allowed: boolean;
  warning_issued: boolean;
  tokens_remaining: number;
  cost_remaining: number;
  time_remaining_ms: number;
  usage_percent: {
    tokens: number;
    cost: number;
    time: number;
    max: number;  // Highest of the three
  };
  estimated_calls_remaining: number;  // Rough estimate based on avg usage
}

// ============================================================================
// BUDGET CONTROLLER
// ============================================================================

export class BudgetController {
  private budgets: Map<string, ExtendedBudgetState> = new Map();
  private config: BudgetConfig;
  private avgTokensPerCall: number = 2000;  // Running average
  private avgCostPerCall: number = 0.05;    // Running average
  private callCount: number = 0;

  constructor(config?: Partial<BudgetConfig>) {
    this.config = { ...DEFAULT_BUDGET_CONFIG, ...config };
  }

  /**
   * Initialize budget tracking for a run
   */
  initRun(runId: string, customConfig?: Partial<BudgetConfig>): void {
    const runConfig = { ...this.config, ...customConfig };
    
    const state: ExtendedBudgetState = {
      run_id: runId,
      total_tokens_used: 0,
      total_cost_used: 0,
      total_time_ms: 0,
      max_total_tokens: runConfig.max_total_tokens,
      max_total_cost: runConfig.max_total_cost,
      max_total_time_ms: runConfig.max_total_time_seconds * 1000,
      is_exceeded: false,
      llm_calls_allowed: true,
      code_calls_allowed: true,
      warning_issued: false,
      tokens_remaining: runConfig.max_total_tokens,
      cost_remaining: runConfig.max_total_cost,
      time_remaining_ms: runConfig.max_total_time_seconds * 1000,
      usage_percent: {
        tokens: 0,
        cost: 0,
        time: 0,
        max: 0,
      },
      estimated_calls_remaining: Math.floor(runConfig.max_total_tokens / this.avgTokensPerCall),
    };

    this.budgets.set(runId, state);

    console.log(
      `[BudgetController] Initialized budget for run ${runId}: ` +
      `${runConfig.max_total_tokens} tokens, $${runConfig.max_total_cost}, ` +
      `${runConfig.max_total_time_seconds}s | Est. ${state.estimated_calls_remaining} calls`
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

    if (!budget.llm_calls_allowed) {
      return { allowed: false, reason: budget.exceeded_reason || 'LLM calls not allowed' };
    }

    return { allowed: true };
  }

  /**
   * Check if any execution is allowed (code functions can run even after budget exceeded)
   */
  canExecute(runId: string, executorType: ExecutorType): { allowed: boolean; reason?: string } {
    const budget = this.budgets.get(runId);
    
    if (!budget) {
      return { allowed: false, reason: 'Budget not initialized' };
    }

    // Code functions can always run for graceful shutdown
    if (executorType === 'code') {
      return { allowed: budget.code_calls_allowed };
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

    const totalTokens = (usage.tokens_in || 0) + (usage.tokens_out || 0);

    // Update totals
    budget.total_tokens_used += totalTokens;
    if (usage.cost) budget.total_cost_used += usage.cost;
    budget.total_time_ms += usage.latency_ms;

    // Update running averages
    this.callCount++;
    if (totalTokens > 0) {
      this.avgTokensPerCall = (this.avgTokensPerCall * (this.callCount - 1) + totalTokens) / this.callCount;
    }
    if (usage.cost && usage.cost > 0) {
      this.avgCostPerCall = (this.avgCostPerCall * (this.callCount - 1) + usage.cost) / this.callCount;
    }

    // Recalculate derived values
    this.updateDerivedState(budget);

    // Check if limits exceeded
    this.checkLimits(runId, budget);

    this.budgets.set(runId, budget);
  }

  /**
   * Update derived state values
   */
  private updateDerivedState(budget: ExtendedBudgetState): void {
    // Calculate remaining
    budget.tokens_remaining = Math.max(0, budget.max_total_tokens - budget.total_tokens_used);
    budget.cost_remaining = Math.max(0, budget.max_total_cost - budget.total_cost_used);
    budget.time_remaining_ms = Math.max(0, budget.max_total_time_ms - budget.total_time_ms);

    // Calculate usage percentages
    budget.usage_percent = {
      tokens: (budget.total_tokens_used / budget.max_total_tokens) * 100,
      cost: (budget.total_cost_used / budget.max_total_cost) * 100,
      time: (budget.total_time_ms / budget.max_total_time_ms) * 100,
      max: 0,
    };
    budget.usage_percent.max = Math.max(
      budget.usage_percent.tokens,
      budget.usage_percent.cost,
      budget.usage_percent.time
    );

    // Estimate remaining calls
    const tokenBasedEstimate = Math.floor(budget.tokens_remaining / this.avgTokensPerCall);
    const costBasedEstimate = Math.floor(budget.cost_remaining / this.avgCostPerCall);
    budget.estimated_calls_remaining = Math.min(tokenBasedEstimate, costBasedEstimate);
  }

  /**
   * Check limits and update allowed flags
   */
  private checkLimits(runId: string, budget: ExtendedBudgetState): void {
    const warnThreshold = this.config.warn_threshold_percent || 80;

    // Check for warning threshold
    if (!budget.warning_issued && budget.usage_percent.max >= warnThreshold) {
      budget.warning_issued = true;
      console.warn(
        `[BudgetController] WARNING: Run ${runId} at ${budget.usage_percent.max.toFixed(1)}% budget ` +
        `(~${budget.estimated_calls_remaining} calls remaining)`
      );
    }

    // Check if limits exceeded
    if (budget.total_tokens_used >= budget.max_total_tokens) {
      this.markExceeded(runId, budget, 'token_limit_exceeded');
    } else if (budget.total_cost_used >= budget.max_total_cost) {
      this.markExceeded(runId, budget, 'cost_limit_exceeded');
    } else if (budget.total_time_ms >= budget.max_total_time_ms) {
      this.markExceeded(runId, budget, 'time_limit_exceeded');
    }
  }

  /**
   * Mark budget as exceeded
   */
  private markExceeded(runId: string, budget: ExtendedBudgetState, reason: string): void {
    if (budget.is_exceeded) return;

    budget.is_exceeded = true;
    budget.exceeded_reason = reason;
    budget.llm_calls_allowed = false;
    budget.estimated_calls_remaining = 0;

    console.warn(
      `[BudgetController] BUDGET EXCEEDED for run ${runId}: ${reason}\n` +
      `  Tokens: ${budget.total_tokens_used}/${budget.max_total_tokens} (${budget.usage_percent.tokens.toFixed(1)}%)\n` +
      `  Cost: $${budget.total_cost_used.toFixed(4)}/$${budget.max_total_cost} (${budget.usage_percent.cost.toFixed(1)}%)\n` +
      `  Time: ${budget.total_time_ms}ms/${budget.max_total_time_ms}ms (${budget.usage_percent.time.toFixed(1)}%)`
    );
  }

  /**
   * Get current budget state for a run (basic)
   */
  getBudgetState(runId: string): BudgetState | null {
    const budget = this.budgets.get(runId);
    if (!budget) return null;

    // Return basic BudgetState for compatibility
    return {
      run_id: budget.run_id,
      total_tokens_used: budget.total_tokens_used,
      total_cost_used: budget.total_cost_used,
      total_time_ms: budget.total_time_ms,
      max_total_tokens: budget.max_total_tokens,
      max_total_cost: budget.max_total_cost,
      max_total_time_ms: budget.max_total_time_ms,
      is_exceeded: budget.is_exceeded,
      exceeded_reason: budget.exceeded_reason,
    };
  }

  /**
   * Get extended budget state with real-time metrics
   */
  getExtendedBudgetState(runId: string): ExtendedBudgetState | null {
    return this.budgets.get(runId) || null;
  }

  /**
   * Get real-time budget status for API exposure
   */
  getRealTimeStatus(runId: string): {
    run_id: string;
    llm_calls_allowed: boolean;
    is_exceeded: boolean;
    exceeded_reason?: string;
    usage: {
      tokens: { used: number; max: number; percent: number };
      cost: { used: number; max: number; percent: number };
      time: { used_ms: number; max_ms: number; percent: number };
    };
    remaining: {
      tokens: number;
      cost: number;
      time_ms: number;
      estimated_calls: number;
    };
    warning_issued: boolean;
  } | null {
    const budget = this.budgets.get(runId);
    if (!budget) return null;

    return {
      run_id: budget.run_id,
      llm_calls_allowed: budget.llm_calls_allowed,
      is_exceeded: budget.is_exceeded,
      exceeded_reason: budget.exceeded_reason,
      usage: {
        tokens: {
          used: budget.total_tokens_used,
          max: budget.max_total_tokens,
          percent: budget.usage_percent.tokens,
        },
        cost: {
          used: budget.total_cost_used,
          max: budget.max_total_cost,
          percent: budget.usage_percent.cost,
        },
        time: {
          used_ms: budget.total_time_ms,
          max_ms: budget.max_total_time_ms,
          percent: budget.usage_percent.time,
        },
      },
      remaining: {
        tokens: budget.tokens_remaining,
        cost: budget.cost_remaining,
        time_ms: budget.time_remaining_ms,
        estimated_calls: budget.estimated_calls_remaining,
      },
      warning_issued: budget.warning_issued,
    };
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
      tokens: budget.tokens_remaining,
      cost: budget.cost_remaining,
      time_ms: budget.time_remaining_ms,
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
      tokens: budget.usage_percent.tokens,
      cost: budget.usage_percent.cost,
      time: budget.usage_percent.time,
    };
  }

  /**
   * Finalize and clean up budget tracking for a run
   */
  finalizeRun(runId: string): BudgetState | null {
    const budget = this.budgets.get(runId);
    if (!budget) return null;

    // Create a copy of the state before deleting
    const finalState: BudgetState = {
      run_id: budget.run_id,
      total_tokens_used: budget.total_tokens_used,
      total_cost_used: budget.total_cost_used,
      total_time_ms: budget.total_time_ms,
      max_total_tokens: budget.max_total_tokens,
      max_total_cost: budget.max_total_cost,
      max_total_time_ms: budget.max_total_time_ms,
      is_exceeded: budget.is_exceeded,
      exceeded_reason: budget.exceeded_reason,
    };

    console.log(
      `[BudgetController] Finalized run ${runId}:\n` +
      `  Tokens: ${budget.total_tokens_used}/${budget.max_total_tokens} (${budget.usage_percent.tokens.toFixed(1)}%)\n` +
      `  Cost: $${budget.total_cost_used.toFixed(4)}/$${budget.max_total_cost} (${budget.usage_percent.cost.toFixed(1)}%)\n` +
      `  Time: ${budget.total_time_ms}ms/${budget.max_total_time_ms}ms (${budget.usage_percent.time.toFixed(1)}%)` +
      (budget.is_exceeded ? `\n  STATUS: EXCEEDED (${budget.exceeded_reason})` : '')
    );

    this.budgets.delete(runId);
    return finalState;
  }

  /**
   * Get all active budgets
   */
  getActiveBudgets(): BudgetState[] {
    return Array.from(this.budgets.values()).map(b => ({
      run_id: b.run_id,
      total_tokens_used: b.total_tokens_used,
      total_cost_used: b.total_cost_used,
      total_time_ms: b.total_time_ms,
      max_total_tokens: b.max_total_tokens,
      max_total_cost: b.max_total_cost,
      max_total_time_ms: b.max_total_time_ms,
      is_exceeded: b.is_exceeded,
      exceeded_reason: b.exceeded_reason,
    }));
  }

  /**
   * Get all active extended budgets
   */
  getActiveExtendedBudgets(): ExtendedBudgetState[] {
    return Array.from(this.budgets.values());
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): {
    active_runs: number;
    avg_tokens_per_call: number;
    avg_cost_per_call: number;
    total_calls_tracked: number;
    runs_exceeded: number;
  } {
    const budgets = Array.from(this.budgets.values());
    return {
      active_runs: budgets.length,
      avg_tokens_per_call: this.avgTokensPerCall,
      avg_cost_per_call: this.avgCostPerCall,
      total_calls_tracked: this.callCount,
      runs_exceeded: budgets.filter(b => b.is_exceeded).length,
    };
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
