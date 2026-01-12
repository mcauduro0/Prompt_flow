/**
 * ARC Investment Factory - Prompt System Tests
 * 
 * Unit and integration tests for the prompt library system.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getPromptLibraryLoader,
  resetPromptLibraryLoader,
  getSchemaValidator,
  resetSchemaValidator,
  getBudgetController,
  resetBudgetController,
  getQuarantineStore,
  resetQuarantineStore,
  getTelemetryStore,
  resetTelemetryStore,
  registerCodeFunction,
  getCodeFunction,
} from '../index';

// ============================================================================
// PROMPT LIBRARY LOADER TESTS
// ============================================================================

describe('PromptLibraryLoader', () => {
  beforeEach(() => {
    resetPromptLibraryLoader();
  });

  it('should load prompts from JSON', () => {
    const loader = getPromptLibraryLoader();
    
    // Load the actual prompts.json
    const result = loader.load();
    
    // Skip if library not found (CI environment)
    if (!result.success) {
      console.log('Skipping test - library not found:', result.errors);
      return;
    }
    
    const prompts = loader.listAll();
    expect(prompts.length).toBeGreaterThan(0);
  });

  it('should get prompt by ID', () => {
    const loader = getPromptLibraryLoader();
    const result = loader.load();
    
    // Skip if library not found
    if (!result.success) {
      console.log('Skipping test - library not found');
      return;
    }
    
    const prompt = loader.getById('lane_a_idea_generation');
    expect(prompt).toBeDefined();
    expect(prompt?.name).toBe('Lane A Idea Generation');
    expect(prompt?.executor_type).toBe('llm');
  });

  it('should filter prompts by lane', () => {
    const loader = getPromptLibraryLoader();
    const result = loader.load();
    
    // Skip if library not found
    if (!result.success) {
      console.log('Skipping test - library not found');
      return;
    }
    
    const laneAPrompts = loader.getByLane('lane_a');
    expect(laneAPrompts.length).toBeGreaterThan(0);
    expect(laneAPrompts.every(p => p.lane === 'lane_a')).toBe(true);
  });

  it('should filter prompts by category', () => {
    const loader = getPromptLibraryLoader();
    const result = loader.load();
    
    // Skip if library not found
    if (!result.success) {
      console.log('Skipping test - library not found');
      return;
    }
    
    const gatePrompts = loader.query({ category: 'gates' });
    expect(gatePrompts.length).toBeGreaterThan(0);
    expect(gatePrompts.every(p => p.category === 'gates')).toBe(true);
  });

  it('should validate prompt metadata', () => {
    const loader = getPromptLibraryLoader();
    const result = loader.load();
    
    // Skip if library not found (CI environment)
    if (!result.success) {
      console.log('Skipping test - library not found');
      return;
    }
    
    // Verify prompts have required fields
    const prompts = loader.listAll();
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.every(p => p.prompt_id && p.name && p.lane)).toBe(true);
  });
});

// ============================================================================
// SCHEMA VALIDATOR TESTS
// ============================================================================

describe('SchemaValidator', () => {
  beforeEach(() => {
    resetSchemaValidator();
  });

  it('should validate correct output', () => {
    const validator = getSchemaValidator();
    
    const prompt = {
      prompt_id: 'test',
      output_schema: {
        type: 'object',
        properties: {
          hasInvestmentPotential: { type: 'boolean' },
          thesis: { type: 'string' },
          conviction: { type: 'number', minimum: 1, maximum: 10 },
        },
        required: ['hasInvestmentPotential', 'thesis', 'conviction'],
      },
    };
    
    const validOutput = {
      hasInvestmentPotential: true,
      thesis: 'This is a valid thesis',
      conviction: 8,
    };
    
    const result = validator.validate(prompt as any, validOutput);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid output', () => {
    const validator = getSchemaValidator();
    
    const prompt = {
      prompt_id: 'test',
      output_schema: {
        type: 'object',
        properties: {
          hasInvestmentPotential: { type: 'boolean' },
          conviction: { type: 'number', minimum: 1, maximum: 10 },
        },
        required: ['hasInvestmentPotential', 'conviction'],
      },
    };
    
    const invalidOutput = {
      hasInvestmentPotential: 'not a boolean', // Wrong type
      conviction: 15, // Out of range
    };
    
    const result = validator.validate(prompt as any, invalidOutput);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// BUDGET CONTROLLER TESTS
// ============================================================================

describe('BudgetController', () => {
  beforeEach(() => {
    resetBudgetController();
  });

  it('should initialize run budget', () => {
    const budget = getBudgetController();
    
    budget.initRun('test-run-1', {
      max_total_tokens: 100000,
      max_total_cost: 10.0,
    });
    
    const state = budget.getBudgetState('test-run-1');
    expect(state).toBeDefined();
    expect(state?.total_tokens_used).toBe(0);
    expect(state?.total_cost_used).toBe(0);
  });

  it('should track usage', () => {
    const budget = getBudgetController();
    
    budget.initRun('test-run-2', {
      max_total_tokens: 100000,
    });
    
    budget.recordUsage('test-run-2', {
      tokens_in: 1000,
      tokens_out: 500,
      cost: 0.05,
      latency_ms: 1500,
    });
    
    const state = budget.getBudgetState('test-run-2');
    expect(state?.total_tokens_used).toBe(1500);
    expect(state?.total_cost_used).toBe(0.05);
  });

  it('should enforce budget limits', () => {
    const budget = getBudgetController();
    
    budget.initRun('test-run-3', {
      max_total_tokens: 1000,
    });
    
    budget.recordUsage('test-run-3', {
      tokens_in: 800,
      tokens_out: 300,
      latency_ms: 100,
    });
    
    const canExecute = budget.canExecuteLLM('test-run-3');
    expect(canExecute.allowed).toBe(false);
    expect(canExecute.reason).toContain('token');
  });
});

// ============================================================================
// QUARANTINE STORE TESTS
// ============================================================================

describe('QuarantineStore', () => {
  beforeEach(() => {
    resetQuarantineStore();
  });

  afterEach(() => {
    const store = getQuarantineStore();
    store.shutdown();
    resetQuarantineStore();
  });

  it('should add items to quarantine', async () => {
    const quarantine = getQuarantineStore();
    
    await quarantine.add({
      run_id: 'test-run',
      prompt_id: 'test-prompt',
      prompt_version: '1.0.0',
      raw_output: '{"invalid": json}',
      validation_errors: ['Invalid JSON'],
      context: { ticker: 'AAPL' },
      sources_data: {},
    });
    
    const stats = await quarantine.getStats();
    expect(stats.total).toBe(1);
  });

  it('should retrieve quarantined items', async () => {
    const quarantine = getQuarantineStore();
    
    await quarantine.add({
      run_id: 'test-run-1',
      prompt_id: 'prompt-a',
      prompt_version: '1.0.0',
      raw_output: 'bad output 1',
      validation_errors: ['Error 1'],
      context: {},
      sources_data: {},
    });
    
    await quarantine.add({
      run_id: 'test-run-2',
      prompt_id: 'prompt-a',
      prompt_version: '1.0.0',
      raw_output: 'bad output 2',
      validation_errors: ['Error 2'],
      context: {},
      sources_data: {},
    });
    
    const items = await quarantine.getByPromptId('prompt-a');
    expect(items.length).toBe(2);
  });
});

// ============================================================================
// TELEMETRY STORE TESTS
// ============================================================================

describe('TelemetryStore', () => {
  beforeEach(() => {
    resetTelemetryStore();
  });

  it('should record telemetry', async () => {
    const telemetry = getTelemetryStore();
    
    await telemetry.record({
      run_id: 'test-run',
      prompt_id: 'test-prompt',
      prompt_version: '1.0.0',
      lane: 'lane_a',
      stage: 'discovery',
      ticker: 'AAPL',
      status: 'success',
      start_ts: new Date(Date.now() - 1000),
      end_ts: new Date(),
      latency_ms: 1000,
      tokens_in: 500,
      tokens_out: 200,
      cost_estimate: 0.02,
      cache_hit: false,
      sources_succeeded: ['fmp', 'polygon'],
      sources_failed: [],
      input_hash: 'abc123',
    });
    
    const stats = await telemetry.getStats();
    expect(stats.total).toBe(1);
  });

  it('should calculate statistics', async () => {
    const telemetry = getTelemetryStore();
    
    // Record multiple executions
    for (let i = 0; i < 5; i++) {
      await telemetry.record({
        run_id: `run-${i}`,
        prompt_id: 'test-prompt',
        prompt_version: '1.0.0',
        lane: 'lane_a',
        stage: 'discovery',
        ticker: 'AAPL',
        status: i < 4 ? 'success' : 'failed',
        start_ts: new Date(),
        end_ts: new Date(),
        latency_ms: 1000 + i * 100,
        tokens_in: 500,
        tokens_out: 200,
        cost_estimate: 0.02,
        cache_hit: false,
        sources_succeeded: [],
        sources_failed: [],
        input_hash: `hash-${i}`,
      });
    }
    
    const stats = await telemetry.getStats();
    expect(stats.total).toBe(5);
    expect(stats.failureRate).toBeCloseTo(0.2, 1); // 1/5
  });
});

// ============================================================================
// CODE FUNCTIONS TESTS
// ============================================================================

describe('CodeFunctions', () => {
  it('should register and retrieve code functions', () => {
    registerCodeFunction('test_function', async (data) => ({
      result: data.input * 2,
    }));
    
    const fn = getCodeFunction('test_function');
    expect(fn).toBeDefined();
  });

  it('should execute registered code functions', async () => {
    registerCodeFunction('double', async (data) => ({
      doubled: data.value * 2,
    }));
    
    const fn = getCodeFunction('double');
    const result = await fn!({ value: 5 });
    expect(result.doubled).toBe(10);
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration', () => {
  beforeEach(() => {
    resetPromptLibraryLoader();
    resetSchemaValidator();
    resetBudgetController();
    resetQuarantineStore();
    resetTelemetryStore();
  });

  it('should load library and validate prompts have correct structure', () => {
    const loader = getPromptLibraryLoader();
    loader.load();
    
    const prompts = loader.listAll();
    
    for (const prompt of prompts) {
      expect(prompt).toBeDefined();
      expect(prompt.prompt_id).toBeDefined();
      expect(prompt.name).toBeDefined();
      expect(prompt.version).toBeDefined();
      expect(prompt.executor_type).toMatch(/^(llm|code|hybrid)$/);
      
      // LLM prompts should have templates
      if (prompt.executor_type === 'llm') {
        expect(prompt.template).toBeDefined();
        expect(prompt.llm_config).toBeDefined();
      }
      
      // Code prompts should have code_function
      if (prompt.executor_type === 'code') {
        expect(prompt.code_function).toBeDefined();
      }
    }
  });

  it('should validate all gate prompts have correct output schema', () => {
    const loader = getPromptLibraryLoader();
    const validator = getSchemaValidator();
    
    loader.load();
    
    const gatePrompts = loader.query({ category: 'gates' });
    
    for (const gate of gatePrompts) {
      expect(gate.is_gate).toBe(true);
      expect(gate.output_schema).toBeDefined();
      
      // Gate outputs should have standard structure
      const schema = gate.output_schema;
      expect(schema.properties?.gate).toBeDefined();
      expect(schema.properties?.pass).toBeDefined();
      expect(schema.properties?.score).toBeDefined();
      expect(schema.properties?.errors).toBeDefined();
      expect(schema.properties?.warnings).toBeDefined();
      expect(schema.properties?.decision_reason).toBeDefined();
    }
  });
});
