/**
 * ARC Investment Factory - Novelty Scoring Module
 * Implements the correct novelty model per Operating Parameters:
 * - Ticker is "new" if not seen in 90 days
 * - Repetition penalty if seen in last 30 days with no new edge
 * - Novelty score events and caps
 */

import {
  NOVELTY_SCORING,
  type EdgeType,
} from '@arc/shared';
import { noveltyStateRepository } from '@arc/database';

// ============================================================================
// LOCAL CONSTANTS (derived from NOVELTY_SCORING)
// ============================================================================

const DISCLOSURE_FRICTION_PENALTY = -5; // Missing filings or peer set penalty

// ============================================================================
// TYPES
// ============================================================================

export interface NoveltyInput {
  ticker: string;
  edgeType: EdgeType;
  styleTag: string;
  catalysts: string[];
  themes: string[];
}

// Database NoveltyState type (matches schema)
interface DbNoveltyState {
  ticker: string;
  lastSeen: Date;
  lastEdgeTypes: string[] | null;
  lastStyleTag: string | null;
  seenCount: number;
  firstSeen: Date;
}

export interface NoveltyResult {
  ticker: string;
  noveltyScore: number;
  isNew: boolean;
  hasNewEdge: boolean;
  hasStyleChange: boolean;
  hasNewCatalyst: boolean;
  hasNewTheme: boolean;
  repetitionPenalty: number;
  disclosureFrictionPenalty: number;
  breakdown: NoveltyBreakdown;
}

export interface NoveltyBreakdown {
  baseScore: number;
  newTickerBonus: number;
  newEdgeBonus: number;
  styleChangeBonus: number;
  newCatalystBonus: number;
  newThemeBonus: number;
  repetitionPenalty: number;
  disclosureFrictionPenalty: number;
  finalScore: number;
}

// ============================================================================
// NOVELTY CALCULATOR
// ============================================================================

/**
 * Calculate novelty score for a single idea
 */
export async function calculateNoveltyScore(
  input: NoveltyInput,
  hasFilings: boolean = true,
  hasPeerSet: boolean = true
): Promise<NoveltyResult> {
  const now = new Date();
  const state = await noveltyStateRepository.getByTicker(input.ticker);
  
  // Initialize breakdown
  const breakdown: NoveltyBreakdown = {
    baseScore: 0,
    newTickerBonus: 0,
    newEdgeBonus: 0,
    styleChangeBonus: 0,
    newCatalystBonus: 0,
    newThemeBonus: 0,
    repetitionPenalty: 0,
    disclosureFrictionPenalty: 0,
    finalScore: 0,
  };
  
  // Determine if ticker is "new" (not seen in 90 days)
  const isNew = isTickerNew(state ?? null, now);
  
  // Determine if there's a new edge
  const hasNewEdge = checkNewEdge(state ?? null, input.edgeType);
  
  // Determine if style changed
  const hasStyleChange = checkStyleChange(state ?? null, input.styleTag);
  
  // Determine if there are new catalysts (simplified - always true for new tickers)
  const hasNewCatalyst = !state;
  
  // Determine if there are new themes (simplified - always true for new tickers)
  const hasNewTheme = !state;
  
  // Calculate base score
  if (isNew) {
    breakdown.newTickerBonus = NOVELTY_SCORING.TICKER_NEW_BONUS;
  }
  
  // Add bonuses for novelty factors
  if (hasNewEdge) {
    breakdown.newEdgeBonus = NOVELTY_SCORING.NEW_EDGE_TYPE_BONUS;
  }
  
  if (hasStyleChange) {
    breakdown.styleChangeBonus = NOVELTY_SCORING.STYLE_TAG_CHANGED_BONUS;
  }
  
  if (hasNewCatalyst) {
    breakdown.newCatalystBonus = NOVELTY_SCORING.NEW_CATALYST_WINDOW_BONUS;
  }
  
  if (hasNewTheme) {
    breakdown.newThemeBonus = NOVELTY_SCORING.NEW_THEME_INTERSECTION_BONUS;
  }
  
  // Calculate repetition penalty (only if seen in last 30 days with NO new edge)
  const repetitionPenalty = calculateRepetitionPenalty(state ?? null, now, hasNewEdge);
  breakdown.repetitionPenalty = repetitionPenalty;
  
  // Calculate disclosure friction penalty
  const disclosureFrictionPenalty = calculateDisclosureFrictionPenalty(hasFilings, hasPeerSet);
  breakdown.disclosureFrictionPenalty = disclosureFrictionPenalty;
  
  // Sum up the score
  let totalScore = 
    breakdown.newTickerBonus +
    breakdown.newEdgeBonus +
    breakdown.styleChangeBonus +
    breakdown.newCatalystBonus +
    breakdown.newThemeBonus +
    breakdown.repetitionPenalty +  // Already negative
    breakdown.disclosureFrictionPenalty;  // Already negative
  
  // Apply cap
  totalScore = Math.min(totalScore, NOVELTY_SCORING.NOVELTY_SCORE_CAP);
  
  // Apply floor
  totalScore = Math.max(totalScore, NOVELTY_SCORING.MIN_NOVELTY_SCORE * 100);
  
  breakdown.finalScore = totalScore;
  
  return {
    ticker: input.ticker,
    noveltyScore: totalScore,
    isNew,
    hasNewEdge,
    hasStyleChange,
    hasNewCatalyst,
    hasNewTheme,
    repetitionPenalty,
    disclosureFrictionPenalty,
    breakdown,
  };
}

