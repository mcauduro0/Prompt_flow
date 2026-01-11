/**
 * ARC Investment Factory - Validation Layer
 * JSON schema validation with retry logic for LLM outputs
 * Following Build Pack specification: one retry with "fix to valid JSON" prompt
 */

import { z, ZodSchema, ZodError } from 'zod';
import {
  IdeaCardSchema,
  ResearchPacketSchema,
  EvidenceSchema,
  DecisionBriefSchema,
} from '../schemas/index.js';

// Re-export research packet completion
export * from './research-packet-completion.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
  rawInput?: unknown;
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface FixPromptResult {
  prompt: string;
  originalErrors: ValidationError[];
}

// ============================================================================
// SCHEMA REGISTRY
// ============================================================================

const schemaRegistry = {
  IdeaCard: IdeaCardSchema,
  ResearchPacket: ResearchPacketSchema,
  Evidence: EvidenceSchema,
  DecisionBrief: DecisionBriefSchema,
} as const;

export type SchemaName = keyof typeof schemaRegistry;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate data against a Zod schema
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      }));
      return { success: false, errors, rawInput: data };
    }
    throw error;
  }
}

/**
 * Validate data against a named schema from registry
 */
export function validateByName<T extends SchemaName>(
  schemaName: T,
  data: unknown
): ValidationResult<z.infer<(typeof schemaRegistry)[T]>> {
  const schema = schemaRegistry[schemaName];
  return validate(schema, data);
}

/**
 * Safe parse that returns undefined on failure
 */
export function safeParse<T>(
  schema: ZodSchema<T>,
  data: unknown
): T | undefined {
  const result = validate(schema, data);
  return result.success ? result.data : undefined;
}

/**
 * Parse JSON string and validate
 */
export function parseAndValidate<T>(
  schema: ZodSchema<T>,
  jsonString: string
): ValidationResult<T> {
  try {
    const data = JSON.parse(jsonString);
    return validate(schema, data);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        errors: [
          {
            path: '',
            message: `Invalid JSON: ${error.message}`,
            code: 'invalid_json',
          },
        ],
        rawInput: jsonString,
      };
    }
    throw error;
  }
}

// ============================================================================
// FIX PROMPT GENERATION
// ============================================================================

/**
 * Generate a fix prompt for invalid JSON output
 * Following Build Pack: one retry with "fix to valid JSON" prompt
 */
export function generateFixPrompt(
  schemaName: SchemaName,
  originalOutput: string,
  errors: ValidationError[]
): FixPromptResult {
  const errorSummary = errors
    .map((e) => `- ${e.path || 'root'}: ${e.message}`)
    .join('\n');

  const prompt = `The previous response did not match the required JSON schema for ${schemaName}.

VALIDATION ERRORS:
${errorSummary}

ORIGINAL OUTPUT:
${originalOutput}

Please fix the JSON to match the schema requirements. Return ONLY valid JSON, no explanations.

Key requirements:
- All required fields must be present
- All values must match their expected types
- Arrays must have minimum required items
- Strings must meet minimum length requirements
- Numbers must be within specified ranges

Return the corrected JSON:`;

  return { prompt, originalErrors: errors };
}

/**
 * Extract JSON from LLM response that may contain markdown or explanations
 */
export function extractJsonFromResponse(response: string): string {
  // Try to find JSON in code blocks first
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find JSON object or array
  const jsonMatch = response.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }

  // Return original if no JSON found
  return response.trim();
}

// ============================================================================
// VALIDATION WITH RETRY
// ============================================================================

export interface ValidateWithRetryOptions<T> {
  schema: ZodSchema<T>;
  schemaName: SchemaName;
  initialResponse: string;
  retryFn: (fixPrompt: string) => Promise<string>;
  maxRetries?: number;
}

/**
 * Validate LLM output with retry on failure
 * Following Build Pack: one retry with fix prompt, then log and mark failed
 */
export async function validateWithRetry<T>(
  options: ValidateWithRetryOptions<T>
): Promise<ValidationResult<T> & { retried: boolean; finalResponse: string }> {
  const { schema, schemaName, initialResponse, retryFn, maxRetries = 1 } = options;

  let currentResponse = initialResponse;
  let retried = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Extract JSON from response
    const jsonString = extractJsonFromResponse(currentResponse);

    // Try to validate
    const result = parseAndValidate(schema, jsonString);

    if (result.success) {
      return {
        ...result,
        retried: attempt > 0,
        finalResponse: currentResponse,
      };
    }

    // If this was the last attempt, return failure
    if (attempt >= maxRetries) {
      return {
        ...result,
        retried: attempt > 0,
        finalResponse: currentResponse,
      };
    }

    // Generate fix prompt and retry
    const { prompt } = generateFixPrompt(schemaName, jsonString, result.errors!);
    currentResponse = await retryFn(prompt);
    retried = true;
  }

  // Should not reach here, but TypeScript needs this
  return {
    success: false,
    errors: [{ path: '', message: 'Max retries exceeded', code: 'max_retries' }],
    retried,
    finalResponse: currentResponse,
  };
}

// ============================================================================
// SPECIFIC VALIDATORS
// ============================================================================

export const validators = {
  ideaCard: (data: unknown) => validate(IdeaCardSchema, data),
  researchPacket: (data: unknown) => validate(ResearchPacketSchema, data),
  evidence: (data: unknown) => validate(EvidenceSchema, data),
  decisionBrief: (data: unknown) => validate(DecisionBriefSchema, data),
};

// ============================================================================
// EXPORTS
// ============================================================================

export { schemaRegistry };
