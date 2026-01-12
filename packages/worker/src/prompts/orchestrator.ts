/**
 * ARC Investment Factory - Prompt Orchestrator
 * 
 * Central coordinator for prompt execution.
 * Integrates all components: Library, DataHub, Executor, Validator,
 * Telemetry, Budget, and Quarantine.
 */

import { randomUUID } from 'crypto';
import {
  type PromptDefinition,
  type ExecutionContext,
  type ExecutionOutput,
  type TelemetryRecord,
  type ExecutionStatus,
  type OrchestrationResult,
  type BudgetState,
  type Lane,
} from './types.js';
import { getPromptLibraryLoader, type PromptLibraryLoader } from './library-loader.js';
import { getPromptExecutor, type PromptExecutor } from './executor.js';
import { getSchemaValidator, type SchemaValidator } from './schema-validator.js';
import { getDataRetrieverHub, type DataRetrieverHub } from '@arc/retriever';
import { getTelemetryStore, type TelemetryStore } from '../telemetry/store.js';
import { getBudgetController, type BudgetController } from '../budget/controller.js';
import { getQuarantineStore, type QuarantineStore } from '../quarantine/store.js';
import { getPromptSelector, type PromptSelector } from './selector.js';

// ============================================================================
// ORCHESTRATOR CONFIG
// ============================================================================

export interface OrchestratorConfig {
  enable_telemetry: boolean;
  enable_budget_control: boolean;
  enable_quarantine: boolean;
  enable_cache: boolean;
  dry_run: boolean;
  budget_config?: {
    max_total_tokens?: number;
    max_total_cost?: number;
    max_total_time_seconds?: number;
  };
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  enable_telemetry: true,
  enable_budget_control: true,
  enable_quarantine: true,
  enable_cache: true,
  dry_run: false,
  budget_config: {
    max_total_tokens: 500000,
    max_total_cost: 10.0,
    max_total_time_seconds: 300,
  },
};

// ============================================================================
// PROMPT ORCHESTRATOR
// ============================================================================

