/**
 * Lane 0 - Main Runner / Orchestrator
 * 
 * Orquestrador principal do Lane 0 que:
 * 1. Coordena a execução dos ingestores (Substack, Reddit e FMP Screener)
 * 2. Normaliza e deduplica as ideias
 * 3. Publica o ledger diário
 * 4. Integra com o Lane A existente
 * 5. Pode ser executado via scheduler (cron) ou manualmente
 */

import type { LLMClient } from '@arc/llm-client';
import { Lane0StateManager } from './state-manager.js';
import { SubstackIngestor, type RawIdea } from './substack-ingestor.js';
import { RedditIngestor } from './reddit-ingestor.js';
import { FMPIngestor } from './fmp-ingestor.js';
import { IdeaNormalizer, type NormalizedIdea } from './idea-normalizer.js';
import { LedgerPublisher, type DailyLedger, type LaneAInput } from './ledger-publisher.js';

// Configuração do Lane 0
export interface Lane0Config {
  enableSubstack: boolean;
  enableReddit: boolean;
  enableFMP: boolean;
  maxIdeasPerSource: number;
  maxIdeasToLaneA: number;
  minConfidenceForLaneA: 'HIGH' | 'MEDIUM' | 'LOW';
  parallelIngestion: boolean;
  dryRun: boolean;
}

const DEFAULT_CONFIG: Lane0Config = {
  enableSubstack: true,
  enableReddit: true,
  enableFMP: true,
  maxIdeasPerSource: 50,
  maxIdeasToLaneA: 200,
  minConfidenceForLaneA: 'MEDIUM',
  parallelIngestion: true,
  dryRun: false,
};

export interface Lane0Result {
  success: boolean;
  ledger: DailyLedger | null;
  laneAInputs: LaneAInput[];
  stats: {
    substackIdeas: number;
    redditIdeas: number;
    fmpIdeas: number;
    totalRawIdeas: number;
    normalizedIdeas: number;
    publishedToLaneA: number;
    processingTimeMs: number;
  };
  errors: string[];
  report: string;
}

export class Lane0Runner {
  private config: Lane0Config;
  private stateManager: Lane0StateManager;
  private llmClient: LLMClient;
  private substackIngestor: SubstackIngestor;
  private redditIngestor: RedditIngestor;
  private fmpIngestor: FMPIngestor;
  private normalizer: IdeaNormalizer;
  private publisher: LedgerPublisher;

  constructor(llmClient: LLMClient, config: Partial<Lane0Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.llmClient = llmClient;
    
    this.stateManager = new Lane0StateManager();
    this.substackIngestor = new SubstackIngestor(this.stateManager, llmClient);
    this.redditIngestor = new RedditIngestor(this.stateManager, llmClient);
    this.fmpIngestor = new FMPIngestor(this.stateManager, llmClient);
    this.normalizer = new IdeaNormalizer();
    this.publisher = new LedgerPublisher(this.stateManager);
  }

