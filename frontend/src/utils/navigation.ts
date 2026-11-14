// src/utils/navigation.ts
import { normalizePath } from './pathValidation';

/**
 * Check if a URL is active based on current path (EXACT MATCH ONLY)
 */
export function isActivePath(itemUrl: string | undefined, currentPath: string): boolean {
  if (!itemUrl) return false;
  
  const normalizedItem = normalizePath(itemUrl);
  const normalizedCurrent = normalizePath(currentPath);
  
  // Only exact match
  return normalizedItem === normalizedCurrent;
}

/**
 * Check if any child in a tree has active path
 */
export function hasActiveDescendant(item: any, currentPath: string): boolean {
  if (!item.children || item.children.length === 0) return false;
  
  return item.children.some((child: any) => 
    isActivePath(child.url, currentPath) || 
    hasActiveDescendant(child, currentPath)
  );
}