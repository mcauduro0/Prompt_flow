/**
 * ARC Investment Factory - Evidence Locator
 * 
 * Enforces evidence locators with doc_id and chunk_id resolution.
 * 
 * Every numeric claim in a ResearchPacket must be grounded to a specific
 * document and chunk location for audit trail and verification.
 * 
 * Evidence Locator Format:
 * {
 *   doc_id: "sec_10k_AAPL_2024",
 *   chunk_id: "section_7_md_a_paragraph_3",
 *   source_type: "filing",
 *   source_url: "https://...",
 *   page_number: 45,
 *   snippet: "Revenue increased 12% YoY...",
 *   confidence: 0.95,
 *   extracted_at: "2024-01-15T10:30:00Z"
 * }
 */

import { z } from 'zod';

// ============================================================================
// EVIDENCE LOCATOR SCHEMA
// ============================================================================

/**
 * Source types for evidence
 */
export const SourceTypeSchema = z.enum([
  'filing',           // SEC filings (10-K, 10-Q, 8-K, etc.)
  'transcript',       // Earnings call transcripts
  'investor_deck',    // Investor presentations
  'news',             // News articles
  'dataset',          // Structured datasets (FMP, Polygon, etc.)
  'press_release',    // Company press releases
  'analyst_report',   // Third-party analyst reports
  'regulatory',       // Other regulatory filings
]);

export type SourceType = z.infer<typeof SourceTypeSchema>;

/**
 * Evidence Locator - points to exact location of a claim's source
 */
export const EvidenceLocatorSchema = z.object({
  // Document identification (REQUIRED)
  doc_id: z.string().min(1).describe('Unique document identifier, e.g., "sec_10k_AAPL_2024"'),
  
  // Chunk identification (REQUIRED for text sources)
  chunk_id: z.string().optional().describe('Specific chunk/section within document, e.g., "section_7_md_a_paragraph_3"'),
  
  // Source metadata
  source_type: SourceTypeSchema,
  source_url: z.string().url().optional(),
  source_name: z.string().optional().describe('Human-readable source name'),
  
  // Location within document
  page_number: z.number().int().positive().optional(),
  section: z.string().optional().describe('Section name, e.g., "MD&A", "Risk Factors"'),
  paragraph: z.number().int().positive().optional(),
  
  // Content
  snippet: z.string().min(10).max(1000).describe('Exact text snippet supporting the claim'),
  
  // Extraction metadata
  confidence: z.number().min(0).max(1).describe('Confidence in extraction accuracy'),
  extracted_at: z.string().datetime(),
  extraction_method: z.enum(['manual', 'llm', 'regex', 'structured']).optional(),
  
  // For datasets
  dataset_field: z.string().optional().describe('Field name in structured dataset'),
  dataset_timestamp: z.string().datetime().optional().describe('Data point timestamp'),
});

export type EvidenceLocator = z.infer<typeof EvidenceLocatorSchema>;

/**
 * Numeric Claim with Evidence Locator
 */
export const LocatorNumericClaimSchema = z.object({
  // The claim itself
  claim_text: z.string().min(10).describe('The numeric claim being made'),
  
  // Numeric value
  value: z.number(),
  unit: z.string().optional().describe('Unit of measurement, e.g., "$M", "%", "units"'),
  
  // Is this an estimate or reported figure?
  is_estimate: z.boolean().default(false),
  estimate_basis: z.string().optional().describe('If estimate, what is the basis?'),
  
  // Evidence locator (REQUIRED for non-estimates)
  evidence_locator: EvidenceLocatorSchema.optional(),
  
  // Multiple sources for cross-validation
  additional_sources: z.array(EvidenceLocatorSchema).optional(),
  
  // Validation status
  validated: z.boolean().default(false),
  validation_notes: z.string().optional(),
});

export type LocatorNumericClaim = z.infer<typeof LocatorNumericClaimSchema>;

// ============================================================================
// EVIDENCE RESOLUTION
// ============================================================================

/**
 * Document registry for resolving doc_ids
 */
