// src/utils/images.ts
/**
 * Image Utilities
 *
 * Helper functions for working with Astro-processed images.
 * Handles both formats: direct ImageMetadata and { src: ImageMetadata, alt: string }
 */

import type { ImageMetadata } from "astro";
import type { ImageInput } from "@/content/schema";

/**
 * Type guard to check if a value is Astro ImageMetadata
 */
export function isImageMetadata(img: unknown): img is ImageMetadata {
  return Boolean(
    img &&
      typeof img === "object" &&
      "width" in img &&
      "height" in img &&
      "src" in img
  );
}

/**
 * Extract ImageMetadata from various image input formats.
 * Handles: direct ImageMetadata, { src: ImageMetadata, alt? }, or undefined
 */
export function resolveImageMetadata(
  img?: ImageInput | null
): ImageMetadata | undefined {
  if (!img) return undefined;

  // Direct ImageMetadata (from direct image() usage)
  if (isImageMetadata(img)) return img;

  // Wrapped format { src: ImageMetadata, alt?: string }
  if (
    typeof img === "object" &&
    "src" in img &&
    img.src &&
    isImageMetadata(img.src)
  ) {
    return img.src;
  }

  return undefined;
}

/**
 * Extract image URL from Astro-processed image
 *
 * With proper schema enforcement, images come in predictable formats:
 * - Astro ImageMetadata objects with src property
 * - Image objects with src: ImageMetadata
 *
 * @param img - Astro-processed image
 * @param fallback - URL to use if img is undefined
 * @returns Image URL string
 */
export function getImageUrl(
  img: ImageInput | undefined,
  fallback: string
): string {
  if (!img) return fallback;

  // ImageMetadata object (from image() helper)
  if (typeof img === "object" && "src" in img) {
    const src = img.src;

    // src is a string (processed by Astro)
    if (typeof src === "string") {
      return src;
    }

    // src is nested ImageMetadata
    if (
      typeof src === "object" &&
      src &&
      "src" in src &&
      typeof src.src === "string"
    ) {
      return src.src;
    }
  }

  // Fallback
  return fallback;
}

/**
 * Extract alt text from image object
 *
 * @param img - Image with potential alt text
 * @param fallback - Fallback alt text
 * @returns Alt text string
 */
export function getImageAlt(
  img: ImageInput | undefined,
  fallback: string
): string {
  if (!img) return fallback;

  if (typeof img === "object" && "alt" in img && typeof img.alt === "string") {
    return img.alt;
  }

  return fallback;
}

/**
 * Type guard for image object with alt
 */
export function hasAltText(img: any): img is { src: any; alt: string } {
  return (
    img &&
    typeof img === "object" &&
    "alt" in img &&
    typeof img.alt === "string"
  );
}

/**
 * Configuration for generating a cropped "above the fold" preview image.
 * Used to create a lightweight initial image that shows just the top portion
 * of a tall screenshot, reducing initial payload while maintaining visual continuity.
 */
export interface CroppedPreviewConfig {
  /** Target width for the preview (will match container width) */
  width: number;
  /** Height of the visible "above the fold" area */
  height: number;
  /** Output format */
  format: "avif" | "webp";
  /** Quality (0-100) */
  quality: number;
}

/**
 * Result from generating a cropped preview
 */
export interface CroppedPreviewResult {
  /** Optimized image result from getImage */
  image: Awaited<ReturnType<typeof import("astro:assets").getImage>>;
  /** The config used to generate this preview */
  config: CroppedPreviewConfig;
}

export interface ResponsiveCroppedImageFormatConfig {
  format: "avif" | "webp";
  quality: number;
}

export interface ResponsiveImageConfig {
  widths: number[];
  sizes: string;
  formats: ResponsiveCroppedImageFormatConfig[];
  fallbackFormat?: ResponsiveCroppedImageFormatConfig["format"];
}

export interface ResponsiveCroppedImageConfig {
  widths: number[];
  sizes: string;
  aspectRatio: number;
  formats: ResponsiveCroppedImageFormatConfig[];
  fallbackFormat?: ResponsiveCroppedImageFormatConfig["format"];
  position?: "top" | "center" | "bottom";
}

export interface ResponsiveCroppedImageResult {
  src: string;
  srcSet: string;
  sizes: string;
  width: number;
  height: number;
  sources: { type?: string; srcSet: string; sizes?: string }[];
}

export interface ResponsiveImageResult {
  src: string;
  srcSet: string;
  sizes: string;
  width: number;
  height: number;
  sources: { type?: string; srcSet: string; sizes?: string }[];
}

/**
 * Default configs for cropped preview generation.
 * Generates multiple formats for browser compatibility.
 */
