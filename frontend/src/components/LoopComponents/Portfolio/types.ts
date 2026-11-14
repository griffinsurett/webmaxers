// src/components/LoopComponents/Portfolio/types.ts
// Shared types for portfolio components

/**
 * Image source configuration for responsive images
 */
export interface PortfolioMediaEntry {
  src: string;
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
  alt?: string;
  sources?: { type?: string; srcSet: string; sizes?: string }[];
  loading?: "eager" | "lazy";
  decoding?: "sync" | "async";
  fetchPriority?: "high" | "low" | "auto";
}

/**
 * Position-specific image sources (for 3D carousel)
 */
export interface PortfolioImageSources {
  center?: string;
  side?: string;
  mobile?: string;
}

/**
 * Portfolio item data structure
 */
export interface PortfolioItemData {
  id?: string | number;
  slug?: string;
  title?: string;
  alt?: string;
  description?: string;
  client?: string;
  category?: string;
  featuredVideo?: string;
  fullSiteImage?: any;
  bannerImage?: any;
  image?: string;
  imageSources?: PortfolioImageSources;
  dimensions?: {
    aspectRatio?: number;
  };
  technologies?: string[];
  projectUrl?: string;
  url?: string;
}

/**
 * Normalize items prop to always be an array
 */
export function normalizeItems<T>(items: T | T[] | undefined): T[] {
  if (!items) return [];
  return Array.isArray(items) ? items : [];
}

/**
 * Resolves the image source for a portfolio item
 */
export function getPortfolioImageSrc(item: PortfolioItemData): string | undefined {
  if (item.image) return item.image;
  if (item.imageSources) {
    return item.imageSources.center || item.imageSources.mobile || item.imageSources.side;
  }
  return undefined;
}

