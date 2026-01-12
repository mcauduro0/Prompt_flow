/**
 * ARC Investment Factory - Prompt Selector
 * 
 * Intelligent prompt selection based on expected value, cost, and dependencies.
 * Implements value-based prioritization for optimal resource utilization.
 */

import type { PromptDefinition, Lane, BudgetState } from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SelectionCriteria {
  lane: Lane;
  stage?: string;
  budget_remaining?: number;
  max_cost_score?: number;
  min_value_score?: number;
  required_prompt_ids?: string[];
  exclude_prompt_ids?: string[];
  completed_prompt_ids?: string[];
}

export interface SelectionResult {
  selected: PromptDefinition[];
  skipped: Array<{ prompt_id: string; reason: string }>;
  total_expected_cost: number;
  total_expected_value: number;
  execution_order: string[];
}

export interface DependencyGraph {
  nodes: Map<string, PromptDefinition>;
  edges: Map<string, string[]>; // prompt_id -> dependencies
}

// ============================================================================
// PROMPT SELECTOR
// ============================================================================

export class PromptSelector {
  private prompts: PromptDefinition[] = [];
  private dependencyGraph: DependencyGraph = {
    nodes: new Map(),
    edges: new Map(),
  };

  /**
   * Load prompts and build dependency graph
   */
  loadPrompts(prompts: PromptDefinition[]): void {
    this.prompts = prompts;
    this.buildDependencyGraph();
  }

  /**
   * Build dependency graph from prompt definitions
   */
  private buildDependencyGraph(): void {
    this.dependencyGraph.nodes.clear();
    this.dependencyGraph.edges.clear();

    for (const prompt of this.prompts) {
      this.dependencyGraph.nodes.set(prompt.prompt_id, prompt);
      this.dependencyGraph.edges.set(
        prompt.prompt_id,
        prompt.min_signal_dependency || []
      );
    }
  }

  /**
   * Select prompts based on criteria with value-based prioritization
   */
  selectPrompts(criteria: SelectionCriteria): SelectionResult {
    const selected: PromptDefinition[] = [];
    const skipped: Array<{ prompt_id: string; reason: string }> = [];
    const completedSet = new Set(criteria.completed_prompt_ids || []);
    const excludeSet = new Set(criteria.exclude_prompt_ids || []);
    const requiredSet = new Set(criteria.required_prompt_ids || []);

    // Filter prompts by lane and stage
    let candidates = this.prompts.filter((p) => {
      // Match lane
      const laneMatch = this.matchLane(p.lane, criteria.lane);
      if (!laneMatch) return false;

      // Match stage if specified
      if (criteria.stage && p.stage !== criteria.stage) return false;

      // Exclude already completed
      if (completedSet.has(p.prompt_id)) return false;

      // Exclude explicitly excluded
      if (excludeSet.has(p.prompt_id)) return false;

      return true;
    });

    // Apply value/cost filters
    if (criteria.min_value_score !== undefined) {
      candidates = candidates.filter(
        (p) => (p.expected_value_score || 5) >= criteria.min_value_score!
      );
    }

    if (criteria.max_cost_score !== undefined) {
      candidates = candidates.filter(
        (p) => (p.expected_cost_score || 5) <= criteria.max_cost_score!
      );
    }

    // Sort by value-cost ratio (highest first)
    candidates.sort((a, b) => {
      const ratioA = a.value_cost_ratio || (a.expected_value_score || 5) / (a.expected_cost_score || 5);
      const ratioB = b.value_cost_ratio || (b.expected_value_score || 5) / (b.expected_cost_score || 5);
      return ratioB - ratioA;
    });

    // Track cumulative cost
    let totalCost = 0;
    const maxCost = criteria.budget_remaining || Infinity;

    // Select prompts respecting dependencies and budget
    for (const prompt of candidates) {
      const estimatedCost = prompt.expected_cost_score || 5;

      // Check budget
      if (totalCost + estimatedCost > maxCost) {
        skipped.push({
          prompt_id: prompt.prompt_id,
          reason: `Budget exceeded: estimated cost ${estimatedCost} would exceed remaining budget`,
        });
        continue;
      }

      // Check dependencies
      const dependencies = prompt.min_signal_dependency || [];
      const unmetDependencies = dependencies.filter(
        (dep) => !completedSet.has(dep) && !selected.some((s) => s.prompt_id === dep)
      );

      if (unmetDependencies.length > 0) {
        // Try to add missing dependencies first
        const depsAdded = this.addDependencies(
          unmetDependencies,
          selected,
          completedSet,
          excludeSet,
          maxCost - totalCost
        );

        if (!depsAdded.success) {
          skipped.push({
            prompt_id: prompt.prompt_id,
            reason: `Unmet dependencies: ${unmetDependencies.join(', ')}`,
          });
          continue;
        }

        // Add the dependencies
        for (const dep of depsAdded.added) {
          selected.push(dep);
          totalCost += dep.expected_cost_score || 5;
        }
      }

      // Add the prompt
      selected.push(prompt);
      totalCost += estimatedCost;

      // Add to required if specified
      if (requiredSet.has(prompt.prompt_id)) {
        requiredSet.delete(prompt.prompt_id);
      }
    }

    // Check if all required prompts were selected
    for (const requiredId of requiredSet) {
      skipped.push({
        prompt_id: requiredId,
        reason: 'Required prompt not found or could not be selected',
      });
    }

    // Compute execution order (topological sort)
    const executionOrder = this.computeExecutionOrder(selected);

    // Calculate totals
    const totalExpectedCost = selected.reduce(
      (sum, p) => sum + (p.expected_cost_score || 5),
      0
    );
    const totalExpectedValue = selected.reduce(
      (sum, p) => sum + (p.expected_value_score || 5),
      0
    );

    return {
      selected,
      skipped,
      total_expected_cost: totalExpectedCost,
      total_expected_value: totalExpectedValue,
      execution_order: executionOrder,
    };
  }

