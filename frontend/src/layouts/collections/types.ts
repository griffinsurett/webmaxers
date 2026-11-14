// src/layouts/collections/types.ts
/**
 * Collection Layout Type Definitions
 * 
 * Shared types for all collection layout components.
 * Ensures consistent props across different layout variants.
 */

/**
 * Props passed to collection layout components
 */
export interface CollectionLayoutProps {
  entry?: any;                // The collection entry being rendered
  collection?: string;        // Name of the collection
  collectionMeta?: any;       // Metadata from _meta.mdx
  Content?: any;             // MDX content component (if applicable)
  isIndexPage?: boolean;      // True if this is the collection index
  seoProps?: any;            // SEO metadata for the page
  [key: string]: any;        // Allow additional custom props
}