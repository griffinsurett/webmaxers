// src/utils/redirects/index.ts
/**
 * Redirect System - Main Entry Point
 * 
 * Orchestrates redirect collection, validation, and configuration building.
 * This is the main file imported by astro.config.mjs.
 */

import { collectAllRedirects } from './collector';
import { collectAllPathAliasRedirects } from './pathAliasCollector';
import { validateRedirects } from './validation';
import type { RedirectConfig, RedirectEntry } from './types';

// Re-export types for convenience
export type { RedirectConfig, RedirectEntry } from './types';

/**
 * Build redirect configuration for Astro
 * 
 * Main function called from astro.config.mjs.
 * Collects, validates, and formats redirects.
 * 
 * @param includeWarnings - Whether to log warnings (default: true)
 * @returns Redirect configuration object for Astro
 * @throws Error if validation fails
 */
export function buildRedirectConfig(includeWarnings: boolean = true): RedirectConfig {
  // Collect manual redirects from frontmatter
  const manualRedirects = collectAllRedirects();
  
  // Collect automatic path alias redirects
  const pathAliasRedirects = collectAllPathAliasRedirects();
  
  // Combine all redirects
  const allRedirects = [...manualRedirects, ...pathAliasRedirects];
  
  // Validate for security and correctness
  const validation = validateRedirects(allRedirects);
  
  // Log validation results
  if (validation.errors.length > 0) {
    console.error('\n❌ Redirect validation errors:');
    validation.errors.forEach(error => console.error(`  ${error}`));
    console.error('');
    throw new Error('Redirect configuration has errors. Please fix them before building.');
  }
  
  if (includeWarnings && validation.warnings.length > 0) {
    console.warn('\n⚠️  Redirect warnings:');
    validation.warnings.forEach(warning => console.warn(`  ${warning}`));
    console.warn('');
  }
  
  // Build config object, removing duplicates (manual redirects take precedence)
  const config: RedirectConfig = {};
  const seen = new Set<string>();
  
  // Add manual redirects first (higher priority)
  for (const redirect of manualRedirects) {
    if (seen.has(redirect.from)) {
      continue;
    }
    
    seen.add(redirect.from);
    config[redirect.from] = redirect.to;
  }

  // Add path alias redirects (lower priority)
  for (const redirect of pathAliasRedirects) {
    if (seen.has(redirect.from)) {
      continue;
    }

    seen.add(redirect.from);
    config[redirect.from] = redirect.to;
  }
  
  if (Object.keys(config).length > 0) {
    const manualCount = manualRedirects.length;
    const aliasCount = pathAliasRedirects.length;
    console.log(`✅ Generated ${Object.keys(config).length} redirects (${manualCount} manual, ${aliasCount} path aliases)`);
  }
  
  return config;
}

/**
 * Log all redirects in a readable format
 * Useful for debugging
 * 
 * @param contentDir - Optional content directory path
 */
export function logRedirects(contentDir?: string): void {
  const manualRedirects = collectAllRedirects(contentDir);
  const pathAliasRedirects = collectAllPathAliasRedirects(contentDir);
  const allRedirects = [...manualRedirects, ...pathAliasRedirects];
  
  console.log('\n📋 All Redirects:');
  console.log('─'.repeat(80));
  
  // Group by type
  const byType = new Map<string, RedirectEntry[]>();
  
  for (const redirect of allRedirects) {
    const existing = byType.get(redirect.type) || [];
    existing.push(redirect);
    byType.set(redirect.type, existing);
  }
  
  // Display manual redirects
  const manual = byType.get('collection') || [];
  const item = byType.get('item') || [];
  if (manual.length > 0 || item.length > 0) {
    console.log('\n📝 Manual Redirects (from redirectFrom):');
    [...manual, ...item].forEach(redirect => {
      console.log(`  ${redirect.from} → ${redirect.to} (${redirect.source})`);
    });
  }
  
  // Display path alias redirects
  const aliases = byType.get('path-alias') || [];
  if (aliases.length > 0) {
    console.log('\n🔄 Path Alias Redirects (automatic):');
    aliases.forEach(redirect => {
      console.log(`  ${redirect.from} → ${redirect.to}`);
    });
  }
  
  console.log('\n' + '─'.repeat(80));
  console.log(`Total: ${allRedirects.length} redirects\n`);
}