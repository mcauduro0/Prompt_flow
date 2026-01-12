/**
 * ARC Investment Factory - Promotion Threshold Module
 * Implements the full promotion threshold table with style-specific logic
 * per Operating Parameters specification.
 */

import {
  PROMOTION_THRESHOLDS,
  STYLE_MIX_TARGETS,
  OPERATING_PARAMETERS,
} from '@arc/shared';
import { styleMixStateRepository, ideasRepository } from '@arc/database';

// ============================================================================
// TYPES
// ============================================================================

export interface PromotionCandidate {
  ideaId: string;
  ticker: string;
  styleTag: 'quality_compounder' | 'garp' | 'cigar_butt';
  totalScore: number;
  qualityScore: number;
  growthScore: number;
  valuationScore: number;
  downsideProtection: number;
  noveltyScore: number;
}

export interface PromotionDecision {
  ideaId: string;
  ticker: string;
  styleTag: string;
  shouldPromote: boolean;
  reason: string;
  thresholdUsed: number;
  scoreAchieved: number;
  quotaStatus: QuotaStatus;
}

export interface QuotaStatus {
  dailyUsed: number;
  dailyMax: number;
  weeklyUsed: number;
  weeklyMax: number;
  styleQuota: {
    qualityCompounder: number;
    garp: number;
    cigarButt: number;
  };
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
 * Calculate the promotion threshold for a given style
 * Implements the full threshold table from Operating Parameters
 */
export async function getPromotionThreshold(
  styleTag: 'quality_compounder' | 'garp' | 'cigar_butt',
  candidate?: PromotionCandidate
): Promise<number> {
  // Get base threshold for style
  let baseThreshold: number;
  
  if (styleTag === 'cigar_butt') {
    baseThreshold = PROMOTION_THRESHOLDS.CIGAR_BUTT_DEFAULT_SCORE;
  } else {
    baseThreshold = PROMOTION_THRESHOLDS.DEFAULT_TOTAL_SCORE;
  }
  
  // Get weekly quota adjustment
  const quotaAdjustment = await getWeeklyQuotaAdjustment(styleTag);
  
  // Apply style-specific overrides if candidate data is available
  let styleOverride = 0;
  if (candidate) {
    styleOverride = getStyleSpecificOverride(styleTag, candidate);
  }
  
  return baseThreshold + quotaAdjustment + styleOverride;
}

/**
 * Get weekly quota adjustment based on current style mix
 */
async function getWeeklyQuotaAdjustment(
  styleTag: 'quality_compounder' | 'garp' | 'cigar_butt'
): Promise<number> {
  const state = await styleMixStateRepository.getCurrentWeek();
  
  if (!state || state.totalPromoted === 0) {
    return 0;
  }
  
  const total = state.totalPromoted;
  const currentPercentage = {
    quality_compounder: state.qualityCompounderCount / total,
    garp: state.garpCount / total,
    cigar_butt: state.cigarButtCount / total,
  };
  
  const targetPercentage = {
    quality_compounder: STYLE_MIX_TARGETS.QUALITY_COMPOUNDER,
    garp: STYLE_MIX_TARGETS.GARP,
    cigar_butt: STYLE_MIX_TARGETS.CIGAR_BUTT,
  };
  
  const deviation = currentPercentage[styleTag] - targetPercentage[styleTag];
  
  // If style is overweight by more than threshold, increase threshold
  if (deviation > PROMOTION_THRESHOLDS.WEEKLY_QUOTA_OVERWEIGHT_PP_THRESHOLD) {
    return PROMOTION_THRESHOLDS.WEEKLY_QUOTA_THRESHOLD_ADD;
  }
  
  return 0;
}

/**
 * Get style-specific threshold overrides based on candidate metrics
 */
function getStyleSpecificOverride(
  styleTag: 'quality_compounder' | 'garp' | 'cigar_butt',
  candidate: PromotionCandidate
): number {
  switch (styleTag) {
    case 'quality_compounder':
      return getQualityCompounderOverride(candidate);
    case 'garp':
      return getGarpOverride(candidate);
    case 'cigar_butt':
      return getCigarButtOverride(candidate);
    default:
      return 0;
  }
}

/**
 * Quality Compounder specific overrides
 */
function getQualityCompounderOverride(candidate: PromotionCandidate): number {
  // If quality score is exceptional, reduce threshold
  if (candidate.qualityScore >= PROMOTION_THRESHOLDS.QUALITY_COMPOUNDER_QUALITY_OVERRIDE_MIN) {
    return -PROMOTION_THRESHOLDS.QUALITY_COMPOUNDER_QUALITY_OVERRIDE_REDUCTION;
  }
  return 0;
}

/**
 * GARP specific overrides
 */
function getGarpOverride(candidate: PromotionCandidate): number {
  // If growth score is exceptional, reduce threshold
  if (candidate.growthScore >= PROMOTION_THRESHOLDS.GARP_GROWTH_OVERRIDE_MIN) {
    return -PROMOTION_THRESHOLDS.GARP_GROWTH_OVERRIDE_REDUCTION;
  }
  return 0;
}

/**
 * Cigar Butt specific overrides
 */
function getCigarButtOverride(candidate: PromotionCandidate): number {
  let override = 0;
  
  // Valuation override - if extremely cheap
  if (candidate.valuationScore >= PROMOTION_THRESHOLDS.CIGAR_BUTT_VALUATION_OVERRIDE_MIN) {
    override -= PROMOTION_THRESHOLDS.CIGAR_BUTT_VALUATION_OVERRIDE_REDUCTION;
  }
  
  // Downside protection override - if well protected
  if (candidate.downsideProtection >= PROMOTION_THRESHOLDS.CIGAR_BUTT_DOWNSIDE_PROTECTION_OVERRIDE_MIN) {
    override -= PROMOTION_THRESHOLDS.CIGAR_BUTT_DOWNSIDE_PROTECTION_OVERRIDE_REDUCTION;
  }
  
  return override;
}

// ============================================================================
// PROMOTION DECISION
// ============================================================================

/**
 * Evaluate a candidate for promotion
 */
export async function evaluatePromotion(
  candidate: PromotionCandidate
): Promise<PromotionDecision> {
  // Get threshold for this style
  const threshold = await getPromotionThreshold(candidate.styleTag, candidate);
  
  // Check quota status
  const quotaStatus = await getQuotaStatus();
  
  // Check if quotas allow promotion
  const quotaAllows = 
    quotaStatus.dailyUsed < quotaStatus.dailyMax &&
    quotaStatus.weeklyUsed < quotaStatus.weeklyMax;
  
  // Determine if should promote
  const meetsThreshold = candidate.totalScore >= threshold;
  const shouldPromote = meetsThreshold && quotaAllows;
  
  // Build reason
  let reason: string;
  if (!quotaAllows) {
    if (quotaStatus.dailyUsed >= quotaStatus.dailyMax) {
      reason = `Daily promotion limit reached (${quotaStatus.dailyUsed}/${quotaStatus.dailyMax})`;
    } else {
      reason = `Weekly packet limit reached (${quotaStatus.weeklyUsed}/${quotaStatus.weeklyMax})`;
    }
  } else if (!meetsThreshold) {
    reason = `Score ${candidate.totalScore.toFixed(1)} below threshold ${threshold.toFixed(1)} for ${candidate.styleTag}`;
  } else {
    reason = `Score ${candidate.totalScore.toFixed(1)} meets threshold ${threshold.toFixed(1)} for ${candidate.styleTag}`;
  }
  
  return {
    ideaId: candidate.ideaId,
    ticker: candidate.ticker,
    styleTag: candidate.styleTag,
    shouldPromote,
    reason,
    thresholdUsed: threshold,
    scoreAchieved: candidate.totalScore,
    quotaStatus,
  };
}

/**
 * Batch evaluate candidates for promotion
 */
export async function evaluatePromotionBatch(
  candidates: PromotionCandidate[]
): Promise<PromotionDecision[]> {
  const decisions: PromotionDecision[] = [];
  
  // Sort by score descending to prioritize best candidates
  const sorted = [...candidates].sort((a, b) => b.totalScore - a.totalScore);
  
  for (const candidate of sorted) {
    const decision = await evaluatePromotion(candidate);
    decisions.push(decision);
  }
  
  return decisions;
}

// ============================================================================
// QUOTA MANAGEMENT
// ============================================================================

/**
 * Get current quota status
 */
export async function getQuotaStatus(): Promise<QuotaStatus> {
  const weeklyState = await getWeeklyQuotaState();
  
  // For daily count, we need to count ideas promoted today
  // Since we don't have a direct method, we'll estimate from weekly
  const dailyUsed = Math.min(weeklyState.total, OPERATING_PARAMETERS.LANE_B_DAILY_PROMOTIONS_MAX);
  
  return {
    dailyUsed,
    dailyMax: OPERATING_PARAMETERS.LANE_B_DAILY_PROMOTIONS_MAX,
    weeklyUsed: weeklyState.total,
    weeklyMax: OPERATING_PARAMETERS.LANE_B_WEEKLY_DEEP_PACKETS,
    styleQuota: {
      qualityCompounder: weeklyState.qualityCompounder,
      garp: weeklyState.garp,
      cigarButt: weeklyState.cigarButt,
    },
  };
}

/**
 * Get current weekly quota state
 */
export async function getWeeklyQuotaState(): Promise<WeeklyQuotaState> {
  const state = await styleMixStateRepository.getCurrentWeek();
  
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
    total: state.totalPromoted,
  };
}