  /**
   * Try to add missing dependencies
   */
  private addDependencies(
    dependencies: string[],
    currentSelection: PromptDefinition[],
    completed: Set<string>,
    excluded: Set<string>,
    remainingBudget: number
  ): { success: boolean; added: PromptDefinition[] } {
    const added: PromptDefinition[] = [];
    let budgetUsed = 0;

    for (const depId of dependencies) {
      if (completed.has(depId) || currentSelection.some((p) => p.prompt_id === depId)) {
        continue;
      }

      if (excluded.has(depId)) {
        return { success: false, added: [] };
      }

      const depPrompt = this.dependencyGraph.nodes.get(depId);
      if (!depPrompt) {
        return { success: false, added: [] };
      }

      const depCost = depPrompt.expected_cost_score || 5;
      if (budgetUsed + depCost > remainingBudget) {
        return { success: false, added: [] };
      }

      // Recursively check this dependency's dependencies
      const nestedDeps = depPrompt.min_signal_dependency || [];
      if (nestedDeps.length > 0) {
        const nestedResult = this.addDependencies(
          nestedDeps,
          [...currentSelection, ...added],
          completed,
          excluded,
          remainingBudget - budgetUsed
        );
        if (!nestedResult.success) {
          return { success: false, added: [] };
        }
        added.push(...nestedResult.added);
        budgetUsed += nestedResult.added.reduce((s, p) => s + (p.expected_cost_score || 5), 0);
      }

      added.push(depPrompt);
      budgetUsed += depCost;
    }

    return { success: true, added };
  }

  /**
   * Compute execution order using topological sort
   */
  private computeExecutionOrder(prompts: PromptDefinition[]): string[] {
    const promptIds = new Set(prompts.map((p) => p.prompt_id));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const prompt of prompts) {
      inDegree.set(prompt.prompt_id, 0);
      adjacency.set(prompt.prompt_id, []);
    }

    // Build adjacency list and compute in-degrees
    for (const prompt of prompts) {
      const deps = prompt.min_signal_dependency || [];
      for (const dep of deps) {
        if (promptIds.has(dep)) {
          adjacency.get(dep)!.push(prompt.prompt_id);
          inDegree.set(prompt.prompt_id, (inDegree.get(prompt.prompt_id) || 0) + 1);
        }
      }
    }

