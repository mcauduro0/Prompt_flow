/**
 * ARC Investment Factory - Cache Manager
 * 
 * Separated cache management for:
 * - data_cache: Raw data from external sources (FMP, Polygon, SEC, etc.)
 * - prompt_output_cache: LLM prompt execution outputs
 * 
 * Each cache has independent TTL, size limits, and eviction policies.
 */

// ============================================================================
// TYPES
// ============================================================================

export type CacheType = 'data' | 'prompt_output';

export interface CacheEntry<T> {
  key: string;
  value: T;
  created_at: number;
  expires_at: number;
  access_count: number;
  last_accessed: number;
  size_bytes: number;
  metadata?: {
    source?: string;
    prompt_id?: string;
    ticker?: string;
    run_id?: string;
  };
}

export interface CacheConfig {
  max_entries: number;
  max_size_bytes: number;
  default_ttl_seconds: number;
  eviction_policy: 'lru' | 'lfu' | 'fifo';
}

export interface CacheStats {
  entries: number;
  size_bytes: number;
  hits: number;
  misses: number;
  hit_rate: number;
  evictions: number;
  oldest_entry_age_seconds: number;
}

// ============================================================================
// DEFAULT CONFIGS
// ============================================================================

const DEFAULT_DATA_CACHE_CONFIG: CacheConfig = {
  max_entries: 1000,
  max_size_bytes: 50 * 1024 * 1024,  // 50MB
  default_ttl_seconds: 3600,          // 1 hour
  eviction_policy: 'lru',
};

const DEFAULT_PROMPT_OUTPUT_CACHE_CONFIG: CacheConfig = {
  max_entries: 500,
  max_size_bytes: 100 * 1024 * 1024,  // 100MB
  default_ttl_seconds: 86400,          // 24 hours
  eviction_policy: 'lru',
};

// ============================================================================
// CACHE STORE
// ============================================================================

