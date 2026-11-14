// src/utils/content.ts
/**
 * MDX Content Utilities
 * 
 * Helper functions for working with MDX files:
 * - Detecting if MDX has content beyond frontmatter
 * - Extracting raw frontmatter
 * - Loading MDX components conditionally
 * 
 * Used to determine if collection _meta.mdx files should render their content
 * or just use their frontmatter for configuration.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Get raw MDX source for a specific file
 * 
 * Reads the file directly from the filesystem.
 * 
 * @param collectionName - Collection containing the file
 * @param fileName - Name of the MDX file (without extension)
 * @returns Raw file content or null if not found
 */
function getRawMDXContent(collectionName: string, fileName: string): string | null {
  try {
    const filePath = join(process.cwd(), 'src', 'content', collectionName, `${fileName}.mdx`);
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    return null;
  }
}

/**
 * Check if MDX file has content after the frontmatter block
 * 
 * Looks for content after the closing --- of frontmatter.
 * Returns false if only whitespace found.
 * 
 * @param rawContent - Raw MDX file content
 * @returns True if actual content exists after frontmatter
 */
function hasContentAfterFrontmatter(rawContent: string): boolean {
  const frontmatterEnd = rawContent.indexOf('---', 4); // Start after first ---
  if (frontmatterEnd === -1) return false;
  
  const contentAfterFrontmatter = rawContent.substring(frontmatterEnd + 3).trim();
  return contentAfterFrontmatter.length > 0;
}

/**
 * Extract frontmatter YAML from raw MDX content
 * 
 * @param rawContent - Raw MDX file content
 * @returns Frontmatter YAML string or null if invalid
 */
export function extractFrontmatter(rawContent: string): string | null {
  const frontmatterStart = rawContent.indexOf('---');
  if (frontmatterStart !== 0) return null;
  
  const frontmatterEnd = rawContent.indexOf('---', 3);
  if (frontmatterEnd === -1) return null;
  
  return rawContent.substring(3, frontmatterEnd).trim();
}

/**
 * Get MDX component and check if it has content
 * 
 * Loads the MDX file and checks if it has renderable content
 * beyond frontmatter. Used to determine if _meta.mdx should
 * render or just provide configuration.
 * 
 * @param collectionName - Collection name
 * @param fileName - MDX filename without extension
 * @returns Object with Component and hasContent flag, or null if not found
 * @example
 * const result = await getMDXContentIfExists('blog', '_meta');
 * if (result?.hasContent) {
 *   return <result.Component />;
 * }
 */
export async function getMDXContentIfExists(
  collectionName: string,
  fileName: string = '_meta'
): Promise<{ Component: any; hasContent: boolean } | null> {
  try {
    // Get raw content first to check if it has actual content
    const rawContent = getRawMDXContent(collectionName, fileName);
    
    if (!rawContent) {
      return null;
    }
    
    const hasContent = hasContentAfterFrontmatter(rawContent);
    
    // Only import the MDX module if it has content to render
    if (!hasContent) {
      return { Component: null, hasContent: false };
    }
    
    // ✅ Dynamic import is safe - happens at runtime, not module init
    const mdxModule = await import(`../content/${collectionName}/${fileName}.mdx`);
    
    return {
      Component: mdxModule.default,
      hasContent: true
    };
  } catch (error) {
    console.warn(`Failed to load MDX: ${collectionName}/${fileName}.mdx`, error);
    return null;
  }
}

/**
 * Convenience function for loading collection _meta.mdx
 * 
 * @param collectionName - Collection to load _meta.mdx from
 * @returns MDX component and hasContent flag
 */
export async function getCollectionMetaMDX(collectionName: string) {
  return getMDXContentIfExists(collectionName, '_meta');
}