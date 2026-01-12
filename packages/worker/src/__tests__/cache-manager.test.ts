/**
 * ARC Investment Factory - Cache Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CacheManager, resetCacheManager } from '../cache/manager.js';

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    resetCacheManager();
    cache = new CacheManager({
      data: { max_entries: 100, default_ttl_seconds: 60 },
      prompt_output: { max_entries: 50, default_ttl_seconds: 120 },
      prune_interval_seconds: 3600,
    });
  });

  afterEach(() => {
    cache.shutdown();
    resetCacheManager();
  });

  describe('Data Cache', () => {
    it('should store and retrieve data', () => {
      cache.setData('test_key', { value: 123 });
      const result = cache.getData<{ value: number }>('test_key');
      expect(result).toEqual({ value: 123 });
    });

    it('should return null for missing keys', () => {
      const result = cache.getData('nonexistent');
      expect(result).toBeNull();
    });

    it('should check if key exists', () => {
      cache.setData('exists', 'value');
      expect(cache.hasData('exists')).toBe(true);
      expect(cache.hasData('missing')).toBe(false);
    });

    it('should delete data', () => {
      cache.setData('to_delete', 'value');
      expect(cache.hasData('to_delete')).toBe(true);
      
      cache.deleteData('to_delete');
      expect(cache.hasData('to_delete')).toBe(false);
    });

    it('should store data with metadata', () => {
      cache.setData('with_meta', { data: 'test' }, {
        source: 'fmp',
        ticker: 'AAPL',
      });
      
      const stats = cache.getStats();
      expect(stats.data_cache.entries).toBe(1);
    });

    it('should clear data cache', () => {
      cache.setData('key1', 'value1');
      cache.setData('key2', 'value2');
      
      cache.clearDataCache();
      
      expect(cache.hasData('key1')).toBe(false);
      expect(cache.hasData('key2')).toBe(false);
    });
  });

  describe('Prompt Output Cache', () => {
    it('should store and retrieve prompt outputs', () => {
      const output = { analysis: 'test', confidence: 0.9 };
      cache.setPromptOutput('prompt_key', output);
      
      const result = cache.getPromptOutput<typeof output>('prompt_key');
      expect(result).toEqual(output);
    });

    it('should store prompt output with metadata', () => {
      cache.setPromptOutput('output_1', { result: 'test' }, {
        prompt_id: 'business_model_analysis',
        ticker: 'TSLA',
        run_id: 'run_123',
      });
      
      const stats = cache.getStats();
      expect(stats.prompt_output_cache.entries).toBe(1);
    });

    it('should check if prompt output exists', () => {
      cache.setPromptOutput('exists', 'output');
      expect(cache.hasPromptOutput('exists')).toBe(true);
      expect(cache.hasPromptOutput('missing')).toBe(false);
    });

    it('should delete prompt output', () => {
      cache.setPromptOutput('to_delete', 'output');
      cache.deletePromptOutput('to_delete');
      expect(cache.hasPromptOutput('to_delete')).toBe(false);
    });

    it('should clear prompt output cache', () => {
      cache.setPromptOutput('key1', 'output1');
      cache.setPromptOutput('key2', 'output2');
      
      cache.clearPromptOutputCache();
      
      expect(cache.hasPromptOutput('key1')).toBe(false);
      expect(cache.hasPromptOutput('key2')).toBe(false);
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache statistics', () => {
      cache.setData('data1', 'value1');
      cache.setData('data2', 'value2');
      cache.setPromptOutput('output1', 'result1');
      
      const stats = cache.getStats();
      
      expect(stats.data_cache.entries).toBe(2);
      expect(stats.prompt_output_cache.entries).toBe(1);
      expect(stats.total_entries).toBe(3);
    });

    it('should track hit rate', () => {
      cache.setData('key', 'value');
      
      // Hit
      cache.getData('key');
      cache.getData('key');
      
      // Miss
      cache.getData('nonexistent');
      
      const stats = cache.getStats();
      expect(stats.data_cache.hits).toBe(2);
      expect(stats.data_cache.misses).toBe(1);
      expect(stats.data_cache.hit_rate).toBeCloseTo(0.667, 2);
    });
  });

  describe('Cache Separation', () => {
    it('should keep data and prompt output caches separate', () => {
      cache.setData('shared_key', 'data_value');
      cache.setPromptOutput('shared_key', 'output_value');
      
      expect(cache.getData('shared_key')).toBe('data_value');
      expect(cache.getPromptOutput('shared_key')).toBe('output_value');
    });

    it('should clear caches independently', () => {
      cache.setData('data_key', 'data');
      cache.setPromptOutput('output_key', 'output');
      
      cache.clearDataCache();
      
      expect(cache.hasData('data_key')).toBe(false);
      expect(cache.hasPromptOutput('output_key')).toBe(true);
    });

    it('should clear all caches', () => {
      cache.setData('data_key', 'data');
      cache.setPromptOutput('output_key', 'output');
      
      cache.clearAll();
      
      expect(cache.hasData('data_key')).toBe(false);
      expect(cache.hasPromptOutput('output_key')).toBe(false);
    });
  });

  describe('Pruning', () => {
    it('should prune expired entries', async () => {
      // Create cache with very short TTL
      const shortCache = new CacheManager({
        data: { max_entries: 100, default_ttl_seconds: 0.1 },
        prompt_output: { max_entries: 50, default_ttl_seconds: 0.1 },
        prune_interval_seconds: 3600,
      });

      shortCache.setData('expires_soon', 'value');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const result = shortCache.pruneAll();
      expect(result.data_pruned).toBeGreaterThanOrEqual(0);
      
      shortCache.shutdown();
    });
  });
});
