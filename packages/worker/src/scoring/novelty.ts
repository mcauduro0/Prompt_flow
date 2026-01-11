/**
 * ARC Investment Factory - Novelty Scoring Module
 * Implements the correct novelty model per Operating Parameters:
 * - Ticker is "new" if not seen in 90 days
 * - Repetition penalty if seen in last 30 days with no new edge
 * - Novelty score events and caps
 */

import {
  NOVELTY_SCORING,
  EDGE_TYPES,
  type EdgeType,
} from '@arc/shared';
import { noveltyStateRepository } from '@arc/database';

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

export interface NoveltyState {
  ticker: string;
  lastSeenAt: Date;
  appearanceCount90Days: number;
  lastEdgeType: EdgeType | null;
  lastStyleTag: string | null;
  lastCatalysts: string[];
  lastThemes: string[];
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
  const isNew = isTickerNew(state, now);
  
  // Determine if there's a new edge
  const hasNewEdge = checkNewEdge(state, input.edgeType);
  
  // Determine if style changed
  const hasStyleChange = checkStyleChange(state, input.styleTag);
  
  // Determine if there are new catalysts
  const hasNewCatalyst = checkNewCatalysts(state, input.catalysts);
  
  // Determine if there are new themes
  const hasNewTheme = checkNewThemes(state, input.themes);
  
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
  const repetitionPenalty = calculateRepetitionPenalty(state, now, hasNewEdge);
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
function isTickerNew(state: NoveltyState | null, now: Date): boolean {
  if (!state || !state.lastSeenAt) {
    return true;
  }
  
  const daysSinceLastSeen = Math.floor(
    (now.getTime() - state.lastSeenAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return daysSinceLastSeen >= NOVELTY_SCORING.TICKER_NEW_IF_NOT_SEEN_DAYS;
}

/**
 * Check if there's a new edge type
 */
function checkNewEdge(state: NoveltyState | null, currentEdgeType: EdgeType): boolean {
  if (!state || !state.lastEdgeType) {
    return true;
  }
  
  return state.lastEdgeType !== currentEdgeType;
}

/**
 * Check if style tag changed
 */
function checkStyleChange(state: NoveltyState | null, currentStyleTag: string): boolean {
  if (!state || !state.lastStyleTag) {
    return false;
  }
  
  return state.lastStyleTag !== currentStyleTag;
}

/**
 * Check if there are new catalysts
 */
function checkNewCatalysts(state: NoveltyState | null, currentCatalysts: string[]): boolean {
  if (!state || !state.lastCatalysts || state.lastCatalysts.length === 0) {
    return currentCatalysts.length > 0;
  }
  
  const lastCatalystsSet = new Set(state.lastCatalysts.map(c => c.toLowerCase()));
  return currentCatalysts.some(c => !lastCatalystsSet.has(c.toLowerCase()));
}

/**
 * Check if there are new themes
 */
function checkNewThemes(state: NoveltyState | null, currentThemes: string[]): boolean {
  if (!state || !state.lastThemes || state.lastThemes.length === 0) {
    return currentThemes.length > 0;
  }
  
  const lastThemesSet = new Set(state.lastThemes.map(t => t.toLowerCase()));
  return currentThemes.some(t => !lastThemesSet.has(t.toLowerCase()));
}

/**
 * Calculate repetition penalty
 * Applied if seen in last 30 days with NO new edge
 */
function calculateRepetitionPenalty(
  state: NoveltyState | null,
  now: Date,
  hasNewEdge: boolean
): number {
  if (!state || !state.lastSeenAt) {
    return 0;
  }
  
  const daysSinceLastSeen = Math.floor(
    (now.getTime() - state.lastSeenAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // No penalty if not seen in last 30 days
  if (daysSinceLastSeen >= NOVELTY_SCORING.REPETITION_PENALTY_WINDOW_DAYS) {
    return 0;
  }
  
  // No penalty if there's a new edge
  if (hasNewEdge) {
    return 0;
  }
  
  // Apply penalty for being seen in last 30 days with no new edge
  let penalty = NOVELTY_SCORING.SEEN_IN_LAST_30_DAYS_NO_NEW_EDGE_PENALTY;
  
  // Additional penalty if seen more than 3 times in 90 days
  if (state.appearanceCount90Days > 3) {
    penalty += NOVELTY_SCORING.SEEN_MORE_THAN_3_TIMES_IN_90_DAYS_PENALTY;
  }
  
  // Cap the penalty
  const maxPenalty = NOVELTY_SCORING.MAX_REPETITION_PENALTY * 100;
  return Math.max(penalty, -maxPenalty);
}

/**
 * Calculate disclosure friction penalty
 */
function calculateDisclosureFrictionPenalty(hasFilings: boolean, hasPeerSet: boolean): number {
  let penalty = 0;
  
  if (!hasFilings) {
    penalty += NOVELTY_SCORING.MISSING_FILINGS_OR_TRANSCRIPT_PENALTY;
  }
  
  if (!hasPeerSet) {
    penalty += NOVELTY_SCORING.MISSING_PEER_SET_PENALTY;
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
  inputs: NoveltyInput[],
  filingStatus: Map<string, boolean>,
  peerSetStatus: Map<string, boolean>
): Promise<Map<string, NoveltyResult>> {
  const results = new Map<string, NoveltyResult>();
  
  for (const input of inputs) {
    const hasFilings = filingStatus.get(input.ticker) ?? true;
    const hasPeerSet = peerSetStatus.get(input.ticker) ?? true;
    
    const result = await calculateNoveltyScore(input, hasFilings, hasPeerSet);
    results.set(input.ticker, result);
  }
  
  return results;
}

// ============================================================================
// STATE UPDATES
// ============================================================================

/**
 * Update novelty state after processing an idea
 */
export async function updateNoveltyState(
  ticker: string,
  edgeType: EdgeType,
  styleTag: string,
  catalysts: string[],
  themes: string[]
): Promise<void> {
  const now = new Date();
  const existingState = await noveltyStateRepository.getByTicker(ticker);
  
  if (existingState) {
    // Update existing state
    await noveltyStateRepository.update(ticker, {
      lastSeenAt: now,
      appearanceCount90Days: existingState.appearanceCount90Days + 1,
      lastEdgeType: edgeType,
      lastStyleTag: styleTag,
      lastCatalysts: catalysts,
      lastThemes: themes,
    });
  } else {
    // Create new state
    await noveltyStateRepository.create({
      ticker,
      lastSeenAt: now,
      appearanceCount90Days: 1,
      lastEdgeType: edgeType,
      lastStyleTag: styleTag,
      lastCatalysts: catalysts,
      lastThemes: themes,
    });
  }
}

/**
 * Decay old appearance counts (run daily)
 * Removes appearances older than 90 days from the count
 */
export async function decayAppearanceCounts(): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  
  await noveltyStateRepository.decayAppearanceCounts(cutoffDate);
}
