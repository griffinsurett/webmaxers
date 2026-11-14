// src/utils/redirects/validation.ts
/**
 * Redirect-Specific Validation
 * 
 * Validates redirect entries for security and correctness.
 * Checks for conflicts, circular redirects, and security issues.
 * 
 * Note: Path alias redirects are allowed to conflict with manual redirects
 * (manual takes precedence), but manual redirects cannot conflict with each other.
 */

import { isValidPath, getPathValidationError } from '../pathValidation';
import type { RedirectEntry, ValidationResult } from './types';

/**
 * Validate a single redirect entry
 * 
 * @param to - Target path
 * @param from - Source path
 * @param source - Source file (for error reporting)
 * @returns Error message if invalid, null if valid
 */
export function validateRedirectTarget(
  to: string,
  from: string,
  source: string
): string | null {
  // Validate target path
  const targetError = getPathValidationError(to);
  if (targetError) {
    return `Invalid redirect target "${from}" -> "${to}" in ${source}: ${targetError}`;
  }
  
  // Validate source path
  const sourceError = getPathValidationError(from);
  if (sourceError) {
    return `Invalid redirect source "${from}" in ${source}: ${sourceError}`;
  }
  
  return null;
}

/**
 * Validate all redirects for conflicts and security issues
 * 
 * Checks for:
 * - Invalid/unsafe paths
 * - Duplicate source paths (among manual redirects)
 * - Circular redirects
 * - Self-redirects
 * 
 * Note: Path alias redirects can overlap with manual redirects
 * (manual takes precedence), but this is not an error.
 * 
 * @param redirects - Array of redirect entries
 * @returns Validation result with errors and warnings
 */
export function validateRedirects(redirects: RedirectEntry[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Separate manual and path-alias redirects
  const manualRedirects = redirects.filter(r => r.type !== 'path-alias');
  const pathAliasRedirects = redirects.filter(r => r.type === 'path-alias');
  
  // Validate each redirect target and source
  for (const redirect of redirects) {
    const error = validateRedirectTarget(redirect.to, redirect.from, redirect.source);
    if (error) {
      errors.push(error);
    }
  }
  
  // Group manual redirects by source path
  const manualFromPaths = new Map<string, RedirectEntry[]>();
  for (const redirect of manualRedirects) {
    const existing = manualFromPaths.get(redirect.from) || [];
    existing.push(redirect);
    manualFromPaths.set(redirect.from, existing);
  }
  
  // Check for duplicate source paths among manual redirects
  for (const [from, entries] of manualFromPaths) {
    if (entries.length > 1) {
      const destinations = entries.map(e => e.to);
      const sources = entries.map(e => e.source);
      
      // If all redirect to same place, it's just a warning
      if (new Set(destinations).size === 1) {
        warnings.push(
          `Duplicate manual redirect from "${from}" defined in: ${sources.join(', ')}`
        );
      } else {
        errors.push(
          `Conflicting manual redirects from "${from}":\n` +
          entries.map(e => `  - ${e.source} → ${e.to}`).join('\n')
        );
      }
    }
  }
  
  // Check for path alias conflicts with manual redirects (informational only)
  for (const aliasRedirect of pathAliasRedirects) {
    const manualEntries = manualFromPaths.get(aliasRedirect.from);
    if (manualEntries && manualEntries.length > 0) {
      const manualTarget = manualEntries[0].to;
      if (manualTarget !== aliasRedirect.to) {
        warnings.push(
          `Path alias redirect from "${aliasRedirect.from}" → "${aliasRedirect.to}" ` +
          `is overridden by manual redirect to "${manualTarget}"`
        );
      }
    }
  }
  
  // Check for self-redirects
  for (const redirect of redirects) {
    if (redirect.from === redirect.to) {
      errors.push(
        `Self-redirect detected: "${redirect.from}" → "${redirect.to}" in ${redirect.source}`
      );
    }
  }
  
  // Check for circular redirects
  const redirectMap = new Map<string, string>();
  for (const redirect of redirects) {
    redirectMap.set(redirect.from, redirect.to);
  }
  
  const visited = new Set<string>();
  const checkCircular = (from: string, path: string[] = []): boolean => {
    if (path.includes(from)) {
      errors.push(`Circular redirect detected: ${[...path, from].join(' → ')}`);
      return true;
    }
    
    if (visited.has(from)) return false;
    
    visited.add(from);
    const to = redirectMap.get(from);
    
    if (to) {
      return checkCircular(to, [...path, from]);
    }
    
    return false;
  };
  
  for (const [from] of redirectMap) {
    if (!visited.has(from)) {
      checkCircular(from);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}