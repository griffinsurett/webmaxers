// src/components/ContentRenderer/utils/renderContent.ts
/**
 * Content Rendering Utility
 * 
 * Helper to extract rendered HTML from items with Content components.
 * Must be called from within an Astro component context.
 */

export interface ItemWithContent {
  Content?: any;
  content?: string;
  description?: string;
  [key: string]: any;
}

/**
 * Render a single Content component to HTML string
 * Uses a workaround since we can't directly call AstroComponentFactory
 */
async function renderContentToString(Content: any): Promise<string> {
  // Content components from render() are not meant to be called directly
  // We need to render them in the template context instead
  // For now, return empty string and handle in template
  return '';
}

/**
 * Check if a string contains HTML
 */
export function isHTMLString(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}