/**
 * ARC Investment Factory - Style Mix State Repository
 * Data access for style_mix_state table
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { styleMixState, type StyleMixState, type NewStyleMixState } from '../models/schema.js';
import { STYLE_MIX_TARGETS, PROMOTION_THRESHOLDS } from '@arc/shared';

export const styleMixStateRepository = {
  /**
   * Get current week's style mix state
   */
  async getCurrentWeek(): Promise<StyleMixState | undefined> {
    const weekStart = getWeekStartDate();
    const [result] = await db
      .select()
      .from(styleMixState)
      .where(eq(styleMixState.weekStart, weekStart));
    return result;
  },

  /**
   * Get or create current week's state
   */
  async getOrCreateCurrentWeek(): Promise<StyleMixState> {
    const weekStart = getWeekStartDate();
    let state = await this.getCurrentWeek();

    if (!state) {
      const [result] = await db
        .insert(styleMixState)
        .values({
          weekStart,
          qualityCompounderCount: 0,
          garpCount: 0,
          cigarButtCount: 0,
          totalPromoted: 0,
        })
        .returning();
      state = result;
    }

    return state;
  },

  /**
   * Increment style count for a promotion
   */
  async incrementStyleCount(styleTag: 'quality_compounder' | 'garp' | 'cigar_butt'): Promise<StyleMixState> {
    const weekStart = getWeekStartDate();
    await this.getOrCreateCurrentWeek();

    const columnMap = {
      quality_compounder: styleMixState.qualityCompounderCount,
      garp: styleMixState.garpCount,
      cigar_butt: styleMixState.cigarButtCount,
    };

    const [result] = await db
      .update(styleMixState)
      .set({
        [columnMap[styleTag].name]: sql`${columnMap[styleTag]} + 1`,
        totalPromoted: sql`${styleMixState.totalPromoted} + 1`,
      })
      .where(eq(styleMixState.weekStart, weekStart))
      .returning();

    return result;
  },

  /**
   * Calculate current style percentages
   */
  async getCurrentStylePercentages(): Promise<{
    quality_compounder: number;
    garp: number;
    cigar_butt: number;
  }> {
    const state = await this.getOrCreateCurrentWeek();
    const total = state.totalPromoted || 1; // Avoid division by zero

    return {
      quality_compounder: state.qualityCompounderCount / total,
      garp: state.garpCount / total,
      cigar_butt: state.cigarButtCount / total,
    };
  },

  /**
   * Calculate threshold adjustments based on quota
   */
  async getThresholdAdjustments(): Promise<{
    quality_compounder: number;
    garp: number;
    cigar_butt: number;
  }> {
    const percentages = await this.getCurrentStylePercentages();
    const threshold = PROMOTION_THRESHOLDS.WEEKLY_QUOTA_OVERWEIGHT_PP_THRESHOLD;
    const adjustment = PROMOTION_THRESHOLDS.WEEKLY_QUOTA_THRESHOLD_ADD;

    return {
      quality_compounder:
        percentages.quality_compounder - STYLE_MIX_TARGETS.QUALITY_COMPOUNDER > threshold
          ? adjustment
          : 0,
      garp:
        percentages.garp - STYLE_MIX_TARGETS.GARP > threshold
          ? adjustment
          : 0,
      cigar_butt:
        percentages.cigar_butt - STYLE_MIX_TARGETS.CIGAR_BUTT > threshold
          ? adjustment
          : 0,
    };
  },

  /**
   * Get adjusted promotion threshold for a style
   */
  async getAdjustedThreshold(styleTag: 'quality_compounder' | 'garp' | 'cigar_butt'): Promise<number> {
    const adjustments = await this.getThresholdAdjustments();
    
    let baseThreshold: number;
    if (styleTag === 'cigar_butt') {
      baseThreshold = PROMOTION_THRESHOLDS.CIGAR_BUTT_DEFAULT_SCORE;
    } else {
      baseThreshold = PROMOTION_THRESHOLDS.DEFAULT_TOTAL_SCORE;
    }

    return baseThreshold + adjustments[styleTag];
  },
};

/**
 * Get Monday of current week as YYYY-MM-DD string
 */
function getWeekStartDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}
