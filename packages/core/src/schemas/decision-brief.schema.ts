/**
 * ARC Investment Factory - DecisionBrief Schema
 * Zod validation schema following Operating Parameters specification
 */

import { z } from 'zod';
import { RecommendationSchema } from './research-packet.schema.js';

// ============================================================================
// NESTED SCHEMAS
// ============================================================================

export const DecisionCatalystSchema = z.object({
  name: z.string().min(1),
  window: z.string(),
  probability: z.number().min(0).max(1),
});

export const DecisionValuationSchema = z.object({
  fair_value_low: z.number(),
  fair_value_base: z.number(),
  fair_value_high: z.number(),
  current_price: z.number().nullable(),
  upside_to_base_pct: z.number().nullable(),
});

// ============================================================================
// MAIN DECISION BRIEF SCHEMA
// ============================================================================

export const DecisionBriefSchema = z.object({
  brief_id: z.string().uuid(),
  idea_id: z.string().uuid(),
  ticker: z.string().min(1).max(10),
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recommendation: RecommendationSchema,
  conviction_0_10: z.number().min(0).max(10),
  one_sentence_thesis: z.string().min(10),
  variant_perception: z.string().min(10),
  catalysts: z.array(DecisionCatalystSchema),
  valuation: DecisionValuationSchema,
  top_risks: z.array(z.string()).min(1),
  invalidation_triggers: z.array(z.string()).min(1),
  next_review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  appendix_links: z.array(z.string()),
});

// ============================================================================
// PARTIAL SCHEMAS
// ============================================================================

export const DecisionBriefCreateSchema = DecisionBriefSchema.omit({
  brief_id: true,
}).extend({
  brief_id: z.string().uuid().optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DecisionCatalyst = z.infer<typeof DecisionCatalystSchema>;
export type DecisionValuation = z.infer<typeof DecisionValuationSchema>;

export type DecisionBrief = z.infer<typeof DecisionBriefSchema>;
export type DecisionBriefCreate = z.infer<typeof DecisionBriefCreateSchema>;
