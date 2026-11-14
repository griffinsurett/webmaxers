// src/integrations/preferences/core/language/types.ts
/**
 * Language Integration Types
 *
 * Shared type definitions for the language integration.
 * Import these when building custom language UI components.
 */

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag?: string;
}

export interface LanguageSwitcherState {
  /** Currently selected language */
  currentLanguage: Language;
  /** All available languages */
  languages: Language[];
  /** Whether a language change is in progress */
  isLoading: boolean;
  /** Whether Google Translate is available */
  isTranslateAvailable: boolean;
  /** Whether consent is required for translation */
  requiresConsent: boolean;
  /** Error message if any */
  error: string | null;
}

export interface LanguageSwitcherActions {
  /** Change to a different language */
  changeLanguage: (code: string) => void;
  /** Reset to default language */
  resetLanguage: () => void;
}

export type UseLanguageSwitcherReturn = LanguageSwitcherState & LanguageSwitcherActions;
