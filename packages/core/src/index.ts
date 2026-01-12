/**
 * ARC Investment Factory - Core Package
 * Schemas, validation, and types
 * 
 * To avoid duplicate export conflicts, we export:
 * - All schemas from ./schemas/index.js
 * - Validation utilities as a namespace
 */

// ============================================================================
// SCHEMAS - All schema definitions
// ============================================================================

export * from './schemas/index.js';

// ============================================================================
// VALIDATION - Import as namespace to avoid conflicts
// ============================================================================

import * as validation from './validation/index.js';
export { validation };

// Also export core validation functions directly for convenience
export {
  validate,
  validateByName,
  safeParse,
  parseAndValidate,
  generateFixPrompt,
  extractJsonFromResponse,
  validateWithRetry,
  validators,
  schemaRegistry,
  type ValidationResult,
  type ValidationError,
  type FixPromptResult,
  type ValidateWithRetryOptions,
  type SchemaName,
} from './validation/index.js';
