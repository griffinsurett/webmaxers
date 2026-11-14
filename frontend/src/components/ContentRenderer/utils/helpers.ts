// src/components/ContentRenderer/utils/helpers.ts

/**
 * Check if collection CTA should be displayed
 */
export function shouldShowCollectionCTA(
  collectionUrl?: string,
  itemCount?: number
): boolean {
  return !!(collectionUrl && itemCount && itemCount > 0);
}

