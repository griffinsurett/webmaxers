// src/integrations/preferences/consent/core/types.ts
/**
 * Cookie Consent Type Definitions
 *
 * Categories ARE Google Consent Mode v2 types, so the banner's stored state maps
 * 1:1 onto the `gtag('consent', ...)` payload with no translation layer. The
 * previous model used generic buckets (necessary/functional/performance/
 * targeting) that had to be re-mapped for Google, which made it easy for the two
 * to drift apart.
 *
 * The three ad_* types are stored separately (Google treats them separately) but
 * are presented under one "Advertising" toggle in the UI — asking a visitor to
 * reason about ad_user_data vs ad_personalization is not a real choice.
 *
 * Reference: https://developers.google.com/tag-platform/security/guides/consent
 */

/** Consent Mode v2 types this site asks about. */
export const CONSENT_TYPES = [
  'security_storage',
  'functionality_storage',
  'analytics_storage',
  'ad_storage',
  'ad_user_data',
  'ad_personalization',
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

/**
 * Types that are always granted — strictly necessary for the site to work, so
 * they are never presented as a choice (and never denied).
 */
export const ALWAYS_GRANTED: readonly ConsentType[] = ['security_storage'];

/**
 * Types set together by the single user-facing "Advertising" toggle.
 * Google keeps them distinct; the UI does not.
 */
export const AD_TYPES: readonly ConsentType[] = [
  'ad_storage',
  'ad_user_data',
  'ad_personalization',
];

/**
 * Bumped whenever the stored shape changes. A cookie without a matching version
 * is ignored, so the banner reappears and the visitor consents under the current
 * model rather than us guessing at a migration.
 */
export const CONSENT_VERSION = 2;

export interface CookieConsent extends Record<ConsentType, boolean> {
  /** Shape version — see CONSENT_VERSION. */
  version: number;
  timestamp: number;
}

export type CookieCategory = ConsentType;

export interface CookieCategoryInfo {
  /** The consent type this row controls (the ad row controls all of AD_TYPES). */
  id: ConsentType;
  title: string;
  description: string;
  required?: boolean;
}

/** Consent state used before a choice is made: everything off but the essentials. */
export function defaultConsent(): CookieConsent {
  return {
    security_storage: true,
    functionality_storage: false,
    analytics_storage: false,
    ad_storage: false,
    ad_user_data: false,
    ad_personalization: false,
    version: CONSENT_VERSION,
    timestamp: Date.now(),
  };
}

/** Consent state for "Accept All". */
export function fullConsent(): CookieConsent {
  return {
    security_storage: true,
    functionality_storage: true,
    analytics_storage: true,
    ad_storage: true,
    ad_user_data: true,
    ad_personalization: true,
    version: CONSENT_VERSION,
    timestamp: Date.now(),
  };
}

/**
 * Narrow unknown parsed JSON to a usable consent record.
 * Rejects anything without the current version — that is what re-prompts
 * visitors holding a pre-v2 cookie.
 */
export function isCurrentConsent(value: unknown): value is CookieConsent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.version !== CONSENT_VERSION) return false;
  return CONSENT_TYPES.every((t) => typeof v[t] === 'boolean');
}