export interface DocumentRegistry {
  getDocument(docId: string): Promise<DocumentMetadata | null>;
  getChunk(docId: string, chunkId: string): Promise<ChunkMetadata | null>;
  searchDocuments(query: string, filters?: DocumentFilters): Promise<DocumentMetadata[]>;
}

export interface DocumentMetadata {
  doc_id: string;
  source_type: SourceType;
  source_url?: string;
  title: string;
  company_ticker?: string;
  filing_date?: string;
  document_date?: string;
  total_pages?: number;
  total_chunks?: number;
  indexed_at: string;
}

export interface ChunkMetadata {
  chunk_id: string;
  doc_id: string;
  section?: string;
  page_number?: number;
  paragraph?: number;
  text: string;
  embedding_id?: string;
}

export interface DocumentFilters {
  source_type?: SourceType;
  company_ticker?: string;
  date_from?: string;
  date_to?: string;
}

/**
 * Evidence Resolver - resolves and validates evidence locators
 */
export class EvidenceResolver {
  constructor(private registry: DocumentRegistry) {}

  /**
   * Resolve a doc_id to full document metadata
   */
  async resolveDocument(docId: string): Promise<DocumentMetadata | null> {
    return this.registry.getDocument(docId);
  }

  /**
   * Resolve a chunk_id within a document
   */
  async resolveChunk(docId: string, chunkId: string): Promise<ChunkMetadata | null> {
    return this.registry.getChunk(docId, chunkId);
  }

