/**
 * Lane 0 - State Manager
 * 
 * Gerencia o estado de execução do Lane 0, incluindo:
 * - Cursores de processamento por fonte
 * - Estado de execução geral
 * - Persistência em arquivo JSON
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Interface para cursor de fonte
export interface SourceCursor {
  sourceType: 'substack' | 'reddit';
  sourceName: string;
  lastProcessedId?: string;
  lastProcessedAt?: Date;
  lastSuccessAt?: Date;
  lastError?: string;
  processedIds?: string[];
}

// Interface para estado de execução
export interface ExecutionState {
  status: 'idle' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  lastLedgerId?: string;
  lastPublishedAt?: Date;
  ideasPublished?: number;
  lastError?: string;
}

// Interface para estado completo
interface Lane0State {
  cursors: Record<string, SourceCursor>;
  execution: ExecutionState;
  updatedAt: Date;
}

export class Lane0StateManager {
  private statePath: string;
  private state: Lane0State;

  constructor(statePath?: string) {
    this.statePath = statePath || path.join(process.cwd(), 'data', 'lane0-state.json');
    this.state = {
      cursors: {},
      execution: { status: 'idle' },
      updatedAt: new Date(),
    };
  }

  /**
   * Carrega o estado do arquivo
   */
  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.statePath, 'utf-8');
      this.state = JSON.parse(data);
      
      // Converter strings de data para Date
      if (this.state.execution.startedAt) {
        this.state.execution.startedAt = new Date(this.state.execution.startedAt);
      }
      if (this.state.execution.completedAt) {
        this.state.execution.completedAt = new Date(this.state.execution.completedAt);
      }
      if (this.state.execution.lastPublishedAt) {
        this.state.execution.lastPublishedAt = new Date(this.state.execution.lastPublishedAt);
      }
      
      for (const cursor of Object.values(this.state.cursors)) {
        if (cursor.lastProcessedAt) {
          cursor.lastProcessedAt = new Date(cursor.lastProcessedAt);
        }
        if (cursor.lastSuccessAt) {
          cursor.lastSuccessAt = new Date(cursor.lastSuccessAt);
        }
      }
      
      console.log('[Lane0StateManager] State loaded successfully');
    } catch (error) {
      console.log('[Lane0StateManager] No existing state found, using defaults');
    }
  }

  /**
   * Salva o estado no arquivo
   */
  async save(): Promise<void> {
    try {
      this.state.updatedAt = new Date();
      
      // Garantir que o diretório existe
      const dir = path.dirname(this.statePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2));
      console.log('[Lane0StateManager] State saved successfully');
    } catch (error) {
      console.error('[Lane0StateManager] Error saving state:', error);
    }
  }

  /**
   * Obtém o cursor de uma fonte
   */
  async getCursor(sourceType: 'substack' | 'reddit', sourceName: string): Promise<SourceCursor | null> {
    await this.load();
    const key = `${sourceType}:${sourceName}`;
    return this.state.cursors[key] || null;
  }

  /**
   * Atualiza o cursor de uma fonte
   */
  async updateCursor(
    sourceType: 'substack' | 'reddit', 
    sourceName: string, 
    update: Partial<SourceCursor>
  ): Promise<void> {
    await this.load();
    
    const key = `${sourceType}:${sourceName}`;
    const existing = this.state.cursors[key] || {
      sourceType,
      sourceName,
    };
    
    this.state.cursors[key] = {
      ...existing,
      ...update,
    };
    
    await this.save();
  }

  /**
   * Obtém o estado de execução
   */
  async getExecutionState(): Promise<ExecutionState> {
    await this.load();
    return this.state.execution;
  }

  /**
   * Atualiza o estado de execução
   */
  async updateExecutionState(update: Partial<ExecutionState>): Promise<void> {
    await this.load();
    this.state.execution = {
      ...this.state.execution,
      ...update,
    };
    await this.save();
  }

  /**
   * Reseta todos os cursores
   */
  async resetCursors(): Promise<void> {
    await this.load();
    this.state.cursors = {};
    await this.save();
  }

  /**
   * Obtém todos os cursores
   */
  async getAllCursors(): Promise<SourceCursor[]> {
    await this.load();
    return Object.values(this.state.cursors);
  }
}

export default Lane0StateManager;
