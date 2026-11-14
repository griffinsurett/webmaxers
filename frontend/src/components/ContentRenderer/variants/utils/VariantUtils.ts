// src/components/section/variants/utils/VariantUtils.ts
/**
 * Variant Discovery Utility
 * 
 * Dynamically discovers all variant components in the variants directory.
 * This allows adding new variants without updating imports.
 * 
 * Uses Vite's glob import to load all .astro files in the parent directory.
 */

/**
 * Load all variant components dynamically
 * 
 * @returns Object mapping variant names to their component modules
 * @example
 * {
 *   'CardVariant': CardVariantComponent,
 *   'BlogVariant': BlogVariantComponent,
 *   ...
 * }
 */
export async function getVariantComponents() {
  // Glob import all .astro files in parent directory
  const variants = import.meta.glob('../*.astro', { eager: true });
  
  // Build map of variant name -> component
  return Object.entries(variants).reduce((acc, [path, module]) => {
    // Extract filename without extension
    const fileName = path.split('/').pop()?.replace('.astro', '');
    
    // Add to map if valid module with default export
    if (fileName && module && typeof module === 'object' && 'default' in module) {
      acc[fileName] = module.default;
    }
    
    return acc;
  }, {} as Record<string, any>);
}