    // Kahn's algorithm with value-based tie-breaking
    const queue: string[] = [];
    const result: string[] = [];

    // Start with nodes that have no dependencies
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    // Sort queue by value-cost ratio
    queue.sort((a, b) => {
      const promptA = this.dependencyGraph.nodes.get(a);
      const promptB = this.dependencyGraph.nodes.get(b);
      const ratioA = promptA?.value_cost_ratio || 1;
      const ratioB = promptB?.value_cost_ratio || 1;
      return ratioB - ratioA;
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const neighbors = adjacency.get(current) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
          // Re-sort queue
          queue.sort((a, b) => {
            const promptA = this.dependencyGraph.nodes.get(a);
            const promptB = this.dependencyGraph.nodes.get(b);
            const ratioA = promptA?.value_cost_ratio || 1;
            const ratioB = promptB?.value_cost_ratio || 1;
            return ratioB - ratioA;
          });
        }
      }
    }

    return result;
  }

  /**
   * Match lane with flexible comparison
   */
  private matchLane(promptLane: Lane, criteriaLane: Lane): boolean {
    const normalizedPrompt = this.normalizeLane(promptLane);
    const normalizedCriteria = this.normalizeLane(criteriaLane);
    return normalizedPrompt === normalizedCriteria || promptLane === 'shared';
  }

  /**
   * Normalize lane names
   */
  private normalizeLane(lane: Lane): string {
    if (lane === 'A' || lane === 'lane_a') return 'lane_a';
    if (lane === 'B' || lane === 'lane_b') return 'lane_b';
    return lane;
  }

  /**
   * Get prompts optimized for budget constraints
   */
  selectForBudget(
    lane: Lane,
    budgetState: BudgetState,
    completedPromptIds: string[] = []
  ): SelectionResult {
    // Calculate remaining budget as a score (1-10 scale)
    const tokenRatio = budgetState.total_tokens_used / budgetState.max_total_tokens;
    const costRatio = budgetState.total_cost_used / budgetState.max_total_cost;
    const maxRatio = Math.max(tokenRatio, costRatio);

    // Convert to cost score limit (lower remaining budget = lower max cost score)
    const maxCostScore = Math.max(1, Math.round((1 - maxRatio) * 10));

    return this.selectPrompts({
      lane,
      max_cost_score: maxCostScore,
      completed_prompt_ids: completedPromptIds,
    });
  }

  /**
   * Get high-value prompts only
   */
  selectHighValue(lane: Lane, minValueScore: number = 8): SelectionResult {
    return this.selectPrompts({
      lane,
      min_value_score: minValueScore,
    });
  }

  /**
   * Get statistics about loaded prompts
   */
  getStats(): {
    total: number;
    byLane: Record<string, number>;
    byStage: Record<string, number>;
    avgValueScore: number;
    avgCostScore: number;
    avgRatio: number;
  } {
    const byLane: Record<string, number> = {};
    const byStage: Record<string, number> = {};
    let totalValue = 0;
    let totalCost = 0;
    let totalRatio = 0;

    for (const prompt of this.prompts) {
      byLane[prompt.lane] = (byLane[prompt.lane] || 0) + 1;
      byStage[prompt.stage] = (byStage[prompt.stage] || 0) + 1;
      totalValue += prompt.expected_value_score || 5;
      totalCost += prompt.expected_cost_score || 5;
      totalRatio += prompt.value_cost_ratio || 1;
    }

    const count = this.prompts.length || 1;

    return {
      total: this.prompts.length,
      byLane,
      byStage,
      avgValueScore: totalValue / count,
      avgCostScore: totalCost / count,
      avgRatio: totalRatio / count,
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let selectorInstance: PromptSelector | null = null;

export function getPromptSelector(): PromptSelector {
  if (!selectorInstance) {
    selectorInstance = new PromptSelector();
  }
  return selectorInstance;
}

export function resetPromptSelector(): void {
  selectorInstance = null;
}
