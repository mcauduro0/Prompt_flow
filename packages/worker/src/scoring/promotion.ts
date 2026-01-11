/**
 * ARC Investment Factory - Promotion Threshold Module
 * Implements the full promotion threshold table with style-specific logic:
 * - Default: 70/100
 * - Quality Compounder & GARP: can promote at 68 if edge_clarity >= 16/20
 * - Cigar Butt: requires 72 unless downside_protection >= 13/15
 * - Weekly quota adjustment: +3 when style overweight by >10pp
 */

import {
  PROMOTION_THRESHOLDS,
  STYLE_MIX_TARGETS,
  OPERATING_PARAMETERS,
  type StyleTag,
} from '@arc/shared';
import { styleMixStateRepository, ideasRepository } from '@arc/database';

// ============================================================================
// TYPES
// ============================================================================

export interface PromotionInput {
  ideaId: string;
  ticker: string;
  styleTag: StyleTag;
  totalScore: number;
  edgeClarity: number;       // 0-20
  downsideProtection: number; // 0-15
}

export interface PromotionResult {
  ideaId: string;
  ticker: string;
  canPromote: boolean;
  threshold: number;
  adjustedThreshold: number;
  score: number;
  margin: number;
  reason: string;
  styleQuotaAdjustment: number;
  breakdown: PromotionBreakdown;
}

export interface PromotionBreakdown {
  baseThreshold: number;
  styleSpecificThreshold: number;
  styleQuotaAdjustment: number;
  finalThreshold: number;
  edgeClarity: number;
  downsideProtection: number;
  styleTag: StyleTag;
  styleOverweightPp: number;
}

export interface WeeklyQuotaState {
  qualityCompounder: number;
  garp: number;
  cigarButt: number;
  total: number;
}

// ============================================================================
// PROMOTION THRESHOLD CALCULATOR
// ============================================================================

/**
 * Calculate promotion threshold for a single idea
 */
export async function calculatePromotionThreshold(
  input: PromotionInput
): Promise<PromotionResult> {
  // Get current weekly quota state
  const quotaState = await getWeeklyQuotaState();
  
  // Calculate style overweight
  const styleOverweightPp = calculateStyleOverweight(input.styleTag, quotaState);
  
  // Get base threshold for style
  const baseThreshold = getBaseThreshold(input.styleTag);
  
  // Apply style-specific logic
  const styleSpecificThreshold = applyStyleSpecificLogic(
    input.styleTag,
    baseThreshold,
    input.edgeClarity,
    input.downsideProtection
  );
  
  // Apply weekly quota adjustment
  const styleQuotaAdjustment = styleOverweightPp > PROMOTION_THRESHOLDS.WEEKLY_QUOTA_OVERWEIGHT_PP_THRESHOLD
    ? PROMOTION_THRESHOLDS.WEEKLY_QUOTA_THRESHOLD_ADD
    : 0;
  
  const finalThreshold = styleSpecificThreshold + styleQuotaAdjustment;
  
  // Determine if can promote
  const canPromote = input.totalScore >= finalThreshold;
  const margin = input.totalScore - finalThreshold;
  
  // Generate reason
  const reason = generatePromotionReason(
    canPromote,
    input.styleTag,
    input.totalScore,
    finalThreshold,
    styleQuotaAdjustment,
    input.edgeClarity,
    input.downsideProtection
  );
  
  return {
    ideaId: input.ideaId,
    ticker: input.ticker,
    canPromote,
    threshold: baseThreshold,
    adjustedThreshold: finalThreshold,
    score: input.totalScore,
    margin,
    reason,
    styleQuotaAdjustment,
    breakdown: {
      baseThreshold,
      styleSpecificThreshold,
      styleQuotaAdjustment,
      finalThreshold,
      edgeClarity: input.edgeClarity,
      downsideProtection: input.downsideProtection,
      styleTag: input.styleTag,
      styleOverweightPp,
    },
  };
}

/**
 * Get base threshold for a style
 */