export const CROPPED_PREVIEW_DEFAULTS: CroppedPreviewConfig[] = [
  { width: 860, height: 500, format: "avif", quality: 50 },
  { width: 860, height: 500, format: "webp", quality: 70 },
];

/**
 * Generate a cropped "above the fold" preview image.
 *
 * This creates a small, fast-loading image showing just the top portion
 * of a tall screenshot. Perfect for portfolio showcases where the full
 * webpage screenshot is very tall but only the top is initially visible.
 *
 * @param metadata - Source image metadata
 * @param configs - Array of format/size configs to generate
 * @returns Array of optimized cropped images
 *
 * @example
 * ```ts
 * const previews = await generateCroppedPreview(imageMetadata);
 * // Returns AVIF and WebP versions cropped to 860x500
 * ```
 */
export async function generateCroppedPreview(
  metadata: ImageMetadata,
  configs: CroppedPreviewConfig[] = CROPPED_PREVIEW_DEFAULTS
): Promise<CroppedPreviewResult[]> {
  const { getImage } = await import("astro:assets");

  const results = await Promise.all(
    configs.map(async (config) => {
      const image = await getImage({
        src: metadata,
        width: config.width,
        height: config.height,
        format: config.format,
        quality: config.quality,
        fit: "cover",
        position: "top", // Crop from top - keeps the "above the fold" content
      });

      return { image, config };
    })
  );

  return results;
}

export async function generateResponsiveCroppedImage(
  metadata: ImageMetadata,
  {
    widths,
    sizes,
    aspectRatio,
    formats,
    fallbackFormat = "webp",
    position = "top",
  }: ResponsiveCroppedImageConfig
): Promise<ResponsiveCroppedImageResult | undefined> {
  const { getImage } = await import("astro:assets");

  const optimizedByFormat = await Promise.all(
    formats.map(async ({ format, quality }) => {
      const images = await Promise.all(
        widths.map((width) =>
          getImage({
            src: metadata,
            width,
            height: Math.round(width * aspectRatio),
            format,
            quality,
            fit: "cover",
            position,
          })
        )
      );

      return { format, images };
    })
  );

  const fallbackFormatEntry =
    optimizedByFormat.find((entry) => entry.format === fallbackFormat) ??
    optimizedByFormat[optimizedByFormat.length - 1];

  if (!fallbackFormatEntry?.images.length) {
    return undefined;
  }

  const fallbackImages = fallbackFormatEntry.images;
  const defaultImage = fallbackImages[fallbackImages.length - 1];

  return {
    src: defaultImage.src,
    srcSet: fallbackImages
      .map((image, index) => `${image.src} ${widths[index]}w`)
      .join(", "),
    sizes,
    width: widths[widths.length - 1],
    height: Math.round(widths[widths.length - 1] * aspectRatio),
    sources: optimizedByFormat
      .filter((entry) => entry.format !== fallbackFormat)
      .map((entry) => ({
        type: `image/${entry.format}`,
        srcSet: entry.images
          .map((image, index) => `${image.src} ${widths[index]}w`)
          .join(", "),
        sizes,
    })),
  };
}

export async function generateResponsiveImage(
  metadata: ImageMetadata,
  {
    widths,
    sizes,
    formats,
    fallbackFormat = "webp",
  }: ResponsiveImageConfig
): Promise<ResponsiveImageResult | undefined> {
  const { getImage } = await import("astro:assets");

  const optimizedByFormat = await Promise.all(
    formats.map(async ({ format, quality }) => {
      const images = await Promise.all(
        widths.map((width) =>
          getImage({
            src: metadata,
            width,
            format,
            quality,
          })
        )
      );

      return { format, images };
    })
  );

  const fallbackFormatEntry =
    optimizedByFormat.find((entry) => entry.format === fallbackFormat) ??
    optimizedByFormat[optimizedByFormat.length - 1];

  if (!fallbackFormatEntry?.images.length) {
    return undefined;
  }

  const fallbackImages = fallbackFormatEntry.images;
  const defaultImage = fallbackImages[fallbackImages.length - 1];

  return {
    src: defaultImage.src,
    srcSet: fallbackImages
      .map((image, index) => `${image.src} ${widths[index]}w`)
      .join(", "),
    sizes,
    width: defaultImage.attributes.width,
    height: defaultImage.attributes.height,
    sources: optimizedByFormat
      .filter((entry) => entry.format !== fallbackFormat)
      .map((entry) => ({
        type: `image/${entry.format}`,
        srcSet: entry.images
          .map((image, index) => `${image.src} ${widths[index]}w`)
          .join(", "),
        sizes,
      })),
  };
}
