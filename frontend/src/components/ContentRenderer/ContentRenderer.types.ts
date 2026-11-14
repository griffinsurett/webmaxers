// src/components/ContentRenderer/ContentRenderer.types.ts
/**
 * Content Renderer Type Definitions
 *
 * Type definitions for the Content Renderer component and its variants.
 * Provides a consistent interface for all content renderer variants.
 */

import type { Query } from '@/utils/query';
import type { CollectionKey } from 'astro:content';
import type { PreparedItem } from '@/utils/collections';
import type { HeadingContent } from '@/content/schema';

/**
 * Base props available to all section variants
 */
export interface BaseVariantProps {
  items?: PreparedItem[];      // Prepared collection items or static items
  title?: string;              // Section heading
  heading?: string | HeadingContent | null; // Optional segmented heading content
  description?: string;        // Section description/subtitle
  className?: string;          // Additional CSS classes
  headingClassName?: string;   // Custom heading CSS classes (overrides variant default)
  headingTag?: string;         // Custom heading tag (h1-h6, overrides variant default)
  collectionUrl?: string;      // URL to collection index page (for "View All" links)
  collectionTitle?: string;    // Display name for collection (for "View All" text)
  id?: string;                 // Manual ID override (auto-generated if not provided)
  showButtonSection?: boolean; // Allows manual control over CTA/button visibility
  showHeadingDivider?: boolean; // Optional divider between heading and content
  showHeadingSection?: boolean; // Toggle heading/description wrapper
}

/**
 * Props for the main Section component
 * Uses Query object instead of collection string
 */
export interface SectionProps extends Partial<BaseVariantProps> {
  query?: Query<CollectionKey>;  // Query object for fetching items
  variant?: string;               // Variant component to render with
  [key: string]: any;             // Allow additional variant-specific props
}
