/**
 * ARC Investment Factory - Prompt Selector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptSelector } from '../prompts/selector.js';
import type { PromptDefinition, Lane, Stage, BudgetState } from '../prompts/types.js';

describe('PromptSelector', () => {
  let selector: PromptSelector;

  const createMockPrompt = (overrides: Partial<PromptDefinition> = {}): PromptDefinition => ({
    prompt_id: 'test_prompt',
    version: '1.0.0',
    name: 'Test Prompt',
    description: 'A test prompt',
    lane: 'lane_a' as Lane,
    stage: 'research' as Stage,
    executor_type: 'llm',
    template: 'Test template',
    output_schema: {},
    required_data: [],
    expected_value_score: 5,
    expected_cost_score: 5,
    value_cost_ratio: 1,
    ...overrides,
  });

  beforeEach(() => {
    selector = new PromptSelector();
  });

  describe('loadPrompts', () => {
    it('should load prompts into the selector', () => {
      const prompts = [
        createMockPrompt({ prompt_id: 'prompt_1' }),
        createMockPrompt({ prompt_id: 'prompt_2' }),
      ];

      selector.loadPrompts(prompts);
      const stats = selector.getStats();
      expect(stats.total).toBe(2);
    });

    it('should clear existing prompts on reload', () => {
      selector.loadPrompts([createMockPrompt({ prompt_id: 'prompt_1' })]);
      selector.loadPrompts([createMockPrompt({ prompt_id: 'prompt_2' })]);
      const stats = selector.getStats();
      expect(stats.total).toBe(1);
    });
  });

  describe('selectPrompts', () => {
    it('should select prompts by lane and stage', () => {
      const prompts = [
        createMockPrompt({ prompt_id: 'lane_a_research', lane: 'lane_a', stage: 'research' }),
        createMockPrompt({ prompt_id: 'lane_a_synthesis', lane: 'lane_a', stage: 'synthesis' }),
        createMockPrompt({ prompt_id: 'lane_b_research', lane: 'lane_b', stage: 'research' }),
      ];

      selector.loadPrompts(prompts);
      const result = selector.selectPrompts({ lane: 'lane_a', stage: 'research' });

      expect(result.selected.length).toBe(1);
      expect(result.selected[0].prompt_id).toBe('lane_a_research');
    });

    it('should sort by value-cost ratio descending', () => {
      const prompts = [
        createMockPrompt({ prompt_id: 'low_ratio', lane: 'lane_a', stage: 'research', expected_value_score: 3, expected_cost_score: 9, value_cost_ratio: 0.33 }),
        createMockPrompt({ prompt_id: 'high_ratio', lane: 'lane_a', stage: 'research', expected_value_score: 9, expected_cost_score: 3, value_cost_ratio: 3 }),
        createMockPrompt({ prompt_id: 'mid_ratio', lane: 'lane_a', stage: 'research', expected_value_score: 6, expected_cost_score: 6, value_cost_ratio: 1 }),
      ];

      selector.loadPrompts(prompts);
      const result = selector.selectPrompts({ lane: 'lane_a', stage: 'research' });

      expect(result.selected[0].prompt_id).toBe('high_ratio');
      expect(result.selected[1].prompt_id).toBe('mid_ratio');
      expect(result.selected[2].prompt_id).toBe('low_ratio');
    });

    it('should filter by minimum value score', () => {
      const prompts = [
        createMockPrompt({ prompt_id: 'low_value', lane: 'lane_a', stage: 'research', expected_value_score: 3 }),
        createMockPrompt({ prompt_id: 'high_value', lane: 'lane_a', stage: 'research', expected_value_score: 9 }),
      ];

      selector.loadPrompts(prompts);
      const result = selector.selectPrompts({ lane: 'lane_a', stage: 'research', min_value_score: 5 });

      expect(result.selected.length).toBe(1);
      expect(result.selected[0].prompt_id).toBe('high_value');
    });

    it('should filter by maximum cost score', () => {
      const prompts = [
        createMockPrompt({ prompt_id: 'cheap', lane: 'lane_a', stage: 'research', expected_cost_score: 2 }),
        createMockPrompt({ prompt_id: 'expensive', lane: 'lane_a', stage: 'research', expected_cost_score: 8 }),
      ];

      selector.loadPrompts(prompts);
      const result = selector.selectPrompts({ lane: 'lane_a', stage: 'research', max_cost_score: 5 });

      expect(result.selected.length).toBe(1);
      expect(result.selected[0].prompt_id).toBe('cheap');
    });
  });

  describe('selectForBudget', () => {
    it('should select prompts within budget constraints', () => {
      const prompts = [
        createMockPrompt({ prompt_id: 'cheap_high_value', expected_value_score: 9, expected_cost_score: 2, value_cost_ratio: 4.5 }),
        createMockPrompt({ prompt_id: 'expensive_high_value', expected_value_score: 9, expected_cost_score: 9, value_cost_ratio: 1 }),
        createMockPrompt({ prompt_id: 'cheap_low_value', expected_value_score: 3, expected_cost_score: 1, value_cost_ratio: 3 }),
      ];

      selector.loadPrompts(prompts);
      
      const budgetState: BudgetState = {
        run_id: 'test',
        total_tokens_used: 80000,
        total_cost_used: 4.0,
        total_time_ms: 30000,
        max_total_tokens: 100000,
        max_total_cost: 5.0,
        max_total_time_ms: 60000,
        is_exceeded: false,
      };

      const result = selector.selectForBudget('lane_a', budgetState);

      // Should filter out expensive prompts when budget is low (80% used)
      expect(result.selected.some(p => p.prompt_id === 'cheap_high_value')).toBe(true);
    });

    it('should allow expensive prompts when budget is high', () => {
      const prompts = [
        createMockPrompt({ prompt_id: 'expensive_high_value', expected_value_score: 9, expected_cost_score: 9, value_cost_ratio: 1 }),
      ];

      selector.loadPrompts(prompts);
      
      const budgetState: BudgetState = {
        run_id: 'test',
        total_tokens_used: 10000,
        total_cost_used: 0.5,
        total_time_ms: 5000,
        max_total_tokens: 100000,
        max_total_cost: 5.0,
        max_total_time_ms: 60000,
        is_exceeded: false,
      };

      const result = selector.selectForBudget('lane_a', budgetState);

      expect(result.selected.length).toBe(1);
    });
  });

  describe('selectHighValue', () => {
    it('should filter by high value score', () => {
      const prompts = [
        createMockPrompt({ prompt_id: 'low_value', lane: 'lane_a', expected_value_score: 3 }),
        createMockPrompt({ prompt_id: 'high_value', lane: 'lane_a', expected_value_score: 9 }),
      ];

      selector.loadPrompts(prompts);
      const result = selector.selectHighValue('lane_a', 8);

      expect(result.selected.length).toBe(1);
      expect(result.selected[0].prompt_id).toBe('high_value');
    });
  });

  describe('getStats', () => {
    it('should calculate statistics', () => {
      const prompts = [
        createMockPrompt({ prompt_id: 'p1', lane: 'lane_a', stage: 'research', expected_value_score: 8, expected_cost_score: 4, value_cost_ratio: 2 }),
        createMockPrompt({ prompt_id: 'p2', lane: 'lane_a', stage: 'synthesis', expected_value_score: 6, expected_cost_score: 6, value_cost_ratio: 1 }),
        createMockPrompt({ prompt_id: 'p3', lane: 'lane_b', stage: 'research', expected_value_score: 4, expected_cost_score: 8, value_cost_ratio: 0.5 }),
      ];

      selector.loadPrompts(prompts);
      const stats = selector.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byLane['lane_a']).toBe(2);
      expect(stats.byLane['lane_b']).toBe(1);
      expect(stats.avgValueScore).toBe(6);
      expect(stats.avgCostScore).toBe(6);
    });
  });
});
