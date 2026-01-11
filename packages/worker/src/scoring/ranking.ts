/**
 * ARC Investment Factory - Ranking Module
 * Implements the idea ranking algorithm per Operating Parameters
 */

import {
  LANE_A_SCORE_RANGES,
  RANKING_WEIGHTS,
} from '@arc/shared';

// ============================================================================
// TYPES
// ============================================================================

export interface ScoreComponents {
  edgeClarity: number;              // 0-20
  businessQualityPrior: number;     // 0-15
  financialResiliencePrior: number; // 0-15
  valuationTension: number;         // 0-15
  catalystClarity: number;          // 0-10
  informationAvailability: number;  // 0-10
  complexityPenalty: number;        // 0-10 (subtracted)
  disclosureFrictionPenalty: number; // 0-5 (subtracted)
}

export interface RankingInput {
  ideaId: string;
  ticker: string;
  scoreComponents: ScoreComponents;
  noveltyScore: number;
}

export interface RankingResult {
  ideaId: string;
  ticker: string;
  totalScore: number;
  rankScore: number;  // For display, includes novelty weight
  rank: number;
  breakdown: RankingBreakdown;
}

export interface RankingBreakdown {
  edgeClarity: number;
  businessQualityPrior: number;
  financialResiliencePrior: number;
  valuationTension: number;
  catalystClarity: number;
  informationAvailability: number;
  complexityPenalty: number;
  disclosureFrictionPenalty: number;
  subtotal: number;
  noveltyScore: number;
  noveltyWeightedContribution: number;
  totalScore: number;
  rankScore: number;
}

// ============================================================================
// SCORE CALCULATION
// ============================================================================

/**
 * Calculate total score for an idea (0-100 scale)
 */
export function calculateTotalScore(components: ScoreComponents): number {
  // Validate and clamp each component
  const edgeClarity = clamp(components.edgeClarity, 0, LANE_A_SCORE_RANGES.EDGE_CLARITY.max);
  const businessQualityPrior = clamp(components.businessQualityPrior, 0, LANE_A_SCORE_RANGES.BUSINESS_QUALITY_PRIOR.max);
  const financialResiliencePrior = clamp(components.financialResiliencePrior, 0, LANE_A_SCORE_RANGES.FINANCIAL_RESILIENCE_PRIOR.max);
  const valuationTension = clamp(components.valuationTension, 0, LANE_A_SCORE_RANGES.VALUATION_TENSION.max);
  const catalystClarity = clamp(components.catalystClarity, 0, LANE_A_SCORE_RANGES.CATALYST_CLARITY.max);
  const informationAvailability = clamp(components.informationAvailability, 0, LANE_A_SCORE_RANGES.INFORMATION_AVAILABILITY.max);
  const complexityPenalty = clamp(components.complexityPenalty, 0, LANE_A_SCORE_RANGES.COMPLEXITY_PENALTY.max);
  const disclosureFrictionPenalty = clamp(components.disclosureFrictionPenalty, 0, LANE_A_SCORE_RANGES.DISCLOSURE_FRICTION_PENALTY.max);
  
  // Sum positive components
  const positiveSum = 
    edgeClarity +
    businessQualityPrior +
    financialResiliencePrior +
    valuationTension +
    catalystClarity +
    informationAvailability;
  
  // Subtract penalties
  const totalScore = positiveSum - complexityPenalty - disclosureFrictionPenalty;
  
  // Clamp to 0-100
  return clamp(totalScore, 0, 100);
}

/**
 * Calculate rank score (includes novelty weight for display)
 */
export function calculateRankScore(totalScore: number, noveltyScore: number): number {
  // Normalize novelty score to 0-100 scale (from 0-60 cap)
  const normalizedNovelty = (noveltyScore / 60) * 100;
  
  // Apply weights
  const fundamentalWeight = 1 - RANKING_WEIGHTS.NOVELTY_SCORE;
  const noveltyWeight = RANKING_WEIGHTS.NOVELTY_SCORE;
  
  const rankScore = (totalScore * fundamentalWeight) + (normalizedNovelty * noveltyWeight);
  
  return clamp(rankScore, 0, 100);
}

/**
 * Calculate full ranking result for an idea
 */
