/**
 * ARC Investment Factory - Shared Types
 * Re-exports from constants for convenience
 */

export type {
  StyleTag,
  EdgeType,
  IdeaStatus,
  NextAction,
  GateResult,
  ReliabilityGrade,
  SourceType,
  ClaimType,
  RecommendationType,
  ProbabilityLevel,
  ImpactLevel,
  ValuationMethod,
  FrequencyType,
  DirectionType,
  FailureMode,
  RunType,
} from '../constants/index.js';

/**
 * Generic result type for operations that can fail
 */
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Date range filter
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort parameters
 */
export interface SortParams<T extends string = string> {
  field: T;
  direction: SortDirection;
}
