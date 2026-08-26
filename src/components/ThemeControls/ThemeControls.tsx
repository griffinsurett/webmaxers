import { useEffect, useId, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { UseMode } from "@/hooks/theme/UseMode";
import { useAccentColor, type AccentColor } from "@/hooks/useAccentColor";
import { useAccessibility } from "@/integrations/preferences/accessibility/core/hooks/useAccessibility";
import { useLanguageSwitcher } from "@/integrations/preferences/language/core/hooks/useLanguageSwitcher";
import { SquareCheckbox } from "./checkboxes/SquareCheckbox";

interface ThemeControlsProps {
  className?: string;
}

type Panel = "root" | "language" | "accent";

/**
 * Theme / motion / language / accent preferences.
 *
 * A single gear button at ALL screen sizes opens a popup that holds every
 * preference as a row (mirrors webmaxers). No inline desktop pills — the gear
 * is the only entry point on desktop and mobile alike.
 */
function PreferenceRow({
  label,
  value,
  onClick,
  leading,
}: {
  label: string;
  value: React.ReactNode;
  onClick: () => void;
  leading: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-text transition-colors main-duration hover:bg-primary/8"
    >
      <span className="flex items-center gap-3">
        <span className="faded-bg inline-flex h-9 w-9 items-center justify-center rounded-full text-primary">
          {leading}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </span>
      <span className="text-sm text-text">{value}</span>
    </button>
  );
}

function ThemeGlyph({ isLight, gradientId }: { isLight: boolean; gradientId: string }) {
  return <Icon icon={isLight ? "fa6:sun" : "fa6:moon"} size="md" color={`url(#${gradientId})`} />;
}

export default function ThemeControls({ className = "" }: ThemeControlsProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("root");
  const [isLight, setIsLight] = UseMode();
  const { accent, setAccent, accents } = useAccentColor();
  const { preferences, setPreferences } = useAccessibility();
  const reduced = preferences.content.reducedMotion;
  const {
    currentLanguage,
    requiresConsent,
    supportedLanguages,
    changeLanguage,
    openConsentModal,
  } = useLanguageSwitcher();
  const iconGradientId = useId();
  const accentGradientId = useId();

  const close = () => {
    setOpen(false);
    setPanel("root");
  };

  const openMenu = () => {
    setPanel("root");
    setOpen(true);
  };

  // Dismiss the popup on outside-click / Escape.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      close();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const handleThemeToggle = () => {
    setIsLight(!isLight);
  };

  const handleReducedMotionToggle = () => {
    setPreferences({
      ...preferences,
      content: { ...preferences.content, reducedMotion: !reduced },
    });
  };

  const handleAccentSelect = (color: AccentColor) => {
    setAccent(color);
    close();
  };

  const handleLanguageSelect = (code: string) => {
    const result = changeLanguage(code);

    if (!result.success) {
      if (requiresConsent && code !== "en") {
        openConsentModal();
        close();
        return;
      }

      if (result.error) alert(result.error);
      return;
    }

    close();
  };

  return (
    <div
      ref={ref}
      className={[
        "relative flex h-9 shrink-0 items-center justify-center sm:h-10 z-999999",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <svg aria-hidden="true" width="0" height="0" focusable="false" className="pointer-events-none absolute h-0 w-0 overflow-hidden">
        <defs>
          <linearGradient id={iconGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" className="text-primary-100" />
            <stop offset="55%" stopColor="currentColor" className="text-primary" />
            <stop offset="100%" stopColor="currentColor" className="text-primary-800" />
          </linearGradient>
          <linearGradient id={accentGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" className="text-accent-100" />
            <stop offset="55%" stopColor="currentColor" className="text-accent" />
            <stop offset="100%" stopColor="currentColor" className="text-accent-800" />
          </linearGradient>
        </defs>
      </svg>

      {/* A single gear button (all screen sizes) that opens the preferences popup. */}
      <button
        type="button"
        className="faded-bg inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition-all main-duration sm:h-9 sm:w-9"
        aria-label="Open preferences"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => (open ? close() : openMenu())}
      >
        <Icon icon="lu:settings" size="sm" className="h-4 w-4 text-current" />
      </button>

      {/* Preferences popup (all screen sizes). */}
      {open && (
        <div
          /* Right-anchored on mobile, where the gear sits beside the hamburger at
             the row's edge — centering it there would push the panel off-screen.
             From sm the gear is centred in the header, so the panel centres too. */
          className="absolute right-0 top-full z-10 mt-4 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl card-bg-2 p-3 shadow-2xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          aria-label="Preferences"
        >
          {panel === "root" && (
            <div className="flex flex-col gap-1">
              <PreferenceRow
                label="Theme"
                onClick={handleThemeToggle}
                leading={<ThemeGlyph isLight={isLight} gradientId={iconGradientId} />}
                value={isLight ? "Light" : "Dark"}
              />
              <PreferenceRow
                label="Reduce motion"
                onClick={handleReducedMotionToggle}
                leading={<Icon icon="fa6:wand-magic-sparkles" size="md" color={`url(#${iconGradientId})`} />}
                value={reduced ? "On" : "Off"}
              />
              <PreferenceRow
                label="Language"
                onClick={() => setPanel("language")}
                leading={
                  currentLanguage.flag ? (
                    <span className="text-[20px] leading-none" aria-hidden="true">
                      {currentLanguage.flag}
                    </span>
                  ) : (
                    <Icon icon="lu:globe" size="md" className="text-current" />
                  )
                }
                value={
                  <span className="flex items-center gap-2">
                    {currentLanguage.flag && (
                      <span className="text-base leading-none" aria-hidden="true">
                        {currentLanguage.flag}
                      </span>
                    )}
                    <span>{currentLanguage.nativeName || currentLanguage.code.toUpperCase()}</span>
                  </span>
                }
              />
              <PreferenceRow
                label="Accent"
                onClick={() => setPanel("accent")}
                leading={<Icon icon="fa6:droplet" size="md" color={`url(#${accentGradientId})`} />}
                value={
                  <span
                    className="inline-flex h-4 w-4 rounded-full border border-white/15"
                    style={{ backgroundColor: accent }}
                    aria-hidden="true"
                  />
                }
              />
            </div>
          )}

          {panel === "language" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-2 py-1">
                <button
                  type="button"
                  onClick={() => setPanel("root")}
                  className="text-sm font-medium text-primary transition-opacity hover:opacity-75"
                >
                  Back
                </button>
                <span className="text-sm font-medium text-heading">Language</span>
                <span className="w-9" aria-hidden="true"></span>
              </div>

              {requiresConsent && (
                <button
                  type="button"
                  onClick={() => {
                    openConsentModal();
                    close();
                  }}
                  className="mx-1 rounded-2xl border border-yellow-400/35 bg-yellow-500/10 px-3 py-2 text-left text-xs text-text transition-colors hover:bg-yellow-500/15"
                >
                  Enable functional cookies to switch languages.
                  <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-primary">
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
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                        isActive
                          ? "bg-primary/15 text-primary font-semibold"
                          : "text-text hover:bg-primary/8"
                      } ${isDisabled ? "cursor-not-allowed opacity-55" : ""}`}
                      onClick={() => handleLanguageSelect(language.code)}
                      disabled={isDisabled}
                    >
                      <span className="text-xl leading-none" aria-hidden="true">
                        {language.flag || "🌐"}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm leading-tight">{language.nativeName}</span>
                        <span className="text-xs text-text">{language.name}</span>
                      </span>
                      {isActive && (
                        <span className="text-primary text-xs uppercase tracking-[0.16em]">
                          Active
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {panel === "accent" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-2 py-1">
                <button
                  type="button"
                  onClick={() => setPanel("root")}
                  className="text-sm font-medium text-primary transition-opacity hover:opacity-75"
                >
                  Back
                </button>
                <span className="text-sm font-medium text-heading">Accent</span>
                <span className="w-9" aria-hidden="true"></span>
              </div>

              <div className="grid grid-cols-4 gap-3 px-2 pt-1 pb-1">
                {accents.map((color) => (
                  <div key={color} className="flex items-center justify-center">
                    <SquareCheckbox
                      color={color}
                      checked={accent === color}
                      onChange={() => handleAccentSelect(color)}
                      aria-label={`Select accent color ${color}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
