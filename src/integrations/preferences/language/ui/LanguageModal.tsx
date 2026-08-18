// src/integrations/preferences/language/ui/LanguageModal.tsx
/**
 * Language Modal
 *
 * Full language picker in a modal, matching CookiePreferencesModal's shell so
 * the two footer controls feel like one family.
 *
 * Lists LANGUAGES, not regions: each row shows the language's native name with
 * its English name underneath. No flags — a flag is a country symbol, and the
 * same language is spoken in many countries.
 *
 * All switching logic (consent gating, native-vs-Google translation, storage
 * sync) comes from `useLanguageSwitcher`, the same hook the header's gear popup
 * uses, so both entry points stay in lockstep.
 */
import { memo } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button/Button";
import Icon from "@/components/Icon";
import { useLanguageSwitcher } from "../core/hooks/useLanguageSwitcher";

interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function LanguageModal({ isOpen, onClose }: LanguageModalProps) {
  const {
    currentLanguage,
    supportedLanguages,
    changeLanguage,
    requiresConsent,
    openConsentModal,
  } = useLanguageSwitcher();

  const handleSelect = (code: string) => {
    const result = changeLanguage(code);
    if (result.success) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Choose a language"
      className="bg-bg rounded-2xl p-8 max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col shadow-2xl"
    >
      <div className="mb-6 shrink-0">
        <h2 className="text-3xl text-heading mb-4">Choose a language</h2>
        <p className="text-text text-xs lg:text-sm leading-relaxed">
          Pages are translated automatically. You can switch back to English at
          any time.
        </p>
      </div>

      {/* Translation runs on a third-party service, so it needs functional
          cookies. Offer the consent modal rather than silently failing. */}
      {requiresConsent && (
        <div className="mb-4 shrink-0 rounded-xl border border-border p-4">
          <p className="text-sm text-text leading-relaxed mb-3">
            Translation needs functional cookies enabled.
          </p>
          <Button variant="secondary" size="sm" onClick={openConsentModal}>
            Open cookie settings
          </Button>
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <ul
          className="overflow-y-auto max-h-[45vh] pr-2 grid gap-2 sm:grid-cols-2 list-none m-0 p-0"
        >
          {supportedLanguages.map((language) => {
            const isCurrent = language.code === currentLanguage.code;
            return (
              <li key={language.code}>
                <button
                  type="button"
                  onClick={() => handleSelect(language.code)}
                  aria-current={isCurrent ? "true" : undefined}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left main-duration transition-all ${
                    isCurrent
                      ? "border-primary bg-primary/8"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {language.flag && (
                      <span className="text-xl leading-none" aria-hidden="true">
                        {language.flag}
                      </span>
                    )}
                    <span className="flex flex-col">
                      <span className="text-base text-heading" lang={language.code}>
                        {language.nativeName}
                      </span>
                      {language.nativeName !== language.name && (
                        <span className="text-xs text-muted">{language.name}</span>
                      )}
                    </span>
                  </span>

                  {isCurrent && (
                    <Icon
                      icon="lucide:check"
                      className="w-4 h-4 text-primary shrink-0"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}

export default memo(LanguageModal);
