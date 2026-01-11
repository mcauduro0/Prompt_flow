/**
 * ARC Investment Factory - Evidence Traceability
 * 
 * Every numeric claim MUST be grounded with:
 * - source_locator (e.g., "10K_2024:page:42")
 * - snippet (max 500 chars)
 * - claim_type (numeric | qualitative)
 * - is_estimate flag for derived values
 */

import { z } from 'zod';
import { EVIDENCE_REQUIREMENTS } from '@arc/shared';

// ============================================================================
// SCHEMAS
// ============================================================================

/**
 * Source locator pattern: source_id:(page|table|section):number
 * Examples:
 * - "10K_2024:page:42"
 * - "Q3_2024_transcript:section:5"
 * - "investor_deck_2024:table:3"
 */
export const SourceLocatorSchema = z.string().regex(
  /^[a-zA-Z0-9_-]+:(page|table|section):\d+$/,
  'Source locator must match pattern: source_id:(page|table|section):number'
);

/**
 * Evidence reference schema
 */
export const EvidenceRefSchema = z.object({
  source_type: z.enum(['filing', 'transcript', 'investor_deck', 'news', 'dataset']),
  source_id: z.string().min(1),
  source_locator: SourceLocatorSchema,
  snippet: z.string().max(EVIDENCE_REQUIREMENTS.max_snippet_length),
  claim_type: z.enum(['numeric', 'qualitative']),
  is_estimate: z.boolean().optional().default(false),
  claim_value: z.union([z.string(), z.number()]).optional(),
  claim_unit: z.string().optional(),
  as_of_date: z.string().optional(),
  reliability_grade: z.enum(['A', 'B', 'C']).optional(),
});

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

/**
 * Numeric claim schema - requires evidence
 */
export const NumericClaimSchema = z.object({
  value: z.number(),
  unit: z.string().optional(),
  as_of: z.string().optional(),
  is_estimate: z.boolean().default(false),
  evidence: EvidenceRefSchema,
});

export type NumericClaim = z.infer<typeof NumericClaimSchema>;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate source locator format
 */
export function validateSourceLocator(locator: string): {
  valid: boolean;
  sourceId?: string;
  locatorType?: 'page' | 'table' | 'section';
  locatorValue?: number;
  error?: string;
} {
  const match = locator.match(/^([a-zA-Z0-9_-]+):(page|table|section):(\d+)$/);
  
  if (!match) {
    return {
      valid: false,
      error: `Invalid source locator format: ${locator}. Expected: source_id:(page|table|section):number`,
    };
  }

  return {
    valid: true,
    sourceId: match[1],
    locatorType: match[2] as 'page' | 'table' | 'section',
    locatorValue: parseInt(match[3], 10),
  };
}

/**
 * Validate evidence reference
 */
export function validateEvidenceRef(ref: unknown): {
  valid: boolean;
  data?: EvidenceRef;
  errors: string[];
} {
  const result = EvidenceRefSchema.safeParse(ref);
  
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
    };
  }

  // Additional validation
  const errors: string[] = [];

  // Check snippet length
  if (result.data.snippet.length > EVIDENCE_REQUIREMENTS.max_snippet_length) {
    errors.push(`Snippet exceeds max length (${EVIDENCE_REQUIREMENTS.max_snippet_length})`);
  }

  // Numeric claims must have value
  if (result.data.claim_type === 'numeric' && result.data.claim_value === undefined) {
    errors.push('Numeric claims must include claim_value');
  }

  return {
    valid: errors.length === 0,
    data: result.data,
    errors,
  };
}

/**
 * Check if a module has sufficient evidence
 */
export function checkModuleEvidence(
  evidenceRefs: EvidenceRef[],
  moduleName: string
): {
  sufficient: boolean;
  count: number;
  required: number;
  numericClaimsWithoutEvidence: string[];
} {
  const required = EVIDENCE_REQUIREMENTS.min_evidence_per_module;
  const count = evidenceRefs.length;
  
  return {
    sufficient: count >= required,
    count,
    required,
    numericClaimsWithoutEvidence: [],
  };
}

/**
 * Extract all numeric claims from a module and check evidence
 */
export function validateNumericClaims(
  moduleData: Record<string, unknown>,
  evidenceRefs: EvidenceRef[]
): {
  valid: boolean;
  ungroundedClaims: Array<{ path: string; value: number }>;
  groundedClaims: Array<{ path: string; value: number; evidence: EvidenceRef }>;
} {
  const ungroundedClaims: Array<{ path: string; value: number }> = [];
  const groundedClaims: Array<{ path: string; value: number; evidence: EvidenceRef }> = [];

  // Create a map of evidence by claim value for quick lookup
  const evidenceByValue = new Map<number, EvidenceRef>();
  for (const ref of evidenceRefs) {
    if (ref.claim_type === 'numeric' && typeof ref.claim_value === 'number') {
      evidenceByValue.set(ref.claim_value, ref);
    }
  }

  // Recursively find numeric values
  function findNumericValues(obj: unknown, path: string = ''): void {
    if (obj === null || obj === undefined) return;

    if (typeof obj === 'number' && !isNaN(obj)) {
      // Check if this value has evidence
      const evidence = evidenceByValue.get(obj);
      if (evidence) {
        groundedClaims.push({ path, value: obj, evidence });
      } else {
        // Only flag significant numbers (not 0, 1, or percentages that might be config)
        if (Math.abs(obj) > 1 && !path.includes('weight') && !path.includes('threshold')) {
          ungroundedClaims.push({ path, value: obj });
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        findNumericValues(item, `${path}[${index}]`);
      });
    } else if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        findNumericValues(value, path ? `${path}.${key}` : key);
      }
    }
  }

  findNumericValues(moduleData);

  return {
    valid: ungroundedClaims.length === 0,
    ungroundedClaims,
    groundedClaims,
  };
}

