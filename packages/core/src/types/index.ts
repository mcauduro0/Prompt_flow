/**
 * ARC Investment Factory - Core Types
 * Re-exports from schemas
 */

export type {
  // IdeaCard types
  StyleTag,
  EdgeType,
  IdeaStatus,
  NextAction,
  GateResult,
  ImpactLevel,
  Frequency,
  Direction,
  SourceType,
  QuickMetrics,
  Catalyst,
  Signpost,
  GateResults,
  Score,
  EvidenceRef,
  IdeaCard,
  IdeaCardCreate,
  IdeaCardUpdate,
} from '../schemas/idea-card.schema.js';

export type {
  // ResearchPacket types
  Recommendation,
  ValuationMethod,
  ProbabilityLevel,
  ExecutiveView,
  UnitEconomics,
  BusinessModule,
  IndustryMoatModule,
  FinancialForensicsModule,
  CapitalAllocationModule,
  ManagementQualityModule,
  FairValueRange,
  ValuationModule,
  RiskItem,
  RiskStressModule,
  Modules,
  Scenario,
  Scenarios,
  HistoricalParallel,
  PreMortem,
  KPI,
  MonitoringPlan,
  OpenQuestion,
  AuditTrail,
  ResearchPacket,
  ResearchPacketCreate,
} from '../schemas/research-packet.schema.js';

export type {
  // Evidence types
  ClaimType,
  EvidenceSourceType,
  ReliabilityGrade,
  Evidence,
  EvidenceCreate,
} from '../schemas/evidence.schema.js';

export type {
  // DecisionBrief types
  DecisionCatalyst,
  DecisionValuation,
  DecisionBrief,
  DecisionBriefCreate,
} from '../schemas/decision-brief.schema.js';

export type {
  // Validation types
  ValidationResult,
  ValidationError,
  FixPromptResult,
  SchemaName,
  ValidateWithRetryOptions,
} from '../validation/index.js';
