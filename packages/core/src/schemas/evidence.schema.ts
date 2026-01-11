/**
 * ARC Investment Factory - Evidence Schema
 * Zod validation schema following Operating Parameters specification
 */

import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const ClaimTypeSchema = z.enum(['numeric', 'qualitative']);

export const EvidenceSourceTypeSchema = z.enum([
  'filing',
  'transcript',
  'investor_deck',
  'news',
  'dataset',
]);

export const ReliabilityGradeSchema = z.enum(['A', 'B', 'C']);

// ============================================================================
// MAIN EVIDENCE SCHEMA
// ============================================================================

export const EvidenceSchema = z.object({
  evidence_id: z.string().uuid(),
  idea_id: z.string().uuid(),
  ticker: z.string().min(1).max(10),
  claim: z.string().min(1),
  claim_type: ClaimTypeSchema,
  source_type: EvidenceSourceTypeSchema,
  source_id: z.string(),
  source_locator: z.string(),
  snippet: z.string(),
  extracted_at: z.string().datetime(),
  reliability_grade: ReliabilityGradeSchema,
});

// ============================================================================
// PARTIAL SCHEMAS
// ============================================================================

export const EvidenceCreateSchema = EvidenceSchema.omit({
  evidence_id: true,
  extracted_at: true,
}).extend({
  evidence_id: z.string().uuid().optional(),
  extracted_at: z.string().datetime().optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ClaimType = z.infer<typeof ClaimTypeSchema>;
export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeSchema>;
export type ReliabilityGrade = z.infer<typeof ReliabilityGradeSchema>;

export type Evidence = z.infer<typeof EvidenceSchema>;
export type EvidenceCreate = z.infer<typeof EvidenceCreateSchema>;
