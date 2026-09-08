// src/integrations/preferences/core/language/hooks/useLanguageSwitcher.ts
/**
 * Language Switcher Hook (Core)
 *
 * Provides all functionality for language switching:
 * - Current language state with storage sync
 * - Consent checking for Google Translate
 * - Native translation detection
 * - Language change handler with validation
 *
 * This is the single source of truth for language switching logic.
 * UI components should use this hook and provide their own design.
 *
 * @example
 * ```tsx
 * import { useLanguageSwitcher } from '@/integrations/preferences/language/core/hooks/useLanguageSwitcher';
 *
 * function MyCustomLanguagePicker() {
 *   const { currentLanguage, supportedLanguages, changeLanguage } = useLanguageSwitcher();
 *   // Build your own UI...
 * }
 * ```
 */

import { useEffect, useState, useCallback } from "react";
import {
  supportedLanguages,
  getLanguageByCode,
  defaultLanguage,
  type Language,
} from "../utils/languages";


// Functional consent, read from Zest. Only the Google Translate fallback needs
// it — the native Translator API path is cookieless and never consulted here.
function hasFunctionalConsentFast(): boolean {
  if (typeof window === "undefined") return false;
  return (window as any).Zest?.hasConsent?.("functional") === true;
}

function hasNativeTranslation(): boolean {
  if (typeof window === "undefined") return false;
  const config = (window as any).getTranslationConfig?.();
  const enabledInConfig = config?.enableNative !== false;
  return enabledInConfig && "Translator" in window;
}

function isGoogleTranslateEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const config = (window as any).getTranslationConfig?.();
  return config?.enableGoogle !== false;
}

function getStoredLanguageCode(): string {
  if (typeof window === "undefined") return defaultLanguage.code;
  return localStorage.getItem("user-language") || defaultLanguage.code;
}

export interface UseLanguageSwitcherReturn {
  /** Current language object */
  currentLanguage: Language;
  /** Current language code */
  languageCode: string;
  /** Whether user has functional consent */
  hasFunctionalConsent: boolean;
  /** Whether native browser translation is available */
  hasNativeTranslation: boolean;
  /** Whether Google Translate is enabled */
  isGoogleTranslateEnabled: boolean;
  /** Whether consent is required to switch languages */
  requiresConsent: boolean;
  /** List of supported languages */
  supportedLanguages: Language[];
  /** Change language with consent checking */
  changeLanguage: (code: string) => { success: boolean; error?: string };
  /** Open cookie preferences modal */
  openConsentModal: () => void;
  /** Reset to default language */
  resetLanguage: () => void;
}

export function useLanguageSwitcher(): UseLanguageSwitcherReturn {
  const [languageCode, setLanguageCode] = useState(getStoredLanguageCode);
  const [hasFunctionalConsent, setHasFunctionalConsent] = useState(hasFunctionalConsentFast);

  // Sync language code from storage (cross-tab) and custom event (same-tab)
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "user-language") {
        setLanguageCode(event.newValue || defaultLanguage.code);
      }
    };
    const handleLanguageChange = (event: CustomEvent<string>) => {
      setLanguageCode(event.detail || defaultLanguage.code);
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("language-changed", handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("language-changed", handleLanguageChange as EventListener);
    };
  }, []);

  // Listen for consent changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleConsentChange = () => setHasFunctionalConsent(hasFunctionalConsentFast());
    window.addEventListener("zest:change", handleConsentChange);
    return () => window.removeEventListener("zest:change", handleConsentChange);
  }, []);

  const currentLanguage = getLanguageByCode(languageCode) || defaultLanguage;
  const nativeAvailable = hasNativeTranslation();
  const googleEnabled = isGoogleTranslateEnabled();
  const requiresConsent = !nativeAvailable && googleEnabled && !hasFunctionalConsent;

  const changeLanguage = useCallback((code: string): { success: boolean; error?: string } => {
    const nativeAvailable = hasNativeTranslation();
    const googleEnabled = isGoogleTranslateEnabled();
    const hasConsent = hasFunctionalConsentFast();
    const needsConsent = !nativeAvailable && googleEnabled && !hasConsent;

    // Check if consent is needed for non-English languages
    if (needsConsent && code !== "en") {
      return {
        success: false,
        error: "Please enable functional cookies to use the language switcher.",
      };
    }

    // Check if translation is disabled entirely
    if (!nativeAvailable && !googleEnabled && code !== "en") {
      return {
        success: false,
        error: "Translation is currently disabled.",
      };
    }

    // Validate language code
    const nextLanguage = getLanguageByCode(code);
    if (!nextLanguage) {
      return {
        success: false,
        error: `Invalid language code: ${code}`,
      };
    }

    // Update state and notify other instances
    setLanguageCode(code);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("language-changed", { detail: code }));
    }

    // Trigger actual translation via global function
    if (typeof window !== "undefined" && (window as any).changeLanguage) {
      (window as any).changeLanguage(code);
    }

    return { success: true };
  }, []);

  const openConsentModal = useCallback(() => {
    (window as any).Zest?.showSettings?.();
  }, []);

  const resetLanguage = useCallback(() => {
    changeLanguage(defaultLanguage.code);
  }, [changeLanguage]);

  return {
    currentLanguage,
    languageCode,
    hasFunctionalConsent,
    hasNativeTranslation: nativeAvailable,
    isGoogleTranslateEnabled: googleEnabled,
    requiresConsent,
    supportedLanguages,
    changeLanguage,
    openConsentModal,
    resetLanguage,
  };
}
