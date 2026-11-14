// src/utils/pathValidation.ts
/**
 * Path Validation and Normalization Utilities
 * 
 * Security-focused utilities for validating and normalizing URL paths.
 * Prevents common vulnerabilities like XSS, path traversal, and open redirects.
 */

/**
 * Normalize a path for consistent formatting
 * 
 * Ensures:
 * - Leading slash present
 * - No trailing slash (except root)
 * - Trimmed whitespace
 * 
 * @param inputPath - Path to normalize
 * @returns Normalized path
 * @example
 * normalizePath('contact') // '/contact'
 * normalizePath('/about/') // '/about'
 * normalizePath('/') // '/'
 */
export function normalizePath(inputPath: string): string {
  let normalized = inputPath.trim();
  
  // Add leading slash if missing
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  
  // Remove trailing slash (except for root)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
}

/**
 * Validate that a path is safe for use in redirects
 * 
 * Security checks:
 * - No external URLs (http://, https://)
 * - No protocol handlers (javascript:, data:, vbscript:, etc.)
 * - No XSS-prone special characters
 * - Must be absolute path (start with /)
 * 
 * @param inputPath - Path to validate
 * @returns True if path is safe
 */
export function isValidPath(inputPath: string): boolean {
  // Must not be empty
  if (!inputPath || inputPath.trim() === '') {
    return false;
  }
  
  const path = inputPath.trim();
  
  // No external URLs allowed
  if (path.match(/^https?:\/\//i)) {
    return false;
  }
  
  // No protocol handlers allowed (security risk)
  if (path.match(/^(javascript|data|vbscript|file|about):/i)) {
    return false;
  }
  
  // No special characters that could cause XSS or parsing issues
  if (path.match(/[<>"'`]/)) {
    return false;
  }
  
  // Must be absolute path (start with /)
  if (!path.startsWith('/')) {
    return false;
  }
  
  return true;
}

/**
 * Get detailed validation error message for a path
 * 
 * @param inputPath - Path to validate
 * @returns Error message, or null if valid
 */
export function getPathValidationError(inputPath: string): string | null {
  if (!inputPath || inputPath.trim() === '') {
    return 'Path cannot be empty';
  }
  
  const path = inputPath.trim();
  
  if (path.match(/^https?:\/\//i)) {
    return 'External URLs are not allowed. Only internal paths are permitted.';
  }
  
  if (path.match(/^(javascript|data|vbscript|file|about):/i)) {
    return 'Protocol handlers are not allowed. This is a security risk.';
  }
  
  if (path.match(/[<>"'`]/)) {
    return 'Special characters like <>"\'` are not allowed.';
  }
  
  if (!path.startsWith('/')) {
    return 'Path must be absolute (start with /).';
  }
  
  return null;
}

/**
 * Sanitize a path by removing potentially dangerous elements
 * 
 * Note: This is a safety net. Prefer validation over sanitization.
 * 
 * @param inputPath - Path to sanitize
 * @returns Sanitized path
 */
export function sanitizePath(inputPath: string): string {
  return inputPath
    .trim()
    .replace(/[<>"'`]/g, '') // Remove XSS characters
    .replace(/^(javascript|data|vbscript|file|about):/gi, '') // Remove protocols
    .replace(/^https?:\/\/.*/i, '/'); // Convert external to root
}