  async run(): Promise<Lane0Result> {
    const startTime = Date.now();
    const errors: string[] = [];
    let allRawIdeas: RawIdea[] = [];

    console.log('[Lane0Runner] Starting Lane 0 execution...');
    console.log(`[Lane0Runner] Config: Substack=${this.config.enableSubstack}, Reddit=${this.config.enableReddit}, FMP=${this.config.enableFMP}`);

    await this.stateManager.updateExecutionState({
      status: 'running',
      startedAt: new Date(),
    });

    try {
      console.log('[Lane0Runner] Phase 1: Data Ingestion');
      
      if (this.config.parallelIngestion) {
        const ingestionPromises: Promise<RawIdea[]>[] = [];
        
        if (this.config.enableSubstack) {
          ingestionPromises.push(
            this.substackIngestor.ingest().catch((err: Error) => {
              errors.push(`Substack ingestion error: ${err.message}`);
              return [];
            })
          );
        }
        
        if (this.config.enableReddit) {
          ingestionPromises.push(
            this.redditIngestor.ingest().catch((err: Error) => {
              errors.push(`Reddit ingestion error: ${err.message}`);
              return [];
            })
          );
        }

        if (this.config.enableFMP) {
          ingestionPromises.push(
            this.fmpIngestor.ingest().catch((err: Error) => {
              errors.push(`FMP ingestion error: ${err.message}`);
              return [];
            })
          );
        }
        
        const results = await Promise.all(ingestionPromises);
        allRawIdeas = results.flat();
        
      } else {
        if (this.config.enableSubstack) {
          try {
            const substackIdeas = await this.substackIngestor.ingest();
            allRawIdeas.push(...substackIdeas);
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            errors.push(`Substack ingestion error: ${errorMessage}`);
          }
        }
        
        if (this.config.enableReddit) {
          try {
            const redditIdeas = await this.redditIngestor.ingest();
            allRawIdeas.push(...redditIdeas);
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            errors.push(`Reddit ingestion error: ${errorMessage}`);
          }
        }

        if (this.config.enableFMP) {
          try {
            const fmpIdeas = await this.fmpIngestor.ingest();
            allRawIdeas.push(...fmpIdeas);
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            errors.push(`FMP ingestion error: ${errorMessage}`);
          }
        }
      }

      console.log(`[Lane0Runner] Ingested ${allRawIdeas.length} raw ideas`);

      console.log('[Lane0Runner] Phase 2: Normalization & Deduplication');
      const normalizedIdeas = this.normalizer.normalizeAndDeduplicate(allRawIdeas);
      console.log(`[Lane0Runner] Normalized to ${normalizedIdeas.length} unique ideas`);

      console.log('[Lane0Runner] Phase 3: Quality Filtering');
      const qualityIdeas = this.filterByMinConfidence(normalizedIdeas);
      console.log(`[Lane0Runner] ${qualityIdeas.length} ideas meet quality threshold`);

      console.log('[Lane0Runner] Phase 4: Creating Ledger');
      const processingTimeMs = Date.now() - startTime;
      const ledger = this.publisher.createLedger(qualityIdeas, processingTimeMs);

      if (!this.config.dryRun) {
        console.log('[Lane0Runner] Phase 5: Persisting Ledger');
        await this.publisher.persistLedger(ledger);
      }

      let laneAInputs: LaneAInput[] = [];
      if (!this.config.dryRun) {
        console.log('[Lane0Runner] Phase 6: Publishing to Lane A');
        laneAInputs = await this.publisher.publishToLaneA(ledger, this.config.maxIdeasToLaneA);
      }

      console.log('[Lane0Runner] Phase 7: Generating Report');
      const report = this.publisher.generateExecutionReport(ledger);

      await this.stateManager.updateExecutionState({
        status: 'completed',
        completedAt: new Date(),
        lastLedgerId: ledger.id,
      });

      const substackCount = allRawIdeas.filter(i => i.source.type === 'substack').length;
      const redditCount = allRawIdeas.filter(i => i.source.type === 'reddit').length;
      const fmpCount = allRawIdeas.filter(i => (i.source.type as string) === 'fmp_screener').length;

      console.log('[Lane0Runner] Execution completed successfully');

      return {
        success: true,
        ledger,
        laneAInputs,
        stats: {
          substackIdeas: substackCount,
          redditIdeas: redditCount,
          fmpIdeas: fmpCount,
          totalRawIdeas: allRawIdeas.length,
          normalizedIdeas: normalizedIdeas.length,
          publishedToLaneA: laneAInputs.length,
          processingTimeMs: Date.now() - startTime,
        },
        errors,
        report,
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Lane0Runner] Fatal error:', error);
      
      await this.stateManager.updateExecutionState({
        status: 'failed',
        completedAt: new Date(),
        lastError: errorMessage,
      });

      const substackCount = allRawIdeas.filter(i => i.source.type === 'substack').length;
      const redditCount = allRawIdeas.filter(i => i.source.type === 'reddit').length;
      const fmpCount = allRawIdeas.filter(i => (i.source.type as string) === 'fmp_screener').length;

      return {
        success: false,
        ledger: null,
        laneAInputs: [],
        stats: {
          substackIdeas: substackCount,
          redditIdeas: redditCount,
          fmpIdeas: fmpCount,
          totalRawIdeas: allRawIdeas.length,
          normalizedIdeas: 0,
          publishedToLaneA: 0,
          processingTimeMs: Date.now() - startTime,
        },
        errors: [...errors, errorMessage],
        report: `Lane 0 execution failed: ${errorMessage}`,
      };
    }
  }

  private filterByMinConfidence(ideas: NormalizedIdea[]): NormalizedIdea[] {
    const minConf = this.config.minConfidenceForLaneA;
    
    return ideas.filter(idea => {
      if (minConf === 'LOW') return true;
      if (minConf === 'MEDIUM') {
        return idea.aggregatedConfidence === 'HIGH' || idea.aggregatedConfidence === 'MEDIUM';
      }
      return idea.aggregatedConfidence === 'HIGH';
    });
  }

  async runSubstackOnly(): Promise<RawIdea[]> {
    console.log('[Lane0Runner] Running Substack ingestion only...');
    return this.substackIngestor.ingest();
  }

  async runRedditOnly(): Promise<RawIdea[]> {
    console.log('[Lane0Runner] Running Reddit ingestion only...');
    return this.redditIngestor.ingest();
  }

  async runFMPOnly(): Promise<RawIdea[]> {
    console.log('[Lane0Runner] Running FMP Screener ingestion only...');
    return this.fmpIngestor.ingest();
  }

  async getExecutionState(): Promise<unknown> {
    return this.stateManager.getExecutionState();
  }
}

export default Lane0Runner;