class CacheStore<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheConfig;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
  } = { hits: 0, misses: 0, evictions: 0 };
  private currentSizeBytes: number = 0;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expires_at) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access stats
    entry.access_count++;
    entry.last_accessed = Date.now();
    this.cache.set(key, entry);
    
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set(
    key: string,
    value: T,
    options?: {
      ttl_seconds?: number;
      metadata?: CacheEntry<T>['metadata'];
    }
  ): void {
    const ttl = options?.ttl_seconds || this.config.default_ttl_seconds;
    const now = Date.now();
    const sizeBytes = this.estimateSize(value);

    // Check if we need to evict
    while (
      (this.cache.size >= this.config.max_entries ||
       this.currentSizeBytes + sizeBytes > this.config.max_size_bytes) &&
      this.cache.size > 0
    ) {
      this.evict();
    }

    // Delete existing entry if present
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.currentSizeBytes -= existing.size_bytes;
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      created_at: now,
      expires_at: now + ttl * 1000,
      access_count: 1,
      last_accessed: now,
      size_bytes: sizeBytes,
      metadata: options?.metadata,
    };

    this.cache.set(key, entry);
    this.currentSizeBytes += sizeBytes;
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSizeBytes -= entry.size_bytes;
      return this.cache.delete(key);
    }
    return false;
  }

  /**
   * Check if key exists (without updating stats)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expires_at) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.currentSizeBytes = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    let oldestAge = 0;

    if (this.cache.size > 0) {
      const now = Date.now();
      let oldest = now;
      for (const entry of this.cache.values()) {
        if (entry.created_at < oldest) {
          oldest = entry.created_at;
        }
      }
      oldestAge = (now - oldest) / 1000;
    }

    return {
      entries: this.cache.size,
      size_bytes: this.currentSizeBytes,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hit_rate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      evictions: this.stats.evictions,
      oldest_entry_age_seconds: oldestAge,
    };
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get entries by metadata filter
   */
  getByMetadata(filter: Record<string, string | undefined>): CacheEntry<T>[] {
    const results: CacheEntry<T>[] = [];
    
    for (const entry of this.cache.values()) {
      if (!entry.metadata) continue;
      
      let matches = true;
      const filterEntries = Object.entries(filter);
      for (let i = 0; i < filterEntries.length; i++) {
        const [key, value] = filterEntries[i];
        const metadataValue = entry.metadata[key as keyof typeof entry.metadata];
        if (metadataValue !== value) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        results.push(entry);
      }
    }
    
    return results;
  }

  /**
   * Evict entries based on policy
   */
  private evict(): void {
    if (this.cache.size === 0) return;

    let keyToEvict: string | null = null;

    switch (this.config.eviction_policy) {
      case 'lru':
        keyToEvict = this.findLRU();
        break;
      case 'lfu':
        keyToEvict = this.findLFU();
        break;
      case 'fifo':
        keyToEvict = this.findFIFO();
        break;
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
      this.stats.evictions++;
    }
  }

  /**
   * Find least recently used entry
   */
  private findLRU(): string | null {
    let oldest = Infinity;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.cache) {
      if (entry.last_accessed < oldest) {
        oldest = entry.last_accessed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Find least frequently used entry
   */
  private findLFU(): string | null {
    let minAccess = Infinity;
    let minKey: string | null = null;

    for (const [key, entry] of this.cache) {
      if (entry.access_count < minAccess) {
        minAccess = entry.access_count;
        minKey = key;
      }
    }

    return minKey;
  }

  /**
   * Find first in (oldest) entry
   */
  private findFIFO(): string | null {
    let oldest = Infinity;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.cache) {
      if (entry.created_at < oldest) {
        oldest = entry.created_at;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Estimate size of a value in bytes
   */
  private estimateSize(value: T): number {
    const str = JSON.stringify(value);
    return str ? str.length * 2 : 0;  // Rough estimate (UTF-16)
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expires_at) {
        this.delete(key);
        pruned++;
      }
    }

    return pruned;
  }
}

// ============================================================================
// CACHE MANAGER
// ============================================================================

export class CacheManager {
  private dataCache: CacheStore<unknown>;
  private promptOutputCache: CacheStore<unknown>;
  private pruneInterval: NodeJS.Timeout | null = null;

  constructor(config?: {
    data?: Partial<CacheConfig>;
    prompt_output?: Partial<CacheConfig>;
    prune_interval_seconds?: number;
  }) {
    this.dataCache = new CacheStore({
      ...DEFAULT_DATA_CACHE_CONFIG,
      ...config?.data,
    });

    this.promptOutputCache = new CacheStore({
      ...DEFAULT_PROMPT_OUTPUT_CACHE_CONFIG,
      ...config?.prompt_output,
    });

    // Start periodic pruning
    const pruneInterval = (config?.prune_interval_seconds || 300) * 1000;
    this.pruneInterval = setInterval(() => this.pruneAll(), pruneInterval);
  }

  /**
   * Get from data cache
   */
  getData<T>(key: string): T | null {
    return this.dataCache.get(key) as T | null;
  }

  /**
   * Set in data cache
   */
  setData<T>(
    key: string,
    value: T,
    options?: {
      ttl_seconds?: number;
      source?: string;
      ticker?: string;
    }
  ): void {
    this.dataCache.set(key, value, {
      ttl_seconds: options?.ttl_seconds,
      metadata: {
        source: options?.source,
        ticker: options?.ticker,
      },
    });
  }

  /**
   * Get from prompt output cache
   */
  getPromptOutput<T>(key: string): T | null {
    return this.promptOutputCache.get(key) as T | null;
  }

  /**
   * Set in prompt output cache
   */
  setPromptOutput<T>(
    key: string,
    value: T,
    options?: {
      ttl_seconds?: number;
      prompt_id?: string;
      ticker?: string;
      run_id?: string;
    }
  ): void {
    this.promptOutputCache.set(key, value, {
      ttl_seconds: options?.ttl_seconds,
      metadata: {
        prompt_id: options?.prompt_id,
        ticker: options?.ticker,
        run_id: options?.run_id,
      },
    });
  }

  /**
   * Check if data cache has key
   */
  hasData(key: string): boolean {
    return this.dataCache.has(key);
  }

  /**
   * Check if prompt output cache has key
   */
  hasPromptOutput(key: string): boolean {
    return this.promptOutputCache.has(key);
  }

  /**
   * Delete from data cache
   */
  deleteData(key: string): boolean {
    return this.dataCache.delete(key);
  }

  /**
   * Delete from prompt output cache
   */
  deletePromptOutput(key: string): boolean {
    return this.promptOutputCache.delete(key);
  }

  /**
   * Clear data cache
   */
  clearDataCache(): void {
    this.dataCache.clear();
  }

  /**
   * Clear prompt output cache
   */
  clearPromptOutputCache(): void {
    this.promptOutputCache.clear();
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.dataCache.clear();
    this.promptOutputCache.clear();
  }

  /**
   * Get combined statistics
   */
  getStats(): {
    data_cache: CacheStats;
    prompt_output_cache: CacheStats;
    total_entries: number;
    total_size_bytes: number;
    combined_hit_rate: number;
  } {
    const dataStats = this.dataCache.getStats();
    const promptStats = this.promptOutputCache.getStats();

    const totalHits = dataStats.hits + promptStats.hits;
    const totalMisses = dataStats.misses + promptStats.misses;
    const totalRequests = totalHits + totalMisses;

    return {
      data_cache: dataStats,
      prompt_output_cache: promptStats,
      total_entries: dataStats.entries + promptStats.entries,
      total_size_bytes: dataStats.size_bytes + promptStats.size_bytes,
      combined_hit_rate: totalRequests > 0 ? totalHits / totalRequests : 0,
    };
  }

  /**
   * Prune all caches
   */
  pruneAll(): { data_pruned: number; prompt_output_pruned: number } {
    return {
      data_pruned: this.dataCache.prune(),
      prompt_output_pruned: this.promptOutputCache.prune(),
    };
  }

  /**
   * Get prompt outputs by ticker
   */
  getPromptOutputsByTicker(ticker: string): CacheEntry<unknown>[] {
    return this.promptOutputCache.getByMetadata({ ticker });
  }

  /**
   * Get prompt outputs by prompt ID
   */
  getPromptOutputsByPromptId(promptId: string): CacheEntry<unknown>[] {
    return this.promptOutputCache.getByMetadata({ prompt_id: promptId });
  }

  /**
   * Get data by source
   */
  getDataBySource(source: string): CacheEntry<unknown>[] {
    return this.dataCache.getByMetadata({ source });
  }

  /**
   * Shutdown cache manager
   */
  shutdown(): void {
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
      this.pruneInterval = null;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let managerInstance: CacheManager | null = null;

export function getCacheManager(config?: {
  data?: Partial<CacheConfig>;
  prompt_output?: Partial<CacheConfig>;
  prune_interval_seconds?: number;
}): CacheManager {
  if (!managerInstance) {
    managerInstance = new CacheManager(config);
  }
  return managerInstance;
}

export function resetCacheManager(): void {
  if (managerInstance) {
    managerInstance.shutdown();
  }
  managerInstance = null;
}
