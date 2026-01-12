/**
 * ARC Investment Factory - Prompt Library Types
 * 
 * Core type definitions for the prompt orchestration system.
 * These types define the contract for prompts, execution, and telemetry.
 */

import { z } from 'zod';

// ============================================================================
// EXECUTOR TYPES
// ============================================================================

export type ExecutorType = 'llm' | 'code' | 'hybrid';
export type Lane = 'A' | 'B' | 'lane_a' | 'lane_b' | 'monitoring' | 'portfolio' | 'shared';
export type PipelineStage = 'discovery' | 'screening' | 'research' | 'synthesis' | 'qa';
export type Criticality = 'blocker' | 'optional';
export type ExecutionStatus = 'success' | 'skipped' | 'failed' | 'quarantined';

// ============================================================================
// LLM CONFIG
// ============================================================================

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'perplexity';
  model: string;
  temperature: number;
  max_tokens: number;
}

// ============================================================================
// BUDGET CONFIG
// ============================================================================

export interface BudgetConfig {
  max_tokens: number;
  max_cost?: number;
}

// ============================================================================
// CACHE POLICY
// ============================================================================

export interface CachePolicy {
  ttl_seconds: number;
  cache_key_template: string;
}

// ============================================================================
// DEGRADATION POLICY
// ============================================================================

export type DegradationAction = 
  | 'fail' 
  | 'skip' 
  | 'skip_with_warning' 
  | 'quarantine' 
  | 'use_fallback';

export interface DegradationPolicy {
  on_source_failure: DegradationAction;
  on_validation_failure: DegradationAction;
}

// ============================================================================
// PROMPT DEFINITION
// ============================================================================

export interface PromptDefinition {
  prompt_id: string;
  version: string;
  title: string;
  executor_type: ExecutorType;
  lane: Lane;
  stage: string;
  category?: string;
  tags?: string[];
  llm_config?: LLMConfig;
  code_function?: string;
  inputs_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  required_sources: string[];
  criticality: Criticality;
  budget: BudgetConfig;
  cache_policy: CachePolicy;
  degradation_policy: DegradationPolicy;
  template: string;
  pre_process_function?: string;
  post_process_function?: string;
}

// ============================================================================
// PROMPT LIBRARY
// ============================================================================

export interface PromptLibrary {
  version: string;
  prompts: PromptDefinition[];
}

// ============================================================================
// EXECUTION CONTEXT
// ============================================================================

export interface ExecutionContext {
  run_id: string;
  pipeline_id: string;
  lane: Lane;
  stage?: PipelineStage;
  ticker: string;
  idea_id?: string;
  date: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// SOURCE RESULT
// ============================================================================

export interface SourceResult {
  source: string;
  success: boolean;
  data?: unknown;
  error?: string;
  latency_ms: number;
  cached: boolean;
}

// ============================================================================
// EXECUTION INPUT
// ============================================================================

export interface ExecutionInput {
  prompt: PromptDefinition;
  context: ExecutionContext;
  sources_data: Record<string, unknown>;
}

// ============================================================================
// EXECUTION OUTPUT
// ============================================================================

export interface ExecutionOutput {
  success: boolean;
  data?: unknown;
  raw_output?: string;
  validation_pass: boolean;
  validation_errors?: string[];
  tokens_in?: number;
  tokens_out?: number;
  cost_estimate?: number;
  latency_ms: number;
}

// ============================================================================
// TELEMETRY RECORD
// ============================================================================

export interface TelemetryRecord {
  id?: string;
  run_id: string;
  pipeline_id: string;
  lane: Lane;
  stage: string;
  prompt_id: string;
  prompt_version: string;
  executor_type: ExecutorType;
  model_name?: string;
  temperature?: number;
  max_tokens?: number;
  input_hash: string;
  cache_hit: boolean;
  sources_requested: string[];
  sources_succeeded: string[];
  sources_failed: Array<{ source: string; reason: string }>;
  validation_pass: boolean;
  validation_errors?: string[];
  start_ts: Date;
  end_ts?: Date;
  latency_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
  cost_estimate?: number;
  status: ExecutionStatus;
  skip_reason?: string;
}

// ============================================================================
// QUARANTINE RECORD
// ============================================================================

export interface QuarantineRecord {
  id?: string;
  run_id: string;
  prompt_id: string;
  prompt_version: string;
  input_hash: string;
  raw_output: string;
  validation_errors: string[];
  context: Record<string, unknown>;
  created_at: Date;
}

// ============================================================================
// BUDGET STATE
// ============================================================================

export interface BudgetState {
  run_id: string;
  total_tokens_used: number;
  total_cost_used: number;
  total_time_ms: number;
  max_total_tokens: number;
  max_total_cost: number;
  max_total_time_ms: number;
  is_exceeded: boolean;
  exceeded_reason?: string;
}

// ============================================================================
// CACHE ENTRY
// ============================================================================

export interface CacheEntry {
  key: string;
  prompt_id: string;
  prompt_version: string;
  input_hash: string;
  output: unknown;
  created_at: Date;
  expires_at: Date;
}

// ============================================================================
// ORCHESTRATOR CONFIG
// ============================================================================

export interface OrchestratorConfig {
  use_prompt_library: boolean;
  budget: {
    max_total_tokens: number;
    max_total_cost: number;
    max_total_time_seconds: number;
  };
  cache: {
    enabled: boolean;
    default_ttl_seconds: number;
  };
  telemetry: {
    enabled: boolean;
    log_to_console: boolean;
  };
  degradation: {
    continue_on_optional_failure: boolean;
    quarantine_invalid_outputs: boolean;
  };
}

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

export const PromptDefinitionSchema = z.object({
  prompt_id: z.string().min(1),
  version: z.string().min(1),
  title: z.string().min(1),
  executor_type: z.enum(['llm', 'code', 'hybrid']),
  lane: z.enum(['A', 'B', 'lane_a', 'lane_b', 'monitoring', 'portfolio', 'shared']),
  stage: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  llm_config: z.object({
    provider: z.enum(['openai', 'anthropic', 'perplexity']),
    model: z.string(),
    temperature: z.number().min(0).max(2),
    max_tokens: z.number().positive(),
  }).optional(),
  code_function: z.string().optional(),
  inputs_schema: z.record(z.unknown()),
  output_schema: z.record(z.unknown()),
  required_sources: z.array(z.string()),
  criticality: z.enum(['blocker', 'optional']),
  budget: z.object({
    max_tokens: z.number().positive(),
    max_cost: z.number().positive().optional(),
  }),
  cache_policy: z.object({
    ttl_seconds: z.number().nonnegative(),
    cache_key_template: z.string(),
  }),
  degradation_policy: z.object({
    on_source_failure: z.enum(['fail', 'skip', 'skip_with_warning', 'quarantine', 'use_fallback']),
    on_validation_failure: z.enum(['fail', 'skip', 'skip_with_warning', 'quarantine', 'use_fallback']),
  }),
  template: z.string().min(1),
  pre_process_function: z.string().optional(),
  post_process_function: z.string().optional(),
});

export const PromptLibrarySchema = z.object({
  version: z.string(),
  prompts: z.array(PromptDefinitionSchema),
});

// ============================================================================
// ORCHESTRATION RESULT
// ============================================================================

export interface OrchestrationResult {
  run_id: string;
  success: boolean;
  outputs: Record<string, ExecutionOutput>;
  telemetry: TelemetryRecord[];
  budget_state: BudgetState;
  total_latency_ms: number;
  sources_succeeded: string[];
  sources_failed: Array<{ source: string; reason: string }>;
}
