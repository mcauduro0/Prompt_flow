/**
 * ARC Investment Factory - DAG Runner
 * Generic DAG execution engine with error handling and logging
 */

export interface DAGNode {
  id: string;
  name: string;
  dependencies: string[];
  execute: (context: DAGContext) => Promise<void>;
  timeout?: number; // ms
  retries?: number;
}

export interface DAGContext {
  runId: string;
  runType: string;
  startTime: Date;
  data: Record<string, unknown>;
  errors: Array<{ nodeId: string; error: string; timestamp: Date }>;
  completedNodes: Set<string>;
}

export interface DAGRunResult {
  runId: string;
  runType: string;
  status: 'completed' | 'failed' | 'partial';
  startTime: Date;
  endTime: Date;
  durationMs: number;
  completedNodes: string[];
  failedNodes: string[];
  errors: Array<{ nodeId: string; error: string; timestamp: Date }>;
  data: Record<string, unknown>;
}

export class DAGRunner {
  private nodes: Map<string, DAGNode> = new Map();
  private runType: string;

  constructor(runType: string) {
    this.runType = runType;
  }

  /**
   * Add a node to the DAG
   */
  addNode(node: DAGNode): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Add multiple nodes
   */
  addNodes(nodes: DAGNode[]): void {
    for (const node of nodes) {
      this.addNode(node);
    }
  }

  /**
   * Validate DAG structure (no cycles, all dependencies exist)
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check all dependencies exist
    for (const [id, node] of this.nodes) {
      for (const dep of node.dependencies) {
        if (!this.nodes.has(dep)) {
          errors.push(`Node "${id}" has unknown dependency "${dep}"`);
        }
      }
    }

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          if (!visited.has(dep)) {
            if (hasCycle(dep)) return true;
          } else if (recursionStack.has(dep)) {
            return true;
          }
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (hasCycle(nodeId)) {
          errors.push(`Cycle detected involving node "${nodeId}"`);
          break;
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get topologically sorted execution order
   */
  getExecutionOrder(): string[] {
    const order: string[] = [];
    const visited = new Set<string>();

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          visit(dep);
        }
      }

      order.push(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      visit(nodeId);
    }

    return order;
  }

  /**
   * Execute the DAG
   */
  async run(initialData: Record<string, unknown> = {}): Promise<DAGRunResult> {
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Invalid DAG: ${validation.errors.join(', ')}`);
    }

    const runId = crypto.randomUUID();
    const startTime = new Date();
    const context: DAGContext = {
      runId,
      runType: this.runType,
      startTime,
      data: { ...initialData },
      errors: [],
      completedNodes: new Set(),
    };

    const executionOrder = this.getExecutionOrder();
    const failedNodes: string[] = [];

    console.log(`[DAG] Starting ${this.runType} run ${runId}`);
    console.log(`[DAG] Execution order: ${executionOrder.join(' -> ')}`);

    for (const nodeId of executionOrder) {
      const node = this.nodes.get(nodeId)!;

      // Check if all dependencies completed successfully
      const depsFailed = node.dependencies.some(
        (dep) => !context.completedNodes.has(dep)
      );

      if (depsFailed) {
        console.log(`[DAG] Skipping ${nodeId} due to failed dependencies`);
        failedNodes.push(nodeId);
        context.errors.push({
          nodeId,
          error: 'Skipped due to failed dependencies',
          timestamp: new Date(),
        });
        continue;
      }

      // Execute node with retries
      const maxRetries = node.retries ?? 1;
      let success = false;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[DAG] Executing ${nodeId} (attempt ${attempt}/${maxRetries})`);
          
          // Execute with timeout if specified
          if (node.timeout) {
            await Promise.race([
              node.execute(context),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), node.timeout)
              ),
            ]);
          } else {
            await node.execute(context);
          }

          context.completedNodes.add(nodeId);
          success = true;
          console.log(`[DAG] Completed ${nodeId}`);
          break;
        } catch (error) {
          const errorMsg = (error as Error).message;
          console.error(`[DAG] Failed ${nodeId} (attempt ${attempt}): ${errorMsg}`);

          if (attempt === maxRetries) {
            context.errors.push({
              nodeId,
              error: errorMsg,
              timestamp: new Date(),
            });
            failedNodes.push(nodeId);
          } else {
            // Wait before retry (exponential backoff)
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
            );
          }
        }
      }
    }

    const endTime = new Date();
    const status = failedNodes.length === 0
      ? 'completed'
      : context.completedNodes.size === 0
        ? 'failed'
        : 'partial';

    const result: DAGRunResult = {
      runId,
      runType: this.runType,
      status,
      startTime,
      endTime,
      durationMs: endTime.getTime() - startTime.getTime(),
      completedNodes: Array.from(context.completedNodes),
      failedNodes,
      errors: context.errors,
      data: context.data,
    };

    console.log(`[DAG] ${this.runType} run ${runId} ${status} in ${result.durationMs}ms`);

    return result;
  }
}

/**
 * Create a new DAG runner
 */
export function createDAGRunner(runType: string): DAGRunner {
  return new DAGRunner(runType);
}
