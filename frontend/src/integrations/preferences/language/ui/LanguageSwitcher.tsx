// src/integrations/preferences/ui/language/components/LanguageSwitcher.tsx
/**
 * Language Switcher Component (Default UI)
 *
 * Full-featured language dropdown with consent checking.
 * Uses the useLanguageSwitcher hook from core for all functionality.
 *
 * For custom designs, import the hook directly:
 * import { useLanguageSwitcher } from '@/integrations/preferences/language/core/hooks/useLanguageSwitcher';
 */

import { useState, useRef, useEffect } from "react";
import { useLanguageSwitcher } from "@/integrations/preferences/language/core/hooks/useLanguageSwitcher";
import LanguageDropdown from "./LanguageDropdown";
import "@/integrations/preferences/language/styles/language-switcher.css";

export default function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    currentLanguage,
    hasFunctionalConsent,
  } = useLanguageSwitcher();

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-flex flex-col gap-1 w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={[
          "w-full bg-bg text-text rounded-xl border border-text/10 px-4 py-2",
          "flex items-center justify-between gap-3 text-sm transition-all",
          "hover:border-primary/40 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        ].join(" ")}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Choose language"
        title={
          hasFunctionalConsent
            ? "Choose language"
            : "Enable functional cookies to change language"
        }
      >
        <div className="flex items-center gap-3 text-left">
          {currentLanguage.flag && (
            <span className="text-xl leading-none notranslate" aria-hidden="true">
              {currentLanguage.flag}
            </span>
          )}
          <div className="flex flex-col text-left leading-tight">
            <span className="text-base font-semibold notranslate">
              {currentLanguage.nativeName}
            </span>
            <span className="text-xs text-text/70 notranslate">
              {currentLanguage.name}
            </span>
          </div>
        </div>

        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <LanguageDropdown
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onLanguageChange={() => {}}
        className="left-0 w-full"
      />
    </div>
  );
}
