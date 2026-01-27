/**
 * ARC Investment Factory - Database Schema
 * Drizzle ORM schema definitions following Build Pack specification
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  numeric,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ============================================================================
// ENUMS
// ============================================================================

export const styleTagEnum = pgEnum('style_tag', ['quality_compounder', 'garp', 'cigar_butt']);

export const ideaStatusEnum = pgEnum('idea_status', ['new', 'monitoring', 'promoted', 'rejected']);

export const claimTypeEnum = pgEnum('claim_type', ['numeric', 'qualitative']);

export const sourceTypeEnum = pgEnum('source_type', ['filing', 'transcript', 'investor_deck', 'news', 'dataset']);

export const reliabilityGradeEnum = pgEnum('reliability_grade', ['A', 'B', 'C']);

export const gateResultEnum = pgEnum('gate_result', ['pass', 'fail']);

export const recommendationEnum = pgEnum('recommendation', ['watch', 'deep_dive_more', 'starter_position', 'pass']);

export const icMemoStatusEnum = pgEnum('ic_memo_status', ['pending', 'generating', 'complete', 'failed']);

export const icMemoRecommendationEnum = pgEnum('ic_memo_recommendation', ['buy', 'invest', 'increase', 'hold', 'reduce', 'wait', 'reject']);

// ============================================================================
// SECURITY MASTER
// ============================================================================

export const securityMaster = pgTable('security_master', {
  securityId: uuid('security_id').primaryKey().defaultRandom(),
  ticker: text('ticker').notNull().unique(),
  companyName: text('company_name').notNull(),
  exchange: text('exchange'),
  region: text('region'),
  country: text('country'),
  currency: text('currency'),
  sector: text('sector'),
  industry: text('industry'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tickerIdx: uniqueIndex('security_master_ticker_idx').on(table.ticker),
}));

// ============================================================================
// IDEAS
// ============================================================================

export const ideas = pgTable('ideas', {
  ideaId: uuid('idea_id').primaryKey().defaultRandom(),
  securityId: uuid('security_id').references(() => securityMaster.securityId),
  ticker: text('ticker').notNull(),
  asOf: date('as_of').notNull(),
  styleTag: styleTagEnum('style_tag').notNull(),
  oneSentenceHypothesis: text('one_sentence_hypothesis').notNull(),
  mechanism: text('mechanism').notNull(),
  timeHorizon: text('time_horizon').default('1_3_years').notNull(),
  edgeType: jsonb('edge_type').$type<string[]>().notNull(),
  quickMetrics: jsonb('quick_metrics').$type<{
    market_cap_usd: number | null;
    ev_to_ebitda: number | null;
    pe: number | null;
    fcf_yield: number | null;
    revenue_cagr_3y: number | null;
    ebit_margin: number | null;
    net_debt_to_ebitda: number | null;
  }>(),
  catalysts: jsonb('catalysts').$type<Array<{
    name: string;
    window: string;
    probability: number;
    expected_impact: 'low' | 'medium' | 'high';
    how_to_monitor: string;
  }>>(),
  signposts: jsonb('signposts').$type<Array<{
    metric: string;
    direction: 'up' | 'down' | 'stable';
    threshold: string;
    frequency: 'monthly' | 'quarterly' | 'event_driven';
    why_it_matters: string;
  }>>(),
  gateResults: jsonb('gate_results').$type<{
    gate_0_data_sufficiency: 'pass' | 'fail';
    gate_1_coherence: 'pass' | 'fail';
    gate_2_edge_claim: 'pass' | 'fail';
    gate_3_downside_shape: 'pass' | 'fail';
    gate_4_style_fit: 'pass' | 'fail';
  }>(),
  score: jsonb('score').$type<{
    total: number;
    edge_clarity: number;
    business_quality_prior: number;
    financial_resilience_prior: number;
    valuation_tension: number;
    catalyst_clarity: number;
    information_availability: number;
    complexity_penalty: number;
    disclosure_friction_penalty: number;
  }>(),
  noveltyScore: numeric('novelty_score', { precision: 5, scale: 2 }),
  repetitionPenalty: numeric('repetition_penalty', { precision: 5, scale: 2 }),
  disclosureFrictionPenalty: numeric('disclosure_friction_penalty', { precision: 5, scale: 2 }),
  rankScore: numeric('rank_score', { precision: 10, scale: 6 }),
  status: ideaStatusEnum('status').default('new').notNull(),
  rejectionReason: text('rejection_reason'),
  nextAction: text('next_action'),
  // NEW: Immutable versioning
  version: integer('version').default(1).notNull(),
  // NEW: Company name
  companyName: text('company_name'),
  // NEW: Rejection shadow tracking
  rejectionShadow: jsonb('rejection_shadow').$type<{
    rejected_at: string;
    reason: string;
    is_blocking: boolean;
    prior_idea_id?: string;
    notes?: string;
  } | null>(),
  // NEW: What's new since last time
  whatsNewSinceLastTime: jsonb('whats_new_since_last_time').$type<Array<{
    category: string;
    description: string;
    evidence?: string;
    detected_at?: string;
  }>>(),
  // NEW: Novelty flags
  isNewTicker: boolean('is_new_ticker').default(false),
  isExploration: boolean('is_exploration').default(false),
  // NEW: Promotion timestamp
  promotedAt: timestamp('promoted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tickerAsOfIdx: index('ideas_ticker_as_of_idx').on(table.ticker, table.asOf),
  statusAsOfIdx: index('ideas_status_as_of_idx').on(table.status, table.asOf),
  rankScoreIdx: index('ideas_rank_score_idx').on(table.rankScore),
}));

// ============================================================================
// EVIDENCE
// ============================================================================

export const evidence = pgTable('evidence', {
  evidenceId: uuid('evidence_id').primaryKey().defaultRandom(),
  ideaId: uuid('idea_id').references(() => ideas.ideaId).notNull(),
  ticker: text('ticker').notNull(),
  claim: text('claim').notNull(),
  claimType: claimTypeEnum('claim_type').notNull(),
  sourceType: sourceTypeEnum('source_type').notNull(),
  sourceId: text('source_id'),
  sourceLocator: text('source_locator'),
  snippet: text('snippet'),
  extractedAt: timestamp('extracted_at').defaultNow().notNull(),
  reliabilityGrade: reliabilityGradeEnum('reliability_grade').default('B').notNull(),
}, (table) => ({
  ideaIdIdx: index('evidence_idea_id_idx').on(table.ideaId),
  tickerIdx: index('evidence_ticker_idx').on(table.ticker),
}));

// ============================================================================
// RESEARCH PACKETS
// ============================================================================

export const researchPackets = pgTable('research_packets', {
  packetId: uuid('packet_id').primaryKey().defaultRandom(),
  ideaId: uuid('idea_id').references(() => ideas.ideaId).notNull(),
  ticker: text('ticker').notNull(),
  asOf: date('as_of').notNull(),
  styleTag: styleTagEnum('style_tag').notNull(),
  packet: jsonb('packet').notNull(), // Full ResearchPacket JSON
  decisionBrief: jsonb('decision_brief'),
  monitoringPlan: jsonb('monitoring_plan'),
  thesisVersion: integer('thesis_version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tickerIdx: index('research_packets_ticker_idx').on(table.ticker),
  ideaIdIdx: index('research_packets_idea_id_idx').on(table.ideaId),
}));

// ============================================================================
// DECISIONS
// ============================================================================

export const decisions = pgTable('decisions', {
  decisionId: uuid('decision_id').primaryKey().defaultRandom(),
  ideaId: uuid('idea_id').references(() => ideas.ideaId).notNull(),
  ticker: text('ticker').notNull(),
  asOf: date('as_of').notNull(),
  decisionBrief: jsonb('decision_brief').notNull(),
  userOverride: boolean('user_override').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  asOfIdx: index('decisions_as_of_idx').on(table.asOf),
  ideaIdIdx: index('decisions_idea_id_idx').on(table.ideaId),
}));

// ============================================================================
// RUNS (Audit Trail)
// ============================================================================

export const runs = pgTable('runs', {
  runId: uuid('run_id').primaryKey().defaultRandom(),
  runType: text('run_type').notNull(), // daily_discovery, daily_lane_b, monitoring_trigger, weekly_ic_bundle, monthly_process_audit
  runDate: timestamp('run_date').defaultNow().notNull(),
  payload: jsonb('payload'),
  status: text('status').default('running').notNull(), // running, completed, failed
  errorMessage: text('error_message'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  runTypeIdx: index('runs_run_type_idx').on(table.runType),
  runDateIdx: index('runs_run_date_idx').on(table.runDate),
}));

// ============================================================================
// NOVELTY STATE
// ============================================================================

export const noveltyState = pgTable('novelty_state', {
  ticker: text('ticker').primaryKey(),
  lastSeen: timestamp('last_seen').notNull(),
  lastEdgeTypes: jsonb('last_edge_types').$type<string[]>(),
  lastStyleTag: text('last_style_tag'),
  seenCount: integer('seen_count').default(1).notNull(),
  firstSeen: timestamp('first_seen').defaultNow().notNull(),
}, (table) => ({
  lastSeenIdx: index('novelty_state_last_seen_idx').on(table.lastSeen),
}));

// ============================================================================
// STYLE MIX STATE
// ============================================================================

export const styleMixState = pgTable('style_mix_state', {
  weekStart: date('week_start').primaryKey(),
  qualityCompounderCount: integer('quality_compounder_count').default(0).notNull(),
  garpCount: integer('garp_count').default(0).notNull(),
  cigarButtCount: integer('cigar_butt_count').default(0).notNull(),
  totalPromoted: integer('total_promoted').default(0).notNull(),
});

// ============================================================================
// OUTCOMES (v2 but create now)
// ============================================================================

export const outcomes = pgTable('outcomes', {
  outcomeId: uuid('outcome_id').primaryKey().defaultRandom(),
  decisionId: uuid('decision_id').references(() => decisions.decisionId).notNull(),
  ticker: text('ticker').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  subsequentReturn: numeric('subsequent_return', { precision: 10, scale: 4 }),
  maxDrawdown: numeric('max_drawdown', { precision: 10, scale: 4 }),
  thesisBreakReason: text('thesis_break_reason'),
  notes: text('notes'),
}, (table) => ({
  decisionIdIdx: index('outcomes_decision_id_idx').on(table.decisionId),
  tickerIdx: index('outcomes_ticker_idx').on(table.ticker),
}));

// ============================================================================
// DOCUMENTS (for ingestion pipeline)
// ============================================================================

export const documents = pgTable('documents', {
  documentId: uuid('document_id').primaryKey().defaultRandom(),
  ticker: text('ticker'),
  docType: text('doc_type').notNull(), // filing, transcript, investor_deck, news
  title: text('title'),
  sourceUrl: text('source_url'),
  storageKey: text('storage_key').notNull(), // S3 key
  documentDate: date('document_date'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tickerIdx: index('documents_ticker_idx').on(table.ticker),
  docTypeIdx: index('documents_doc_type_idx').on(table.docType),
}));

// ============================================================================
// DOCUMENT CHUNKS (for vector embeddings)
// ============================================================================

export const documentChunks = pgTable('document_chunks', {
  chunkId: uuid('chunk_id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.documentId).notNull(),
  ticker: text('ticker'),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  heading: text('heading'),
  embeddingId: text('embedding_id'), // Pinecone vector ID
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  documentIdIdx: index('document_chunks_document_id_idx').on(table.documentId),
  tickerIdx: index('document_chunks_ticker_idx').on(table.ticker),
}));

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

export const promptTemplates = pgTable('prompt_templates', {
  promptId: uuid('prompt_id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  version: integer('version').default(1).notNull(),
  template: text('template').notNull(),
  description: text('description'),
  inputSchema: jsonb('input_schema'),
  outputSchema: jsonb('output_schema'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: uniqueIndex('prompt_templates_name_idx').on(table.name),
}));

// ============================================================================
// WATCHLIST
// ============================================================================

export const watchlist = pgTable('watchlist', {
  watchlistId: uuid('watchlist_id').primaryKey().defaultRandom(),
  ticker: text('ticker').notNull(),
  addedBy: text('added_by'),
  reason: text('reason'),
  priority: integer('priority').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tickerIdx: index('watchlist_ticker_idx').on(table.ticker),
  isActiveIdx: index('watchlist_is_active_idx').on(table.isActive),
}));

// ============================================================================
// IC MEMOS (Lane C - Investment Committee Memos)
// ============================================================================

export const icMemos = pgTable('ic_memos', {
  memoId: uuid('memo_id').primaryKey().defaultRandom(),
  packetId: uuid('packet_id').references(() => researchPackets.packetId).notNull(),
  ideaId: uuid('idea_id').references(() => ideas.ideaId).notNull(),
  ticker: text('ticker').notNull(),
  companyName: text('company_name'),
  asOf: date('as_of').notNull(),
  styleTag: styleTagEnum('style_tag').notNull(),
  
  // IC Memo Content (structured JSON following the IC Memo template)
  memoContent: jsonb('memo_content').$type<{
    executive_summary: {
      opportunity: string;
      why_now: string;
      risk_reward_asymmetry: string;
      decision_required: string;
    };
    investment_thesis: {
      central_thesis: string;
      value_creation_mechanism: string;
      sustainability: string;
      structural_vs_cyclical: string;
    };
    business_analysis: {
      how_company_makes_money: string;
      competitive_advantages: string[];
      competitive_weaknesses: string[];
      industry_structure: string;
      competitive_dynamics: string;
      barriers_to_entry: string;
      pricing_power: string;
      disruption_risks: string;
    };
    financial_quality: {
      revenue_quality: string;
      margin_analysis: string;
      capital_intensity: string;
      return_on_capital: string;
      accounting_distortions: string[];
      earnings_quality_risks: string[];
      growth_capital_dynamics: string;
    };
    valuation: {
      methodology: string;
      key_assumptions: string[];
      sensitivities: string[];
      value_range: {
        bear: number;
        base: number;
        bull: number;
      };
      expected_return: string;
      opportunity_cost: string;
    };
    risks: {
      material_risks: Array<{
        risk: string;
        manifestation: string;
        impact: string;
        early_signals: string[];
      }>;
      thesis_error_risks: string[];
      asymmetric_risks: string[];
    };
    variant_perception: {
      consensus_view: string;
      our_view: string;
      why_market_wrong: string;
      confirming_facts: string[];
      invalidating_facts: string[];
    };
    catalysts: {
      value_unlocking_events: Array<{
        event: string;
        timeline: string;
        controllable: boolean;
      }>;
      expected_horizon: string;
    };
    portfolio_fit: {
      portfolio_role: string;
      correlation: string;
      concentration_impact: string;
      liquidity: string;
      drawdown_impact: string;
      sizing_rationale: string;
      suggested_position_size: string;
    };
    decision: {
      recommendation: 'buy' | 'invest' | 'increase' | 'hold' | 'reduce' | 'wait' | 'reject';
      revisit_conditions: string[];
      change_of_mind_triggers: string[];
    };
  }>(),
  
  // Supporting analyses executed during Lane C
  supportingAnalyses: jsonb('supporting_analyses').$type<{
    variant_perception_analysis?: any;
    portfolio_fit_analysis?: any;
    catalyst_timeline?: any;
    downside_scenarios?: any;
    management_deep_dive?: any;
    competitive_matrix?: any;
  }>(),
  
  // Final recommendation and conviction
  recommendation: icMemoRecommendationEnum('recommendation'),
  conviction: integer('conviction'), // 1-10
  
  // Conviction Score v4.0 (Contrarian/Turnaround Model)
  scoreV4: numeric('score_v4', { precision: 5, scale: 2 }), // 0-100
  scoreV4Quintile: text('score_v4_quintile'), // Q1-Q5
  scoreV4Recommendation: text('score_v4_recommendation'), // STRONG BUY, BUY, HOLD, AVOID
  scoreV4Components: jsonb('score_v4_components').$type<{
    contrarian_signal: number;
    turnaround_signal: number;
    quality_floor: number;
    momentum_12m: number;
    momentum_3m: number;
    volatility: number;
    rsi: number;
    distance_52w_high: number;
    current_ratio: number;
    debt_equity: number;
  }>(),
  
  // Turnaround Score
  turnaroundScore: numeric('turnaround_score', { precision: 5, scale: 2 }), // 0-100
  turnaroundQuintile: integer('turnaround_quintile'), // 1-5
  turnaroundRecommendation: text('turnaround_recommendation'), // STRONG BUY, BUY, HOLD, AVOID
  turnaroundComponents: jsonb('turnaround_components').$type<{
    fundamental_improvement: number;
    price_dislocation: number;
    momentum_confirmation: number;
  }>(),
  
  // Piotroski F-Score (0-9)
  piotroskiScore: integer('piotroski_score'), // 0-9
  
  // Quality Score (14 factors)
  qualityScore: numeric("quality_score", { precision: 5, scale: 2 }), // 0-100
  qualityScoreQuintile: integer("quality_score_quintile"), // 1-5
  
  // Contrarian Score (inverted momentum signals)
  contrarianScore: numeric("contrarian_score", { precision: 5, scale: 2 }), // 0-100
  contrarianScoreQuintile: integer("contrarian_score_quintile"), // 1-5
  
  // Turnaround Score Quintile
  turnaroundScoreQuintile: integer("turnaround_score_quintile"), // 1-5
  
  // Piotroski Score Quintile
  piotroskiScoreQuintile: integer("piotroski_score_quintile"), // 1-5
  piotroskiDetails: jsonb('piotroski_details').$type<{
    roa: number;
    cfo: number;
    delta_roa: number;
    accruals: number;
    delta_leverage: number;
    delta_liquidity: number;
    no_equity_issue: number;
    delta_margin: number;
    delta_turnover: number;
  }>(),
  
  // Status tracking
  status: icMemoStatusEnum('status').default('pending').notNull(),
  generationProgress: integer('generation_progress').default(0).notNull(), // 0-100
  errorMessage: text('error_message'),
  
  // Approval tracking
  approvedAt: timestamp('approved_at'), // When packet was approved for IC
  approvedBy: text('approved_by'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  packetIdIdx: index('ic_memos_packet_id_idx').on(table.packetId),
  ideaIdIdx: index('ic_memos_idea_id_idx').on(table.ideaId),
  tickerIdx: index('ic_memos_ticker_idx').on(table.ticker),
  statusIdx: index('ic_memos_status_idx').on(table.status),
}));

// ============================================================================
// QA REPORTS
// ============================================================================

export const qaReports = pgTable('qa_reports', {
  reportId: uuid('report_id').primaryKey().defaultRandom(),
  reportType: text('report_type').notNull(),
  reportDate: timestamp('report_date').defaultNow().notNull(),
  overallScore: integer('overall_score').notNull(),
  status: text('status').notNull(), // pass, warn, fail
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  reportTypeIdx: index('qa_reports_report_type_idx').on(table.reportType),
  reportDateIdx: index('qa_reports_report_date_idx').on(table.reportDate),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SecurityMaster = typeof securityMaster.$inferSelect;
export type NewSecurityMaster = typeof securityMaster.$inferInsert;

export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;

export type Evidence = typeof evidence.$inferSelect;
export type NewEvidence = typeof evidence.$inferInsert;

export type ResearchPacket = typeof researchPackets.$inferSelect;
export type NewResearchPacket = typeof researchPackets.$inferInsert;

export type Decision = typeof decisions.$inferSelect;
export type NewDecision = typeof decisions.$inferInsert;

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;

export type NoveltyState = typeof noveltyState.$inferSelect;
export type NewNoveltyState = typeof noveltyState.$inferInsert;

export type StyleMixState = typeof styleMixState.$inferSelect;
export type NewStyleMixState = typeof styleMixState.$inferInsert;

export type Outcome = typeof outcomes.$inferSelect;
export type NewOutcome = typeof outcomes.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type NewPromptTemplate = typeof promptTemplates.$inferInsert;

export type Watchlist = typeof watchlist.$inferSelect;
export type NewWatchlist = typeof watchlist.$inferInsert;

export type ICMemo = typeof icMemos.$inferSelect;
export type NewICMemo = typeof icMemos.$inferInsert;
