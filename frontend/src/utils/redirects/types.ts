// src/utils/redirects/types.ts
/**
 * Type definitions for the redirect system
 */

/**
 * Redirect configuration object for Astro
 */
export interface RedirectConfig {
  [from: string]: string;
}

/**
 * Individual redirect entry with metadata
 */
export interface RedirectEntry {
  from: string;           // Source path
  to: string;            // Destination path
  source: string;        // Where this redirect came from (for debugging)
  type: 'collection' | 'item' | 'path-alias';
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}