export class PromptOrchestrator {
  private config: OrchestratorConfig;
  private library: PromptLibraryLoader;
  private executor: PromptExecutor;
  private validator: SchemaValidator;
  private dataHub: DataRetrieverHub;
  private telemetry: TelemetryStore;
  private budget: BudgetController;
  private quarantine: QuarantineStore;
  private selector: PromptSelector;
  private initialized: boolean = false;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.library = getPromptLibraryLoader();
    this.executor = getPromptExecutor();
    this.validator = getSchemaValidator();
    this.dataHub = getDataRetrieverHub();
    this.telemetry = getTelemetryStore();
    this.budget = getBudgetController();
    this.quarantine = getQuarantineStore();
    this.selector = getPromptSelector();
  }

  /**
   * Initialize the orchestrator with the prompt library
   */
  async initialize(): Promise<void> {
    if (!this.library.isLoaded()) {
      this.library.load();
    }
    
    // Load prompts into selector for value-based selection
    const allPrompts = this.library.listAll();
    this.selector.loadPrompts(allPrompts);
    
    this.initialized = true;
    console.log(`[PromptOrchestrator] Initialized with ${allPrompts.length} prompts`);
  }

  /**
   * Execute a single prompt by ID
   */
  async executePrompt(
    promptId: string,
    context: ExecutionContext,
    additionalData?: Record<string, unknown>
  ): Promise<ExecutionOutput> {
    const startTime = new Date();
    
    // Get prompt definition
    const prompt = this.library.getById(promptId);
    if (!prompt) {
      return this.createErrorOutput(`Prompt not found: ${promptId}`, startTime);
    }

    // Check budget
    if (this.config.enable_budget_control) {
      const budgetState = this.budget.getBudgetState(context.run_id);
      if (budgetState?.is_exceeded) {
        return this.createErrorOutput(
          `Budget exceeded: ${budgetState.exceeded_reason}`,
          startTime
        );
      }
    }

    // Fetch required data
    const { data, succeeded, failed } = await this.fetchRequiredData(prompt, context);
    
    // Merge with additional data
    const inputData = { ...data, ...additionalData };

    // Execute the prompt
    const output = await this.executor.execute(prompt, inputData);

    // Validate output
    if (output.success && output.data) {
      const validationResult = this.validator.validate(prompt, output.data);
      output.validation_pass = validationResult.valid;
      output.validation_errors = validationResult.errors;

      // Quarantine if validation failed
      if (!validationResult.valid && this.config.enable_quarantine) {
        await this.quarantine.add({
          run_id: context.run_id,
          prompt_id: prompt.prompt_id,
          prompt_version: prompt.version,
          input_hash: this.hashInput(inputData),
          raw_output: output.raw_output || JSON.stringify(output.data),
          validation_errors: validationResult.errors,
          context: context as unknown as Record<string, unknown>,
        });
      }
    }

    // Record telemetry
    if (this.config.enable_telemetry) {
      await this.telemetry.record({
        run_id: context.run_id,
        pipeline_id: context.pipeline_id,
        lane: context.lane,
        stage: context.stage || 'unknown',
        prompt_id: prompt.prompt_id,
        prompt_version: prompt.version,
        executor_type: prompt.executor_type,
        model_name: prompt.llm_config?.model,
        temperature: prompt.llm_config?.temperature,
        max_tokens: prompt.llm_config?.max_tokens,
        input_hash: this.hashInput(inputData),
        cache_hit: false,
        sources_requested: prompt.required_sources,
        sources_succeeded: succeeded,
        sources_failed: failed,
        validation_pass: output.validation_pass,
        validation_errors: output.validation_errors,
        start_ts: startTime,
        end_ts: new Date(),
        latency_ms: output.latency_ms,
        tokens_in: output.tokens_in,
        tokens_out: output.tokens_out,
        cost_estimate: output.cost_estimate,
        status: this.determineStatus(output),
      });
    }

    // Update budget
    if (this.config.enable_budget_control) {
      this.budget.recordUsage(context.run_id, {
        tokens_in: output.tokens_in,
        tokens_out: output.tokens_out,
        cost: output.cost_estimate,
        latency_ms: output.latency_ms,
      });
    }

    return output;
  }

  /**
   * Execute Lane A discovery pipeline
   */
  async executeLaneA(
    ticker: string,
    date?: string
  ): Promise<OrchestrationResult> {
    const runId = randomUUID();
    const startTime = new Date();
    const outputs: Record<string, ExecutionOutput> = {};
    const telemetryRecords: TelemetryRecord[] = [];

    // Initialize budget for this run
    if (this.config.enable_budget_control) {
      this.budget.initRun(runId, {
        max_total_tokens: this.config.budget_config?.max_total_tokens || 500000,
        max_total_cost: this.config.budget_config?.max_total_cost || 10.0,
        max_total_time_seconds: this.config.budget_config?.max_total_time_seconds || 300,
      });
    }

    const context: ExecutionContext = {
      run_id: runId,
      pipeline_id: 'lane_a_discovery',
      lane: 'lane_a',
      stage: 'discovery',
      ticker,
      date: date || new Date().toISOString().split('T')[0],
    };

    // Use value-based prompt selection for Lane A
    const selectionResult = this.selector.selectPrompts({
      lane: 'lane_a',
      stage: 'discovery',
      completed_prompt_ids: [],
    });
    
    // Log selection results
    console.log(`[Lane A] Selected ${selectionResult.selected.length} prompts`);
    console.log(`[Lane A] Expected value: ${selectionResult.total_expected_value}, cost: ${selectionResult.total_expected_cost}`);
    if (selectionResult.skipped.length > 0) {
      console.log(`[Lane A] Skipped: ${selectionResult.skipped.map(s => s.prompt_id).join(', ')}`);
    }
    
    // Use execution order from selector (respects dependencies)
    const promptIds = selectionResult.execution_order.length > 0
      ? selectionResult.execution_order
      : ['gate_data_sufficiency', 'lane_a_idea_generation', 'gate_coherence'];

    // Execute prompts in sequence
    for (const promptId of promptIds) {
      try {
        const output = await this.executePrompt(promptId, context);
        outputs[promptId] = output;

        // Check for blocker failures
        const promptDef = this.library.getById(promptId);
        if (promptDef && promptDef.criticality === 'blocker' && !output.success) {
          break;
        }
      } catch (error) {
        outputs[promptId] = this.createErrorOutput(
          `Execution failed: ${(error as Error).message}`,
          startTime
        );
      }
    }

    const finalBudgetState = this.budget.getBudgetState(runId) || this.createEmptyBudgetState(runId);

    return {
      run_id: runId,
      success: Object.values(outputs).every((o) => o.success),
      outputs,
      telemetry: telemetryRecords,
      budget_state: finalBudgetState,
      total_latency_ms: Date.now() - startTime.getTime(),
      sources_succeeded: [],
      sources_failed: [],
    };
  }

  /**
   * Execute Lane B deep research pipeline
   */
  async executeLaneB(
    ticker: string,
    ideaId: string,
    date?: string
  ): Promise<OrchestrationResult> {
    const runId = randomUUID();
    const startTime = new Date();
    const outputs: Record<string, ExecutionOutput> = {};
    const telemetryRecords: TelemetryRecord[] = [];

    // Initialize budget for this run
    if (this.config.enable_budget_control) {
      this.budget.initRun(runId, {
        max_total_tokens: this.config.budget_config?.max_total_tokens || 500000,
        max_total_cost: this.config.budget_config?.max_total_cost || 10.0,
        max_total_time_seconds: this.config.budget_config?.max_total_time_seconds || 300,
      });
    }

    const context: ExecutionContext = {
      run_id: runId,
      pipeline_id: 'lane_b_research',
      lane: 'lane_b',
      stage: 'research',
      ticker,
      idea_id: ideaId,
      date: date || new Date().toISOString().split('T')[0],
    };

    // Use value-based prompt selection for Lane B
    const currentBudget = this.budget.getBudgetState(runId);
    const selectionResult = currentBudget
      ? this.selector.selectForBudget('lane_b', currentBudget, [])
      : this.selector.selectPrompts({
          lane: 'lane_b',
          completed_prompt_ids: [],
        });
    
    // Log selection results
    console.log(`[Lane B] Selected ${selectionResult.selected.length} prompts for ${ticker}`);
    console.log(`[Lane B] Expected value: ${selectionResult.total_expected_value}, cost: ${selectionResult.total_expected_cost}`);
    if (selectionResult.skipped.length > 0) {
      console.log(`[Lane B] Skipped ${selectionResult.skipped.length} prompts due to constraints`);
    }
    
    // Use execution order from selector (respects dependencies and value)
    const promptIds = selectionResult.execution_order.length > 0
      ? selectionResult.execution_order
      : [
          'gate_data_sufficiency',
          'business_model_analysis',
          'industry_moat_analysis',
          'financial_forensics_analysis',
          'capital_allocation_analysis',
          'management_quality_analysis',
          'valuation_analysis',
          'risk_assessment',
          'investment_thesis_synthesis',
          'gate_style_fit',
        ];

    // Execute prompts in sequence
    for (const promptId of promptIds) {
      try {
        const output = await this.executePrompt(promptId, context);
        outputs[promptId] = output;

        // Check for blocker failures
        const promptDef = this.library.getById(promptId);
        if (promptDef && promptDef.criticality === 'blocker' && !output.success) {
          break;
        }
      } catch (error) {
        outputs[promptId] = this.createErrorOutput(
          `Execution failed: ${(error as Error).message}`,
          startTime
        );
      }
    }

    const laneBBudgetState = this.budget.getBudgetState(runId) || this.createEmptyBudgetState(runId);

    return {
      run_id: runId,
      success: Object.values(outputs).every((o) => o.success),
      outputs,
      telemetry: telemetryRecords,
      budget_state: laneBBudgetState,
      total_latency_ms: Date.now() - startTime.getTime(),
      sources_succeeded: [],
      sources_failed: [],
    };
  }

  /**
   * Fetch required data for a prompt
   */
  private async fetchRequiredData(
    prompt: PromptDefinition,
    context: ExecutionContext
  ): Promise<{
    data: Record<string, unknown>;
    succeeded: string[];
    failed: Array<{ source: string; reason: string }>;
  }> {
    const data: Record<string, unknown> = {};
    const succeeded: string[] = [];
    const failed: Array<{ source: string; reason: string }> = [];

    if (!prompt.required_sources || prompt.required_sources.length === 0) {
      return { data, succeeded, failed };
    }

    // Determine which data to fetch based on lane
    // Fetch data based on lane requirements
    if (context.lane === 'lane_a' || context.lane === 'A' || context.lane === 'lane_b' || context.lane === 'B') {
      try {
        const fullData = await this.dataHub.getFullCompanyData(context.ticker);
        if (fullData.success && fullData.data) {
          data['profile'] = fullData.data.profile;
          data['metrics'] = fullData.data.metrics;
          data['prices'] = fullData.data.prices;
          data['news'] = fullData.data.news;
          succeeded.push('FMP', 'Polygon');
        }
      } catch (error) {
        failed.push({ source: 'FMP', reason: 'Failed to fetch company data' });
        console.error('[Orchestrator] Failed to fetch company data:', error);
      }
    }

    return { data, succeeded, failed };
  }

  /**
   * Create an error output
   */
  private createErrorOutput(error: string, startTime: Date): ExecutionOutput {
    return {
      success: false,
      validation_pass: false,
      validation_errors: [error],
      latency_ms: Date.now() - startTime.getTime(),
    };
  }

  /**
   * Create an empty budget state
   */
  private createEmptyBudgetState(runId: string): BudgetState {
    return {
      run_id: runId,
      total_tokens_used: 0,
      total_cost_used: 0,
      total_time_ms: 0,
      max_total_tokens: this.config.budget_config?.max_total_tokens || 500000,
      max_total_cost: this.config.budget_config?.max_total_cost || 10.0,
      max_total_time_ms: (this.config.budget_config?.max_total_time_seconds || 300) * 1000,
      is_exceeded: false,
    };
  }

  /**
   * Determine execution status from output
   */
  private determineStatus(output: ExecutionOutput): ExecutionStatus {
    if (!output.success) return 'failed';
    if (!output.validation_pass) return 'quarantined';
    return 'success';
  }

  /**
   * Hash input data for caching and telemetry
   */
  private hashInput(data: Record<string, unknown>): string {
    const str = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get orchestrator statistics
   */
  async getStats(): Promise<{
    telemetry: unknown;
    quarantine: unknown;
    activeBudgets: number;
    libraryPrompts: number;
    dataSourceStatus: unknown;
  }> {
    return {
      telemetry: await this.telemetry.getStats(),
      quarantine: await this.quarantine.getStats(),
      activeBudgets: this.budget.getActiveBudgets().length,
      libraryPrompts: this.library.getStats().total,
      dataSourceStatus: this.dataHub.getSourceStatus(),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if orchestrator is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let orchestratorInstance: PromptOrchestrator | null = null;

export function getPromptOrchestrator(config?: Partial<OrchestratorConfig>): PromptOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new PromptOrchestrator(config);
  }
  return orchestratorInstance;
}

export function resetPromptOrchestrator(): void {
  orchestratorInstance = null;
}
