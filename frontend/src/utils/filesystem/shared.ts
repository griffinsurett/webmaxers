// src/utils/filesystem/shared.ts
/**
 * Shared Filesystem Utilities
 * 
 * Common filesystem operations used across multiple modules.
 * Extracted to prevent duplication.
 */

import fs from 'node:fs';

/**
 * Get all collection directories from content folder
 * 
 * @param contentDir - Path to content directory
 * @returns Array of collection names
 */
export function getCollectionDirs(contentDir: string): string[] {
  if (!fs.existsSync(contentDir)) {
    return [];
  }
  
  const entries = fs.readdirSync(contentDir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => !name.startsWith('.') && !name.startsWith('_'));
}