/**
 * Mark a value as an estimate
 */
export function markAsEstimate(
  value: number,
  derivedFrom: string,
  methodology: string
): NumericClaim {
  return {
    value,
    is_estimate: true,
    evidence: {
      source_type: 'dataset',
      source_id: 'internal_calculation',
      source_locator: 'internal_calculation:section:1',
      snippet: `Estimated value derived from ${derivedFrom} using ${methodology}`,
      claim_type: 'numeric',
      is_estimate: true,
      claim_value: value,
    },
  };
}

/**
 * Create evidence reference for a numeric claim
 */
export function createEvidenceRef(params: {
  sourceType: EvidenceRef['source_type'];
  sourceId: string;
  page?: number;
  table?: number;
  section?: number;
  snippet: string;
  claimValue: number;
  claimUnit?: string;
  asOfDate?: string;
  isEstimate?: boolean;
}): EvidenceRef {
  let locator: string;
  if (params.page !== undefined) {
    locator = `${params.sourceId}:page:${params.page}`;
  } else if (params.table !== undefined) {
    locator = `${params.sourceId}:table:${params.table}`;
  } else if (params.section !== undefined) {
    locator = `${params.sourceId}:section:${params.section}`;
  } else {
    locator = `${params.sourceId}:section:1`;
  }

  return {
    source_type: params.sourceType,
    source_id: params.sourceId,
    source_locator: locator,
    snippet: params.snippet.slice(0, EVIDENCE_REQUIREMENTS.max_snippet_length),
    claim_type: 'numeric',
    is_estimate: params.isEstimate || false,
    claim_value: params.claimValue,
    claim_unit: params.claimUnit,
    as_of_date: params.asOfDate,
  };
}

// ============================================================================
// RESEARCH PACKET EVIDENCE VALIDATION
// ============================================================================

/**
 * Validate all evidence in a research packet
 */
export function validatePacketEvidence(
  packet: {
    evidence_refs?: EvidenceRef[];
    business_model?: Record<string, unknown>;
    industry_moat?: Record<string, unknown>;
    financial_forensics?: Record<string, unknown>;
    capital_allocation?: Record<string, unknown>;
    management_quality?: Record<string, unknown>;
    valuation?: Record<string, unknown>;
    risk_stress?: Record<string, unknown>;
  }
): {
  valid: boolean;
  totalEvidence: number;
  moduleResults: Record<string, {
    evidenceCount: number;
    sufficient: boolean;
    ungroundedClaims: number;
  }>;
  errors: string[];
} {
  const errors: string[] = [];
  const evidenceRefs = packet.evidence_refs || [];
  const moduleResults: Record<string, {
    evidenceCount: number;
    sufficient: boolean;
    ungroundedClaims: number;
  }> = {};

  const modules = [
    { name: 'business_model', data: packet.business_model },
    { name: 'industry_moat', data: packet.industry_moat },
    { name: 'financial_forensics', data: packet.financial_forensics },
    { name: 'capital_allocation', data: packet.capital_allocation },
    { name: 'management_quality', data: packet.management_quality },
    { name: 'valuation', data: packet.valuation },
    { name: 'risk_stress', data: packet.risk_stress },
  ];

  for (const { name, data } of modules) {
    if (!data) continue;

    // Filter evidence for this module
    const moduleEvidence = evidenceRefs.filter(e => 
      e.source_id.toLowerCase().includes(name.replace('_', ''))
    );

    const evidenceCheck = checkModuleEvidence(moduleEvidence, name);
    const claimsCheck = validateNumericClaims(data, evidenceRefs);

    moduleResults[name] = {
      evidenceCount: evidenceCheck.count,
      sufficient: evidenceCheck.sufficient,
      ungroundedClaims: claimsCheck.ungroundedClaims.length,
    };

    if (!evidenceCheck.sufficient) {
      errors.push(`${name}: Insufficient evidence (${evidenceCheck.count}/${evidenceCheck.required})`);
    }

    if (claimsCheck.ungroundedClaims.length > 0) {
      errors.push(`${name}: ${claimsCheck.ungroundedClaims.length} ungrounded numeric claims`);
    }
  }

  return {
    valid: errors.length === 0,
    totalEvidence: evidenceRefs.length,
    moduleResults,
    errors,
  };
}

export default {
  validateSourceLocator,
  validateEvidenceRef,
  checkModuleEvidence,
  validateNumericClaims,
  markAsEstimate,
  createEvidenceRef,
  validatePacketEvidence,
};