  /**
   * Validate an evidence locator
   */
  async validateLocator(locator: EvidenceLocator): Promise<{
    valid: boolean;
    errors: string[];
    resolved_document?: DocumentMetadata;
    resolved_chunk?: ChunkMetadata;
  }> {
    const errors: string[] = [];

    // Validate doc_id exists
    const document = await this.resolveDocument(locator.doc_id);
    if (!document) {
      errors.push(`Document not found: ${locator.doc_id}`);
      return { valid: false, errors };
    }

    // Validate chunk_id if provided
    let chunk: ChunkMetadata | null = null;
    if (locator.chunk_id) {
      chunk = await this.resolveChunk(locator.doc_id, locator.chunk_id);
      if (!chunk) {
        errors.push(`Chunk not found: ${locator.chunk_id} in document ${locator.doc_id}`);
      }
    }

    // Validate source_type matches document
    if (document.source_type !== locator.source_type) {
      errors.push(`Source type mismatch: locator says ${locator.source_type}, document is ${document.source_type}`);
    }

    // Validate page number is within range
    if (locator.page_number && document.total_pages) {
      if (locator.page_number > document.total_pages) {
        errors.push(`Page number ${locator.page_number} exceeds document pages (${document.total_pages})`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      resolved_document: document,
      resolved_chunk: chunk || undefined,
    };
  }

  /**
   * Validate a numeric claim's evidence
   */
  async validateNumericClaim(claim: LocatorNumericClaim): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Non-estimates MUST have evidence locator
    if (!claim.is_estimate && !claim.evidence_locator) {
      errors.push(`Non-estimate claim "${claim.claim_text}" missing evidence locator`);
      return { valid: false, errors, warnings };
    }

    // Estimates SHOULD have basis
    if (claim.is_estimate && !claim.estimate_basis) {
      warnings.push(`Estimate "${claim.claim_text}" missing estimate_basis`);
    }

    // Validate primary evidence locator
    if (claim.evidence_locator) {
      const validation = await this.validateLocator(claim.evidence_locator);
      if (!validation.valid) {
        errors.push(...validation.errors.map((e) => `Primary evidence: ${e}`));
      }
    }

    // Validate additional sources
    if (claim.additional_sources) {
      for (let i = 0; i < claim.additional_sources.length; i++) {
        const validation = await this.validateLocator(claim.additional_sources[i]);
        if (!validation.valid) {
          errors.push(...validation.errors.map((e) => `Additional source ${i + 1}: ${e}`));
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// ============================================================================
// EVIDENCE GROUNDING CHECK
// ============================================================================

/**
 * Check evidence grounding for a ResearchPacket
 */
export interface EvidenceGroundingResult {
  total_claims: number;
  grounded_claims: number;
  ungrounded_claims: number;
  grounding_rate: number;
  
  // Spot check results
  spot_check_passed: boolean;
  spot_check_sample_size: number;
  spot_check_details: Array<{
    claim: string;
    locator: EvidenceLocator | null;
    validation_result: 'valid' | 'invalid' | 'not_found';
    notes?: string;
  }>;
  
  // By source type
  by_source_type: Record<SourceType, {
    total: number;
    grounded: number;
    rate: number;
  }>;
  
  // Errors and warnings
  errors: string[];
  warnings: string[];
}

/**
 * Extract numeric claims from a ResearchPacket
 */
export function extractLocatorNumericClaims(packet: any): LocatorNumericClaim[] {
  const claims: LocatorNumericClaim[] = [];

  // Helper to extract claims from text
  const extractFromText = (text: string, context: string): void => {
    // Match patterns like "$X.X billion", "X%", "X.X million", etc.
    const patterns = [
      /\$[\d,.]+\s*(billion|million|thousand|B|M|K)?/gi,
      /[\d,.]+%/g,
      /[\d,.]+x/gi,
      /[\d,.]+\s*(billion|million|thousand|units|shares)/gi,
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        claims.push({
          claim_text: `${context}: ${match[0]}`,
          value: parseFloat(match[0].replace(/[$,%,]/g, '')),
          is_estimate: false,
          validated: false,
        });
      }
    }
  };

  // Extract from modules
  if (packet.modules) {
    for (const [moduleName, moduleData] of Object.entries(packet.modules)) {
      if (typeof moduleData === 'object' && moduleData !== null) {
        const moduleStr = JSON.stringify(moduleData);
        extractFromText(moduleStr, moduleName);
      }
    }
  }

  // Extract from thesis
  if (packet.one_sentence_thesis) {
    extractFromText(packet.one_sentence_thesis, 'thesis');
  }

  // Extract from bull/base/bear
  if (packet.bull_base_bear) {
    for (const scenario of ['bull', 'base', 'bear']) {
      const scenarioData = packet.bull_base_bear[scenario];
      if (scenarioData?.description) {
        extractFromText(scenarioData.description, `${scenario}_case`);
      }
    }
  }

  return claims;
}

/**
 * Perform evidence grounding check on a ResearchPacket
 */
export async function checkEvidenceGrounding(
  packet: any,
  resolver?: EvidenceResolver,
  spotCheckSampleSize: number = 10
): Promise<EvidenceGroundingResult> {
  const claims = extractLocatorNumericClaims(packet);
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Count grounded claims
  let groundedClaims = 0;
  const bySourceType: Record<string, { total: number; grounded: number; rate: number }> = {};
  
  // Check if packet has evidence array
  const evidence = packet.evidence || [];
  
  for (const claim of claims) {
    // Try to find matching evidence
    const matchingEvidence = evidence.find((e: any) => 
      claim.claim_text.toLowerCase().includes(e.snippet?.toLowerCase() || '')
    );
    
    if (matchingEvidence) {
      groundedClaims++;
      claim.evidence_locator = matchingEvidence;
      claim.validated = true;
      
      // Track by source type
      const sourceType = matchingEvidence.source_type || 'unknown';
      if (!bySourceType[sourceType]) {
        bySourceType[sourceType] = { total: 0, grounded: 0, rate: 0 };
      }
      bySourceType[sourceType].total++;
      bySourceType[sourceType].grounded++;
    } else {
      // Track ungrounded by estimated source type
      const estimatedType = 'unknown';
      if (!bySourceType[estimatedType]) {
        bySourceType[estimatedType] = { total: 0, grounded: 0, rate: 0 };
      }
      bySourceType[estimatedType].total++;
    }
  }
  
  // Calculate rates
  for (const type of Object.keys(bySourceType)) {
    bySourceType[type].rate = bySourceType[type].total > 0 
      ? bySourceType[type].grounded / bySourceType[type].total 
      : 0;
  }
  
  // Spot check
  const spotCheckDetails: EvidenceGroundingResult['spot_check_details'] = [];
  const sampleSize = Math.min(spotCheckSampleSize, claims.length);
  const sampledClaims = claims.slice(0, sampleSize);
  
  for (const claim of sampledClaims) {
    let validationResult: 'valid' | 'invalid' | 'not_found' = 'not_found';
    
    if (claim.evidence_locator) {
      if (resolver) {
        const validation = await resolver.validateLocator(claim.evidence_locator);
        validationResult = validation.valid ? 'valid' : 'invalid';
        if (!validation.valid) {
          errors.push(...validation.errors);
        }
      } else {
        // Without resolver, just check if locator exists
        validationResult = claim.evidence_locator.doc_id ? 'valid' : 'invalid';
      }
    }
    
    spotCheckDetails.push({
      claim: claim.claim_text,
      locator: claim.evidence_locator || null,
      validation_result: validationResult,
    });
  }
  
  const spotCheckPassed = spotCheckDetails.filter((d) => d.validation_result === 'valid').length >= sampleSize * 0.8;
  
  // Generate warnings for low grounding rate
  const groundingRate = claims.length > 0 ? groundedClaims / claims.length : 1;
  if (groundingRate < 0.8) {
    warnings.push(`Low grounding rate: ${(groundingRate * 100).toFixed(1)}% (target: 80%)`);
  }
  
  return {
    total_claims: claims.length,
    grounded_claims: groundedClaims,
    ungrounded_claims: claims.length - groundedClaims,
    grounding_rate: groundingRate,
    spot_check_passed: spotCheckPassed,
    spot_check_sample_size: sampleSize,
    spot_check_details: spotCheckDetails,
    by_source_type: bySourceType as Record<SourceType, { total: number; grounded: number; rate: number }>,
    errors,
    warnings,
  };
}

// ============================================================================
// DOC_ID GENERATION HELPERS
// ============================================================================

/**
 * Generate a standardized doc_id for SEC filings
 */
export function generateSecFilingDocId(
  ticker: string,
  filingType: '10-K' | '10-Q' | '8-K' | 'DEF14A' | 'S-1' | 'other',
  filingDate: string
): string {
  const dateStr = filingDate.replace(/-/g, '');
  return `sec_${filingType.toLowerCase().replace('-', '')}_${ticker.toUpperCase()}_${dateStr}`;
}

/**
 * Generate a standardized doc_id for earnings transcripts
 */
export function generateTranscriptDocId(
  ticker: string,
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4',
  year: number
): string {
  return `transcript_${ticker.toUpperCase()}_${year}${quarter}`;
}

/**
 * Generate a standardized doc_id for investor decks
 */
export function generateInvestorDeckDocId(
  ticker: string,
  eventType: 'earnings' | 'investor_day' | 'conference' | 'other',
  date: string
): string {
  const dateStr = date.replace(/-/g, '');
  return `deck_${ticker.toUpperCase()}_${eventType}_${dateStr}`;
}

/**
 * Generate a standardized chunk_id
 */
export function generateChunkId(
  section: string,
  subsection?: string,
  paragraph?: number
): string {
  const parts = [section.toLowerCase().replace(/\s+/g, '_')];
  if (subsection) {
    parts.push(subsection.toLowerCase().replace(/\s+/g, '_'));
  }
  if (paragraph !== undefined) {
    parts.push(`p${paragraph}`);
  }
  return parts.join('_');
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  EvidenceLocatorSchema,
  LocatorNumericClaimSchema,
  SourceTypeSchema,
  EvidenceResolver,
  extractLocatorNumericClaims,
  checkEvidenceGrounding,
  generateSecFilingDocId,
  generateTranscriptDocId,
  generateInvestorDeckDocId,
  generateChunkId,
};