export function calculateRanking(input: RankingInput): RankingResult {
  const totalScore = calculateTotalScore(input.scoreComponents);
  const rankScore = calculateRankScore(totalScore, input.noveltyScore);
  
  // Normalize novelty for breakdown
  const normalizedNovelty = (input.noveltyScore / 60) * 100;
  const noveltyWeightedContribution = normalizedNovelty * RANKING_WEIGHTS.NOVELTY_SCORE;
  
  return {
    ideaId: input.ideaId,
    ticker: input.ticker,
    totalScore,
    rankScore,
    rank: 0, // Will be set during batch ranking
    breakdown: {
      edgeClarity: input.scoreComponents.edgeClarity,
      businessQualityPrior: input.scoreComponents.businessQualityPrior,
      financialResiliencePrior: input.scoreComponents.financialResiliencePrior,
      valuationTension: input.scoreComponents.valuationTension,
      catalystClarity: input.scoreComponents.catalystClarity,
      informationAvailability: input.scoreComponents.informationAvailability,
      complexityPenalty: input.scoreComponents.complexityPenalty,
      disclosureFrictionPenalty: input.scoreComponents.disclosureFrictionPenalty,
      subtotal: totalScore,
      noveltyScore: input.noveltyScore,
      noveltyWeightedContribution,
      totalScore,
      rankScore,
    },
  };
}

// ============================================================================
// BATCH RANKING
// ============================================================================

/**
 * Rank a batch of ideas
 */
export function rankIdeas(inputs: RankingInput[]): RankingResult[] {
  // Calculate scores for all ideas
  const results = inputs.map(input => calculateRanking(input));
  
  // Sort by rank score (descending)
  results.sort((a, b) => b.rankScore - a.rankScore);
  
  // Assign ranks
  results.forEach((result, index) => {
    result.rank = index + 1;
  });
  
  return results;
}

/**
 * Select top N ideas from ranked list
 */
export function selectTopN(rankedIdeas: RankingResult[], n: number): RankingResult[] {
  return rankedIdeas.slice(0, n);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Validate score components
 */
export function validateScoreComponents(components: ScoreComponents): string[] {
  const errors: string[] = [];
  
  if (components.edgeClarity < 0 || components.edgeClarity > LANE_A_SCORE_RANGES.EDGE_CLARITY.max) {
    errors.push(`edgeClarity must be between 0 and ${LANE_A_SCORE_RANGES.EDGE_CLARITY.max}`);
  }
  
  if (components.businessQualityPrior < 0 || components.businessQualityPrior > LANE_A_SCORE_RANGES.BUSINESS_QUALITY_PRIOR.max) {
    errors.push(`businessQualityPrior must be between 0 and ${LANE_A_SCORE_RANGES.BUSINESS_QUALITY_PRIOR.max}`);
  }
  
  if (components.financialResiliencePrior < 0 || components.financialResiliencePrior > LANE_A_SCORE_RANGES.FINANCIAL_RESILIENCE_PRIOR.max) {
    errors.push(`financialResiliencePrior must be between 0 and ${LANE_A_SCORE_RANGES.FINANCIAL_RESILIENCE_PRIOR.max}`);
  }
  
  if (components.valuationTension < 0 || components.valuationTension > LANE_A_SCORE_RANGES.VALUATION_TENSION.max) {
    errors.push(`valuationTension must be between 0 and ${LANE_A_SCORE_RANGES.VALUATION_TENSION.max}`);
  }
  
  if (components.catalystClarity < 0 || components.catalystClarity > LANE_A_SCORE_RANGES.CATALYST_CLARITY.max) {
    errors.push(`catalystClarity must be between 0 and ${LANE_A_SCORE_RANGES.CATALYST_CLARITY.max}`);
  }
  
  if (components.informationAvailability < 0 || components.informationAvailability > LANE_A_SCORE_RANGES.INFORMATION_AVAILABILITY.max) {
    errors.push(`informationAvailability must be between 0 and ${LANE_A_SCORE_RANGES.INFORMATION_AVAILABILITY.max}`);
  }
  
  if (components.complexityPenalty < 0 || components.complexityPenalty > LANE_A_SCORE_RANGES.COMPLEXITY_PENALTY.max) {
    errors.push(`complexityPenalty must be between 0 and ${LANE_A_SCORE_RANGES.COMPLEXITY_PENALTY.max}`);
  }
  
  if (components.disclosureFrictionPenalty < 0 || components.disclosureFrictionPenalty > LANE_A_SCORE_RANGES.DISCLOSURE_FRICTION_PENALTY.max) {
    errors.push(`disclosureFrictionPenalty must be between 0 and ${LANE_A_SCORE_RANGES.DISCLOSURE_FRICTION_PENALTY.max}`);
  }
  
  return errors;
}
