/**
 * ARC Investment Factory - Schema Validator
 * 
 * Validates prompt outputs against JSON Schema definitions.
 * Uses a simplified validation approach.
 */

import { type PromptDefinition } from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  errorDetails?: unknown[];
}

// ============================================================================
// SIMPLE SCHEMA VALIDATOR
// ============================================================================

/**
 * Simple JSON Schema validator without external dependencies
 * Validates basic types, required fields, and enums
 */
export class SchemaValidator {
  /**
   * Validate output against a prompt's output_schema
   */
  validate(prompt: PromptDefinition, output: unknown): ValidationResult {
    return this.validateAgainstSchema(prompt.output_schema, output, '');
  }

  /**
   * Validate input against a prompt's inputs_schema
   */
  validateInput(prompt: PromptDefinition, input: unknown): ValidationResult {
    return this.validateAgainstSchema(prompt.inputs_schema, input, '');
  }

  /**
   * Validate data against a JSON Schema
   */
  private validateAgainstSchema(
    schema: Record<string, unknown>,
    data: unknown,
    path: string
  ): ValidationResult {
    const errors: string[] = [];

    // Check type
    const expectedType = schema.type as string | undefined;
    if (expectedType) {
      const actualType = this.getType(data);
      if (expectedType !== actualType) {
        // Allow null for optional fields
        if (data !== null && data !== undefined) {
          errors.push(`${path || '/'}: Expected ${expectedType}, got ${actualType}`);
        }
      }
    }

    // Check required fields for objects
    if (schema.type === 'object' && typeof data === 'object' && data !== null) {
      const required = schema.required as string[] | undefined;
      if (required) {
        for (const field of required) {
          if (!(field in (data as Record<string, unknown>))) {
            errors.push(`Missing required field: ${path}/${field}`);
          }
        }
      }

      // Validate properties
      const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
      if (properties) {
        for (const [key, propSchema] of Object.entries(properties)) {
          const value = (data as Record<string, unknown>)[key];
          if (value !== undefined) {
            const propResult = this.validateAgainstSchema(propSchema, value, `${path}/${key}`);
            errors.push(...propResult.errors);
          }
        }
      }
    }

    // Check array items
    if (schema.type === 'array' && Array.isArray(data)) {
      const items = schema.items as Record<string, unknown> | undefined;
      if (items) {
        data.forEach((item, index) => {
          const itemResult = this.validateAgainstSchema(items, item, `${path}[${index}]`);
          errors.push(...itemResult.errors);
        });
      }
    }

    // Check enum
    const enumValues = schema.enum as unknown[] | undefined;
    if (enumValues && !enumValues.includes(data)) {
      errors.push(`${path || '/'}: Must be one of: ${enumValues.join(', ')}`);
    }

    // Check minimum/maximum for numbers
    if (typeof data === 'number') {
      const minimum = schema.minimum as number | undefined;
      const maximum = schema.maximum as number | undefined;
      if (minimum !== undefined && data < minimum) {
        errors.push(`${path || '/'}: Value must be >= ${minimum}`);
      }
      if (maximum !== undefined && data > maximum) {
        errors.push(`${path || '/'}: Value must be <= ${maximum}`);
      }
    }

    // Check minLength/maxLength for strings
    if (typeof data === 'string') {
      const minLength = schema.minLength as number | undefined;
      const maxLength = schema.maxLength as number | undefined;
      if (minLength !== undefined && data.length < minLength) {
        errors.push(`${path || '/'}: String must be at least ${minLength} characters`);
      }
      if (maxLength !== undefined && data.length > maxLength) {
        errors.push(`${path || '/'}: String must be at most ${maxLength} characters`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get the JSON Schema type of a value
   */
  private getType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Clear compiled schema cache (no-op for simple validator)
   */
  clearCache(): void {
    // No cache in simple validator
  }

  /**
   * Check if a schema is valid JSON Schema
   */
  isValidSchema(schema: Record<string, unknown>): boolean {
    return typeof schema === 'object' && schema !== null;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let validatorInstance: SchemaValidator | null = null;

export function getSchemaValidator(): SchemaValidator {
  if (!validatorInstance) {
    validatorInstance = new SchemaValidator();
  }
  return validatorInstance;
}

export function resetSchemaValidator(): void {
  validatorInstance = null;
}
