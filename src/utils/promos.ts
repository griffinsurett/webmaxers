// src/utils/promos.ts
/**
 * Active-promo resolution for the timed popup.
 *
 * Port of i75's `src/utils/specials.ts` (`getActiveSpecialUiState` +
 * `resolveSpecialPopupContent`), reduced to what this site actually has: there
 * are no landing pages, pricing references or e-commerce links to resolve here,
 * so the href comes from the entry's own `link` rather than a lookup chain.
 *
 * The rule that matters is i75's and is kept intact: **`popup.X` overrides the
 * entry's own field, and `enabled` is DERIVED** — a promo renders only if it is
 * switched on AND resolves to a real href AND has something to say. A promo can
 * therefore never half-render, and deleting the entry (or blanking the slug)
 * removes the popup without touching a component.
 */
import { getEntry, type CollectionEntry } from "astro:content";
import { siteData, contactCtaData, popupData } from "@/content/siteData";

type PromoEntry = CollectionEntry<"promos">;
type PromoPopupConfig = NonNullable<PromoEntry["data"]["popup"]>;

export interface ResolvedPromoPopup {
  enabled: boolean;
  eyebrow?: string;
  heading: string;
  description: string;
  buttonText: string;
  href: string;
  secondaryButtonText?: string;
  secondaryHref?: string;
  secondaryExternal: boolean;
  campaignSlug: string;
  delayMs: number;
  scrollPercent: number;
  frequencyMode: "campaign" | "session" | "always";
  storageKeyPrefix: string;
  excludePaths: string[];
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalTrimmed(value: unknown): string | undefined {
  return trimmed(value) || undefined;
}

/** Strips surrounding slashes so "/game/" and "game" compare equal. */
function normalizePath(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
}

export function getActivePromoSlug(): string | null {
  const slug = trimmed(siteData.activePromoSlug);
  return slug || null;
}

/**
 * The live promo entry, or null when none is set / the slug does not resolve.
 * Cached per slug: the popup host runs on every page, and without this the
 * same entry is re-read once per route at build time.
 */
let cacheSlug: string | null | undefined;
let cachePromise: Promise<PromoEntry | null> | null = null;

export async function getActivePromoEntry(): Promise<PromoEntry | null> {
  const slug = getActivePromoSlug();
  if (!slug) return null;

  if (cachePromise && cacheSlug === slug) return cachePromise;

  cacheSlug = slug;
  // A slug naming a deleted/renamed entry must not fail the build — it means
  // "no promo", the same as an empty slug.
  cachePromise = getEntry("promos", slug).then(
    (entry) => entry ?? null,
    () => null,
  );

  return cachePromise;
}

/**
 * Collapse an entry into the props the popup island takes.
 *
 * Mirrors i75's fallback chain: popup override → entry field → site default.
 */
export function resolvePromoPopup(entry: PromoEntry | null): ResolvedPromoPopup {
  const popup: PromoPopupConfig | undefined = entry?.data?.popup;
  const campaignSlug = entry?.id ? normalizePath(entry.id) : "";

  const heading = trimmed(popup?.heading) || trimmed(entry?.data?.title);
  const description =
    trimmed(popup?.description) || trimmed(entry?.data?.description);
  const href = trimmed(popup?.href) || trimmed(entry?.data?.link);
  const eyebrow = optionalTrimmed(popup?.eyebrow) ?? optionalTrimmed(entry?.data?.eyebrow);

  // The secondary action defaults to the site's booking CTA, so the Calendly
  // URL lives in siteData only and is not repeated in every promo entry.
  const secondaryButtonText = optionalTrimmed(popup?.secondaryButtonText);
  const secondaryHref =
    optionalTrimmed(popup?.secondaryHref) ?? (secondaryButtonText ? contactCtaData.link : undefined);

  return {
    // DERIVED, never taken on trust — same as i75. A promo that is switched on
    // but has no href or no copy is not renderable, so it is not enabled.
    enabled:
      Boolean(popup?.enabled) &&
      Boolean(campaignSlug) &&
      Boolean(href) &&
      Boolean(heading || description),
    eyebrow,
    heading,
    description,
    buttonText: trimmed(popup?.buttonText) || "View offer",
    href,
    secondaryButtonText,
    secondaryHref,
    secondaryExternal: popup?.secondaryExternal ?? false,
    campaignSlug,
    // Timing/frequency: per-promo override, else the site-wide default.
    delayMs: popup?.delayMs ?? popupData.delayMs,
    scrollPercent: popup?.scrollPercent ?? popupData.scrollPercent,
    frequencyMode: popup?.frequencyMode ?? popupData.frequencyMode,
    storageKeyPrefix: popupData.storageKeyPrefix,
    excludePaths: popup?.excludePaths ?? [],
  };
}

/** True when `pathname` matches one of the promo's `excludePaths`. */
export function isExcludedPath(pathname: string, excludePaths: string[]): boolean {
  const current = normalizePath(pathname);
  return excludePaths.some((p) => normalizePath(p) === current);
}