/**
 * Check if ticker is "new" (not seen in 90 days)
 */
function isTickerNew(state: DbNoveltyState | null, now: Date): boolean {
  if (!state || !state.lastSeen) {
    return true;
  }
  
  const daysSinceLastSeen = Math.floor(
    (now.getTime() - state.lastSeen.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return daysSinceLastSeen >= NOVELTY_SCORING.TICKER_NEW_IF_NOT_SEEN_DAYS;
}

/**
 * Check if there's a new edge type
 */
function checkNewEdge(state: DbNoveltyState | null, currentEdgeType: EdgeType): boolean {
  if (!state || !state.lastEdgeTypes || state.lastEdgeTypes.length === 0) {
    return true;
  }
  
  return !state.lastEdgeTypes.includes(currentEdgeType);
}

/**
 * Check if style tag changed
 */
function checkStyleChange(state: DbNoveltyState | null, currentStyleTag: string): boolean {
  if (!state || !state.lastStyleTag) {
    return false;
  }
  
  return state.lastStyleTag !== currentStyleTag;
}

/**
 * Calculate repetition penalty
 * Only applies if seen in last 30 days with NO new edge
 */
function calculateRepetitionPenalty(
  state: DbNoveltyState | null,
  now: Date,
  hasNewEdge: boolean
): number {
  if (!state || !state.lastSeen) {
    return 0;
  }
  
  // If there's a new edge, no penalty
  if (hasNewEdge) {
    return 0;
  }
  
  const daysSinceLastSeen = Math.floor(
    (now.getTime() - state.lastSeen.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Only apply penalty if seen in last 30 days
  if (daysSinceLastSeen > NOVELTY_SCORING.REPETITION_PENALTY_WINDOW_DAYS) {
    return 0;
  }
  
  // Calculate penalty based on appearance count
  const appearanceCount = state.seenCount || 1;
  const penaltyPerAppearance = NOVELTY_SCORING.REPETITION_PENALTY_PER_APPEARANCE;
  
  return -Math.min(
    appearanceCount * penaltyPerAppearance * 100,
    NOVELTY_SCORING.MAX_REPETITION_PENALTY * 100
  );
}

/**
 * Calculate disclosure friction penalty
 */
function calculateDisclosureFrictionPenalty(hasFilings: boolean, hasPeerSet: boolean): number {
  let penalty = 0;
  
  if (!hasFilings) {
    penalty += DISCLOSURE_FRICTION_PENALTY;
  }
  
  if (!hasPeerSet) {
    penalty += DISCLOSURE_FRICTION_PENALTY;
  }
  
  return penalty;
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Calculate novelty scores for multiple ideas
 */
export async function calculateBatchNoveltyScores(
  inputs: NoveltyInput[]
): Promise<NoveltyResult[]> {
  const results: NoveltyResult[] = [];
  
  for (const input of inputs) {
    const result = await calculateNoveltyScore(input);
    results.push(result);
  }
  
  return results;
}

/**
 * Filter ideas by novelty threshold
 */
export function filterByNoveltyThreshold(
  results: NoveltyResult[],
  threshold: number = NOVELTY_SCORING.MIN_NOVELTY_SCORE * 100
): NoveltyResult[] {
  return results.filter(r => r.noveltyScore >= threshold);
}

/**
 * Sort ideas by novelty score (descending)
 */
export function sortByNoveltyScore(results: NoveltyResult[]): NoveltyResult[] {
  return [...results].sort((a, b) => b.noveltyScore - a.noveltyScore);
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Update novelty state after idea is processed
 */
export async function updateNoveltyState(
  ticker: string,
  edgeTypes: string[],
  styleTag: string
): Promise<void> {
  await noveltyStateRepository.upsert({
    ticker,
    lastSeen: new Date(),
    lastEdgeTypes: edgeTypes,
    lastStyleTag: styleTag,
  });
}

/**
 * Batch update novelty states
 */
export async function batchUpdateNoveltyStates(
  updates: Array<{ ticker: string; edgeTypes: string[]; styleTag: string }>
): Promise<void> {
  const states = updates.map(u => ({
    ticker: u.ticker,
    lastSeen: new Date(),
    lastEdgeTypes: u.edgeTypes,
    lastStyleTag: u.styleTag,
  }));
  
  await noveltyStateRepository.upsertMany(states);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const noveltyScoring = {
  calculateNoveltyScore,
  calculateBatchNoveltyScores,
  filterByNoveltyThreshold,
  sortByNoveltyScore,
  updateNoveltyState,
  batchUpdateNoveltyStates,
};
