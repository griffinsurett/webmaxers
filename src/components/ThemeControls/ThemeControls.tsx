import { useEffect, useRef, useState } from "react";
import { SquareCheckbox } from "./checkboxes/SquareCheckbox";
import Icon from "@/components/Icon";
import { UseMode } from "@/hooks/theme/UseMode";
import { useAccessibility } from "@/integrations/preferences/accessibility/core/hooks/useAccessibility";
import { useAccentColor } from "@/hooks/useAccentColor";

interface ThemeControlsProps {
  className?: string;
}

/**
 * Theme/motion preferences.
 *  • sm+ : the inline toggle pills (reduced motion + dark/light).
 *  • <sm : collapses to a gear icon that opens a popup menu with the same
 *          preferences as rows (mirrors griffinswebservices' gear → popup).
 */
function PreferenceRow({
  label,
  value,
  onClick,
  leading,
}: {
  label: string;
  value: string;
  onClick: () => void;
  leading: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-text transition-colors hover:bg-primary/8"
    >
      <span className="flex items-center gap-3">
        <span className="faded-bg inline-flex h-9 w-9 items-center justify-center rounded-full text-heading">
          {leading}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </span>
      <span className="text-sm text-text/75">{value}</span>
    </button>
  );
}

export default function ThemeControls({ className = "" }: ThemeControlsProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [isLight, setIsLight] = UseMode();
  const { preferences, setPreferences } = useAccessibility();
  const reduced = preferences.content.reducedMotion;
  const { accent, setAccent, accents } = useAccentColor();

  const close = () => setOpen(false);

  // Dismiss the popup on outside-click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      close();
    };
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className={[
        "relative flex h-8 shrink-0 items-center justify-center sm:h-10 z-[999999]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* A single gear button (all screen sizes) that opens the preferences
          popup — no inline toggle pills. */}
      <button
        type="button"
        className="faded-bg inline-flex h-8 w-8 items-center justify-center rounded-full text-heading transition-all sm:h-9 sm:w-9"
        aria-label="Open preferences"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon icon="lu:settings" size="sm" className="h-4 w-4 text-current" />
      </button>

      {/* Preferences popup menu (all screen sizes). */}
      {open && (
        <div
          className="absolute right-0 top-full z-10 mt-3 w-[min(16rem,calc(100vw-1.5rem))] rounded-2xl card-bg-2 p-3 shadow-2xl"
          onPointerDown={(e) => e.stopPropagation()}
          role="menu"
          aria-label="Preferences"
        >
          <div className="flex flex-col gap-1">
            <PreferenceRow
              label="Theme"
              value={isLight ? "Light" : "Dark"}
              onClick={() => setIsLight(!isLight)}
              leading={
                <Icon
                  icon={isLight ? "fa6:sun" : "fa6:moon"}
                  size="md"
                  color="currentColor"
                />
              }
            />
            <PreferenceRow
              label="Reduce motion"
              value={reduced ? "On" : "Off"}
              onClick={() =>
                setPreferences({
                  ...preferences,
                  content: { ...preferences.content, reducedMotion: !reduced },
                })
              }
              leading={<Icon icon="fa6:wand-magic-sparkles" size="md" color="currentColor" />}
            />

            {/* Accent color swatches */}
            <div className="mt-1 px-3 pb-1 pt-2">
              <span className="mb-2 block text-sm font-medium text-text">Accent</span>
              <div className="grid grid-cols-5 gap-2.5">
                {accents.map((color) => (
                  <SquareCheckbox
                    key={color}
                    color={color}
                    checked={accent === color}
                    onChange={() => setAccent(color)}
                    aria-label={`Select accent color ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