function getBaseThreshold(styleTag: StyleTag): number {
  switch (styleTag) {
    case 'cigar_butt':
      return PROMOTION_THRESHOLDS.CIGAR_BUTT_DEFAULT_SCORE;
    default:
      return PROMOTION_THRESHOLDS.DEFAULT_TOTAL_SCORE;
  }
}

/**
 * Apply style-specific logic to threshold
 */
function applyStyleSpecificLogic(
  styleTag: StyleTag,
  baseThreshold: number,
  edgeClarity: number,
  downsideProtection: number
): number {
  switch (styleTag) {
    case 'quality_compounder':
    case 'garp':
      // Can promote at 68 if edge_clarity >= 16/20
      if (edgeClarity >= PROMOTION_THRESHOLDS.HIGH_EDGE_THRESHOLD) {
        return PROMOTION_THRESHOLDS.QUALITY_OR_GARP_HIGH_EDGE_SCORE;
      }
      return PROMOTION_THRESHOLDS.DEFAULT_TOTAL_SCORE;
      
    case 'cigar_butt':
      // Requires 72 unless downside_protection >= 13/15
      if (downsideProtection >= PROMOTION_THRESHOLDS.CIGAR_BUTT_DOWNSIDE_PROTECTION_OVERRIDE_MIN) {
        return PROMOTION_THRESHOLDS.DEFAULT_TOTAL_SCORE;
      }
      return PROMOTION_THRESHOLDS.CIGAR_BUTT_DEFAULT_SCORE;
      
    default:
      return baseThreshold;
  }
}

/**
 * Calculate how overweight a style is compared to target
 */
function calculateStyleOverweight(styleTag: StyleTag, quotaState: WeeklyQuotaState): number {
  if (quotaState.total === 0) {
    return 0;
  }
  
  const currentPct = getStyleCount(styleTag, quotaState) / quotaState.total;
  const targetPct = getStyleTarget(styleTag);
  
  return currentPct - targetPct;
}

/**
 * Get current count for a style
 */
function getStyleCount(styleTag: StyleTag, quotaState: WeeklyQuotaState): number {
  switch (styleTag) {
    case 'quality_compounder':
      return quotaState.qualityCompounder;
    case 'garp':
      return quotaState.garp;
    case 'cigar_butt':
      return quotaState.cigarButt;
    default:
      return 0;
  }
}

/**
 * Get target percentage for a style
 */
function getStyleTarget(styleTag: StyleTag): number {
  switch (styleTag) {
    case 'quality_compounder':
      return STYLE_MIX_TARGETS.QUALITY_COMPOUNDER;
    case 'garp':
      return STYLE_MIX_TARGETS.GARP;
    case 'cigar_butt':
      return STYLE_MIX_TARGETS.CIGAR_BUTT;
    default:
      return 0;
  }
}

/**
 * Generate human-readable promotion reason
 */
function generatePromotionReason(
  canPromote: boolean,
  styleTag: StyleTag,
  score: number,
  threshold: number,
  quotaAdjustment: number,
  edgeClarity: number,
  downsideProtection: number
): string {
  if (canPromote) {
    const parts = [`Score ${score} meets threshold ${threshold}`];
    
    if (styleTag === 'quality_compounder' || styleTag === 'garp') {
      if (edgeClarity >= PROMOTION_THRESHOLDS.HIGH_EDGE_THRESHOLD) {
        parts.push(`(reduced from 70 due to high edge clarity ${edgeClarity}/20)`);
      }
    } else if (styleTag === 'cigar_butt') {
      if (downsideProtection >= PROMOTION_THRESHOLDS.CIGAR_BUTT_DOWNSIDE_PROTECTION_OVERRIDE_MIN) {
        parts.push(`(reduced from 72 due to strong downside protection ${downsideProtection}/15)`);
      }
    }
    
    return parts.join(' ');
  } else {
    const parts = [`Score ${score} below threshold ${threshold}`];
    
    if (quotaAdjustment > 0) {
      parts.push(`(+${quotaAdjustment} quota adjustment applied)`);
    }
    
    if (styleTag === 'quality_compounder' || styleTag === 'garp') {
      if (edgeClarity < PROMOTION_THRESHOLDS.HIGH_EDGE_THRESHOLD) {
        parts.push(`Edge clarity ${edgeClarity}/20 below ${PROMOTION_THRESHOLDS.HIGH_EDGE_THRESHOLD} for reduced threshold`);
      }
    } else if (styleTag === 'cigar_butt') {
      if (downsideProtection < PROMOTION_THRESHOLDS.CIGAR_BUTT_DOWNSIDE_PROTECTION_OVERRIDE_MIN) {
        parts.push(`Downside protection ${downsideProtection}/15 below ${PROMOTION_THRESHOLDS.CIGAR_BUTT_DOWNSIDE_PROTECTION_OVERRIDE_MIN} for reduced threshold`);
      }
    }
    
    return parts.join('. ');
  }
}

