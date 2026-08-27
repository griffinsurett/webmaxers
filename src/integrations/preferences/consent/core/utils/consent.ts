// src/integrations/preferences/consent/core/utils/consent.ts
/**
 * Consent Management Utilities
 *
 * Pure functions for checking and managing consent that work in both:
 * - Vanilla JavaScript (inline scripts, Astro components)
 * - React components and hooks
 *
 * Categories are Google Consent Mode v2 types — see ../types.ts.
 * Uses cookie storage for consent state (GDPR requirement for persistence)
 */

import { getCookie, setCookie } from '@/utils/cookies';
import {
  ALWAYS_GRANTED,
  CONSENT_TYPES,
  defaultConsent,
  isCurrentConsent,
  type CookieConsent,
  type ConsentType,
} from '../types';

export const CONSENT_COOKIE = 'cookie-consent';

/**
 * Get current consent state from cookie.
 * Returns null when absent, malformed, or written under an older shape — all of
 * which mean "this visitor has not consented under the current model".
 */
export function getConsent(): CookieConsent | null {
  if (typeof document === 'undefined') return null;

  try {
    const consentCookie = getCookie(CONSENT_COOKIE);
    if (!consentCookie) return null;

    const parsed = JSON.parse(consentCookie) as unknown;
    return isCurrentConsent(parsed) ? parsed : null;
  } catch (error) {
    console.error('Error parsing consent cookie:', error);
    return null;
  }
}

/** Persist a consent record and notify listeners. */
export function saveConsent(consent: CookieConsent): void {
  if (typeof document === 'undefined') return;

  setCookie(CONSENT_COOKIE, JSON.stringify(consent), { expires: 365 });
  window.dispatchEvent(new Event('consent-changed'));
}

/**
 * Check if user has given consent for a specific type.
 */
export function hasConsentFor(type: ConsentType): boolean {
  if (typeof document === 'undefined') return false;

  // Strictly necessary types are always allowed.
  if (ALWAYS_GRANTED.includes(type)) return true;

  const consent = getConsent();
  if (!consent) return false;

  return consent[type] === true;
}

/**
 * Check if consent has been given (user has made a choice under the current
 * model). A pre-v2 cookie reads as "not consented" so the banner shows again.
 */
export function hasConsented(): boolean {
  if (typeof document === 'undefined') return false;
  return getConsent() !== null;
}

/**
 * Quick inline check for consent. Unlike hasConsented() this does not validate
 * the shape, so it stays cheap for inline scripts that only need to know whether
 * anything was stored at all.
 */
export function hasConsentCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes(`${CONSENT_COOKIE}=`);
}

/**
 * Check if user has "Do Not Track" enabled
 * CCPA requires honoring this signal
 */
export function hasDoNotTrack(): boolean {
  if (typeof navigator === 'undefined') return false;

  const dnt = navigator.doNotTrack ||
              (window as any).doNotTrack ||
              (navigator as any).msDoNotTrack;

  return dnt === '1' || dnt === 'yes';
}

/**
 * Check if tracking is allowed (combines consent + DNT)
 */
export function isTrackingAllowed(type: ConsentType): boolean {
  if (hasDoNotTrack()) return false;

  return hasConsentFor(type);
}

/**
 * Build the `gtag('consent', 'update', ...)` payload for a consent record.
 * Single source of truth so the inline GTM script and any React caller cannot
 * disagree about what a stored choice means.
 */
export function toConsentModePayload(
  consent: CookieConsent | null
): Record<ConsentType, 'granted' | 'denied'> {
  const source = consent ?? defaultConsent();

  return Object.fromEntries(
    CONSENT_TYPES.map((type) => [
      type,
      source[type] ? 'granted' : 'denied',
    ])
  ) as Record<ConsentType, 'granted' | 'denied'>;
}

/**
 * CCPA Opt-Out - Disable all non-essential tracking
 */
export function optOutOfSale(): void {
  if (typeof document === 'undefined') return;

  saveConsent(defaultConsent());
}