/**
 * Check if daily promotion limit is reached
 */
export async function isDailyPromotionLimitReached(): Promise<boolean> {
  const quotaStatus = await getQuotaStatus();
  return quotaStatus.dailyUsed >= quotaStatus.dailyMax;
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
  const quotaStatus = await getQuotaStatus();
  return Math.max(0, quotaStatus.dailyMax - quotaStatus.dailyUsed);
}

/**
 * Get remaining weekly packets
 */
export async function getRemainingWeeklyPackets(): Promise<number> {
  const quotaState = await getWeeklyQuotaState();
  return Math.max(0, OPERATING_PARAMETERS.LANE_B_WEEKLY_DEEP_PACKETS - quotaState.total);
}

/**
 * Record a promotion (update quota state)
 */
export async function recordPromotion(
  styleTag: 'quality_compounder' | 'garp' | 'cigar_butt'
): Promise<void> {
  await styleMixStateRepository.incrementStyleCount(styleTag);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const promotionThresholds = {
  getPromotionThreshold,
  evaluatePromotion,
  evaluatePromotionBatch,
  getQuotaStatus,
  getWeeklyQuotaState,
  isDailyPromotionLimitReached,
  isWeeklyPacketLimitReached,
  getRemainingDailyPromotions,
  getRemainingWeeklyPackets,
  recordPromotion,
};
