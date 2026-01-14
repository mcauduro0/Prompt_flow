/**
 * Lane 0 - Daily Idea Ingestion from Substack and Reddit
 * 
 * Este módulo implementa o pipeline de ingestão diária de ideias de investimento
 * a partir de fontes externas (Substack newsletters e Reddit), alimentando o Lane A.
 */

// State Management
export { Lane0StateManager } from './state-manager.js';
export type { SourceCursor, ExecutionState } from './state-manager.js';

// Ingestors
export { SubstackIngestor, INVESTMENT_NEWSLETTERS } from './substack-ingestor.js';
export type { RawIdea, SubstackPost } from './substack-ingestor.js';

export { RedditIngestor, INVESTMENT_SUBREDDITS } from './reddit-ingestor.js';
export type { RedditPost } from './reddit-ingestor.js';

// Normalizer
export { IdeaNormalizer } from './idea-normalizer.js';
export type { NormalizedIdea } from './idea-normalizer.js';

// Publisher
export { LedgerPublisher } from './ledger-publisher.js';
export type { DailyLedger, LedgerIdea, LedgerStats, LaneAInput } from './ledger-publisher.js';

// Main Runner
export { Lane0Runner } from './lane0-runner.js';
export type { Lane0Config, Lane0Result } from './lane0-runner.js';

// Default export
export { default } from './lane0-runner.js';
