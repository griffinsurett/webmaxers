// src/integrations/preferences/ui/language/components/LanguageDropdown.tsx
/**
 * Language Dropdown (Default UI)
 *
 * Styled dropdown for the language selector.
 * Uses the useLanguageSwitcher hook from core for all functionality.
 *
 * For custom designs, import the hook directly:
 * import { useLanguageSwitcher } from '@/integrations/preferences/language/core/hooks/useLanguageSwitcher';
 */

import { useLanguageSwitcher } from "@/integrations/preferences/language/core/hooks/useLanguageSwitcher";

interface Props {
  open: boolean;
  onClose: () => void;
  onLanguageChange: (code: string) => void;
  className?: string;
}

export default function LanguageDropdown({
  open,
  onClose,
  onLanguageChange,
  className = "",
}: Props) {
  const {
    currentLanguage,
    requiresConsent,
    supportedLanguages,
    changeLanguage,
    openConsentModal,
  } = useLanguageSwitcher();

  const handleOpenConsentModal = () => {
    openConsentModal();
    onClose();
  };

  const handleLanguageChange = (code: string) => {
    const result = changeLanguage(code);

    if (!result.success && result.error) {
      alert(result.error);
      return;
    }

    onLanguageChange(code);
    onClose();
  };

  if (!open) return null;

  const containerClasses = [
    "absolute top-full z-[60] mt-3 min-w-[220px] rounded-2xl border border-text/10 bg-surface p-3 shadow-xl backdrop-blur-xl",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={containerClasses}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      {requiresConsent && (
        <button
          type="button"
          onClick={handleOpenConsentModal}
          className="mb-2 rounded-xl border border-yellow-400/40 bg-yellow-500/15 px-3 py-2 text-xs text-text text-left transition hover:border-yellow-400 hover:bg-yellow-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
        >
          Enable functional cookies to switch languages.
          <span className="mt-1 block small-text font-semibold uppercase tracking-wide text-primary">
            Manage consent preferences
          </span>
        </button>
      )}

      <div className="flex max-h-64 flex-col overflow-y-auto">
        {supportedLanguages.map((language) => {
          const isActive = language.code === currentLanguage.code;
          const isDisabled = requiresConsent && language.code !== "en";
          return (
            <button
              key={language.code}
              type="button"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-primary/20 text-primary font-semibold"
                  : "hover:bg-primary-light/5 text-text"
              } ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
              onClick={() => handleLanguageChange(language.code)}
              disabled={isDisabled}
            >
              {language.flag && (
                <span className="text-lg" aria-hidden="true">
                  {language.flag}
                </span>
              )}
              <span className="flex-1 text-left">
                <span className="block text-base leading-tight">
                  {language.nativeName}
                </span>
                <span className="text-xs text-text/70">
                  {language.name}
                </span>
              </span>
              {isActive && (
                <span className="text-primary" aria-label="Currently selected language">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
