// src/utils/languageDetection.ts
/**
 * Shared Language Detection Utilities
 * 
 * Pure functions that can be used both in inline scripts and TypeScript modules.
 */

import { supportedLanguages } from "./languages";

/**
 * Get list of supported language codes (base codes only)
 */
export function getSupportedLanguageCodes(): string[] {
  const codes = supportedLanguages.map(lang => lang.code.split('-')[0]);
  return [...new Set(codes)];
}

/**
 * Generate cache key for translated content
 */
export function getCacheKey(lang: string, pathname: string): string {
  return `translated_body_${lang}_${pathname}`;
}

/**
 * List of Google Translate artifacts to remove from cached HTML
 */
export const GOOGLE_TRANSLATE_ARTIFACTS = [
  '.skiptranslate',
  '.goog-te-banner-frame',
  'iframe.skiptranslate',
  '#google_translate_element',
  'script[src*="translate.google"]',
  'script[src*="translate_a"]',
  'link[href*="translate.googleapis"]',
  'style[id*="goog"]',
  '.goog-te-spinner-pos'
] as const;