// ============================================================================
// WEEKLY QUOTA MANAGEMENT
// ============================================================================

/**
 * Get current weekly quota state
 */
export async function getWeeklyQuotaState(): Promise<WeeklyQuotaState> {
  const state = await styleMixStateRepository.getCurrentWeekState();
  
  if (!state) {
    return {
      qualityCompounder: 0,
      garp: 0,
      cigarButt: 0,
      total: 0,
    };
  }
  
  return {
    qualityCompounder: state.qualityCompounderCount,
    garp: state.garpCount,
    cigarButt: state.cigarButtCount,
    total: state.qualityCompounderCount + state.garpCount + state.cigarButtCount,
  };
}

/**
 * Check if daily promotion limit is reached
 */
export async function isDailyPromotionLimitReached(): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const promotedToday = await ideasRepository.countPromotedOnDate(today);
  
  return promotedToday >= OPERATING_PARAMETERS.LANE_B_DAILY_PROMOTIONS_MAX;
}

/**
 * Check if weekly deep packet limit is reached
 */
export async function isWeeklyPacketLimitReached(): Promise<boolean> {
  const quotaState = await getWeeklyQuotaState();
  return quotaState.total >= OPERATING_PARAMETERS.LANE_B_WEEKLY_DEEP_PACKETS;
}

/**
 * Get remaining daily promotions
 */
export async function getRemainingDailyPromotions(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const promotedToday = await ideasRepository.countPromotedOnDate(today);
  
  return Math.max(0, OPERATING_PARAMETERS.LANE_B_DAILY_PROMOTIONS_MAX - promotedToday);
}

/**
 * Get remaining weekly packets
 */
export async function getRemainingWeeklyPackets(): Promise<number> {
  const quotaState = await getWeeklyQuotaState();
  return Math.max(0, OPERATING_PARAMETERS.LANE_B_WEEKLY_DEEP_PACKETS - quotaState.total);
}

/**
 * Update quota state after promotion
 */
export async function updateQuotaAfterPromotion(styleTag: StyleTag): Promise<void> {
  await styleMixStateRepository.incrementStyleCount(styleTag);
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Calculate promotion thresholds for multiple ideas
 */
export async function calculateBatchPromotionThresholds(
  inputs: PromotionInput[]
): Promise<Map<string, PromotionResult>> {
  const results = new Map<string, PromotionResult>();
  
  for (const input of inputs) {
    const result = await calculatePromotionThreshold(input);
    results.set(input.ideaId, result);
  }
  
  return results;
}

/**
 * Select ideas for promotion respecting limits
 */
export async function selectIdeasForPromotion(
  candidates: PromotionResult[]
): Promise<PromotionResult[]> {
  // Filter to only promotable candidates
  const promotable = candidates.filter(c => c.canPromote);
  
  // Sort by margin (highest first)
  promotable.sort((a, b) => b.margin - a.margin);
  
  // Check limits
  const remainingDaily = await getRemainingDailyPromotions();
  const remainingWeekly = await getRemainingWeeklyPackets();
  
  const maxToPromote = Math.min(
    remainingDaily,
    remainingWeekly,
    OPERATING_PARAMETERS.LANE_B_DAILY_PROMOTIONS_TARGET
  );
  
  // Select top candidates
  return promotable.slice(0, maxToPromote);
}
