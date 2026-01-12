/**
 * ARC Investment Factory - Prompt Library Loader
 * 
 * Loads, validates, and provides access to the prompt library.
 * Validates prompts against the PromptDefinition schema using Zod.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  type PromptDefinition,
  type PromptLibrary,
  type Lane,
  PromptLibrarySchema,
} from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface LoadResult {
  success: boolean;
  library?: PromptLibrary;
  errors?: string[];
}

export interface PromptQuery {
  lane?: Lane;
  stage?: string;
  category?: string;
  tags?: string[];
  executor_type?: 'llm' | 'code' | 'hybrid';
}

// ============================================================================
// PROMPT LIBRARY LOADER
// ============================================================================

export class PromptLibraryLoader {
  private library: PromptLibrary | null = null;
  private promptsById: Map<string, PromptDefinition> = new Map();
  private promptsByLane: Map<string, PromptDefinition[]> = new Map();
  private promptsByStage: Map<string, PromptDefinition[]> = new Map();
  private libraryPath: string;

  constructor(libraryPath?: string) {
    // Default to the library directory relative to this file
    if (libraryPath) {
      this.libraryPath = libraryPath;
    } else {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      this.libraryPath = join(__dirname, 'library', 'prompts.json');
    }
  }

  /**
   * Load the prompt library from disk
   */
  load(): LoadResult {
    try {
      if (!existsSync(this.libraryPath)) {
        return {
          success: false,
          errors: [`Library file not found: ${this.libraryPath}`],
        };
      }

      const content = readFileSync(this.libraryPath, 'utf-8');
      const rawLibrary = JSON.parse(content);

      // Validate with Zod
      const parseResult = PromptLibrarySchema.safeParse(rawLibrary);
      
      if (!parseResult.success) {
        const errors = parseResult.error.errors.map(e => 
          `${e.path.join('.')}: ${e.message}`
        );
        return { success: false, errors };
      }

      this.library = parseResult.data as PromptLibrary;
      this.buildIndexes();

      console.log(`[PromptLibrary] Loaded ${this.library.prompts.length} prompts (v${this.library.version})`);

      return { success: true, library: this.library };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to load library: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Build indexes for fast lookup
   */
  private buildIndexes(): void {
    if (!this.library) return;

    this.promptsById.clear();
    this.promptsByLane.clear();
    this.promptsByStage.clear();

    for (const prompt of this.library.prompts) {
      // Index by ID
      this.promptsById.set(prompt.prompt_id, prompt);

      // Index by lane
      const lane = prompt.lane;
      if (!this.promptsByLane.has(lane)) {
        this.promptsByLane.set(lane, []);
      }
      this.promptsByLane.get(lane)!.push(prompt);

      // Index by stage
      const stage = prompt.stage;
      if (!this.promptsByStage.has(stage)) {
        this.promptsByStage.set(stage, []);
      }
      this.promptsByStage.get(stage)!.push(prompt);
    }
  }

  /**
   * Get a prompt by ID
   */
  getById(promptId: string): PromptDefinition | undefined {
    return this.promptsById.get(promptId);
  }

  /**
   * Get prompts by lane
   */
  getByLane(lane: Lane): PromptDefinition[] {
    return this.promptsByLane.get(lane) || [];
  }

  /**
   * Get prompts by stage
   */
  getByStage(stage: string): PromptDefinition[] {
    return this.promptsByStage.get(stage) || [];
  }

  /**
   * Query prompts with filters
   */
  query(filters: PromptQuery): PromptDefinition[] {
    if (!this.library) return [];

    return this.library.prompts.filter(prompt => {
      if (filters.lane && prompt.lane !== filters.lane) return false;
      if (filters.stage && prompt.stage !== filters.stage) return false;
      if (filters.category && prompt.category !== filters.category) return false;
      if (filters.executor_type && prompt.executor_type !== filters.executor_type) return false;
      if (filters.tags && filters.tags.length > 0) {
        const promptTags = prompt.tags || [];
        if (!filters.tags.some(tag => promptTags.includes(tag))) return false;
      }
      return true;
    });
  }

  /**
   * List all prompts
   */
  listAll(): PromptDefinition[] {
    return this.library?.prompts || [];
  }

  /**
   * Get library version
   */
  getVersion(): string {
    return this.library?.version || 'unknown';
  }

  /**
   * Check if library is loaded
   */
  isLoaded(): boolean {
    return this.library !== null;
  }

  /**
   * Get statistics about the library
   */
  getStats(): {
    total: number;
    byLane: Record<string, number>;
    byStage: Record<string, number>;
    byExecutorType: Record<string, number>;
  } {
    if (!this.library) {
      return { total: 0, byLane: {}, byStage: {}, byExecutorType: {} };
    }

    const byLane: Record<string, number> = {};
    const byStage: Record<string, number> = {};
    const byExecutorType: Record<string, number> = {};

    for (const prompt of this.library.prompts) {
      byLane[prompt.lane] = (byLane[prompt.lane] || 0) + 1;
      byStage[prompt.stage] = (byStage[prompt.stage] || 0) + 1;
      byExecutorType[prompt.executor_type] = (byExecutorType[prompt.executor_type] || 0) + 1;
    }

    return {
      total: this.library.prompts.length,
      byLane,
      byStage,
      byExecutorType,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let loaderInstance: PromptLibraryLoader | null = null;

export function getPromptLibraryLoader(libraryPath?: string): PromptLibraryLoader {
  if (!loaderInstance) {
    loaderInstance = new PromptLibraryLoader(libraryPath);
  }
  return loaderInstance;
}

export function resetPromptLibraryLoader(): void {
  loaderInstance = null;
}
