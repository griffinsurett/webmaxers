// src/utils/idRegistry.ts
/**
 * ID Registry Utilities
 * 
 * Shared utilities for tracking and auto-incrementing IDs across different contexts.
 * Used by MenuItemsLoader and ContentRenderer to prevent ID collisions.
 */

/**
 * Simple ID registry for single-context tracking
 * Used by loaders that run once per build
 */
export class SimpleIdRegistry {
  private registry = new Map<string, number>();
  
  /**
   * Register an ID and get unique version with auto-increment
   * @param baseId - Base ID to register
   * @returns Unique ID (base or base-N)
   */
  getUniqueId(baseId: string): string {
    const count = this.registry.get(baseId) || 0;
    this.registry.set(baseId, count + 1);
    
    return count === 0 ? baseId : `${baseId}-${count}`;
  }
  
  /**
   * Check if an ID has been used
   */
  has(baseId: string): boolean {
    return this.registry.has(baseId);
  }
  
  /**
   * Get current count for an ID (0 if unused)
   */
  getCount(baseId: string): number {
    return this.registry.get(baseId) || 0;
  }
  
  /**
   * Clear the registry
   */
  clear(): void {
    this.registry.clear();
  }
  
  /**
   * Get total number of unique base IDs tracked
   */
  get size(): number {
    return this.registry.size;
  }
}

/**
 * Scoped ID registry for multi-context tracking
 * Used by ContentRenderer which tracks IDs per page
 */
export class ScopedIdRegistry {
  private registry = new Map<string, Map<string, number>>();
  
  /**
   * Register an ID in a scope and return its count
   * @param scope - Scope identifier (e.g., page path)
   * @param baseId - Base ID to register
   * @returns Count (0 for first use, 1 for second, 2 for third, etc.)
   */
  register(scope: string, baseId: string): number {
    if (!this.registry.has(scope)) {
      this.registry.set(scope, new Map());
    }
    
    const scopeRegistry = this.registry.get(scope)!;
    const count = scopeRegistry.get(baseId) || 0;
    scopeRegistry.set(baseId, count + 1);
    
    return count;
  }
  
  /**
   * Get current count for a base ID in a scope (without incrementing)
   */
  getCount(scope: string, baseId: string): number {
    return this.registry.get(scope)?.get(baseId) || 0;
  }
  
  /**
   * Check if base ID exists in scope
   */
  has(scope: string, baseId: string): boolean {
    return (this.registry.get(scope)?.get(baseId) || 0) > 0;
  }
  
  /**
   * Clear a specific scope
   */
  clearScope(scope: string): void {
    this.registry.delete(scope);
  }
  
  /**
   * Clear all scopes
   */
  clear(): void {
    this.registry.clear();
  }
  
  /**
   * Get all scopes
   */
  getScopes(): string[] {
    return Array.from(this.registry.keys());
  }
  
  /**
   * Get total number of scopes
   */
  get scopeCount(): number {
    return this.registry.size;
  }
}

/**
 * Helper: Format ID with optional suffix
 */
export function formatId(baseId: string, suffix?: string | number): string {
  if (suffix === undefined || suffix === 0) return baseId;
  return `${baseId}-${suffix}`;
}

/**
 * Helper: Parse ID into base and suffix
 */
export function parseId(id: string): { base: string; suffix?: number } {
  const match = id.match(/^(.+)-(\d+)$/);
  if (match) {
    return { base: match[1], suffix: parseInt(match[2], 10) };
  }
  return { base: id };
}