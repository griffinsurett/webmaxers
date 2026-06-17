// src/integrations/preferences/ui/accessibility/components/AccessibilityModal.tsx
/**
 * Accessibility Modal (Default UI)
 *
 * Full accessibility preferences panel. For custom UI, use the
 * useAccessibility hook from core directly.
 */
import { memo, useCallback, useState, type ReactNode } from "react";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import { useAccessibility } from "@/integrations/preferences/accessibility/core/hooks/useAccessibility";
import type { A11yPreferences } from "@/integrations/preferences/accessibility/core/types";
import LanguageSwitcher from "@/integrations/preferences/language/ui/LanguageSwitcher";
import { siteData } from "@/content/siteData";

interface AccessibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type IconName = string;

function AccessibilityModal({ isOpen, onClose }: AccessibilityModalProps) {
  const { preferences, setPreferences, resetPreferences } = useAccessibility();
  const [hoveredAction, setHoveredAction] = useState<"reset" | "close" | null>(null);

  const updateText = useCallback(
    <K extends keyof A11yPreferences["text"]>(
      key: K,
      value: A11yPreferences["text"][K]
    ) => {
      setPreferences((prev) => ({
        ...prev,
        text: { ...prev.text, [key]: value },
        timestamp: Date.now(),
        version: "1.0",
      }));
    },
    [setPreferences]
  );

  const updateVisual = useCallback(
    <K extends keyof A11yPreferences["visual"]>(
      key: K,
      value: A11yPreferences["visual"][K]
    ) => {
      setPreferences((prev) => ({
        ...prev,
        visual: { ...prev.visual, [key]: value },
        timestamp: Date.now(),
        version: "1.0",
      }));
    },
    [setPreferences]
  );

  const updateReading = useCallback(
    <K extends keyof A11yPreferences["reading"]>(
      key: K,
      value: A11yPreferences["reading"][K]
    ) => {
      setPreferences((prev) => ({
        ...prev,
        reading: { ...prev.reading, [key]: value },
        timestamp: Date.now(),
        version: "1.0",
      }));
    },
    [setPreferences]
  );

  const updateContent = useCallback(
    <K extends keyof A11yPreferences["content"]>(
      key: K,
      value: A11yPreferences["content"][K]
    ) => {
      setPreferences((prev) => ({
        ...prev,
        content: { ...prev.content, [key]: value },
        timestamp: Date.now(),
        version: "1.0",
      }));
    },
    [setPreferences]
  );

  const textSliderTiles = [
    {
      key: "fontSize",
      icon: "fa6:universal-access",
      label: "Bigger text",
      description: "Scale all copy for better legibility",
      min: 100,
      max: 200,
      step: 10,
      value: preferences.text.fontSize,
      formatValue: (value: number) => `${value}%`,
      onChange: (val: number) => updateText("fontSize", val),
    },
    {
      key: "lineHeight",
      icon: "fa6:arrows-up-down-left-right",
      label: "Line height",
      description: "Add breathing room between lines",
      min: 1.5,
      max: 2.5,
      step: 0.1,
      value: preferences.text.lineHeight,
      formatValue: (value: number) => value.toFixed(1),
      onChange: (val: number) => updateText("lineHeight", val),
    },
    {
      key: "letterSpacing",
      icon: "fa6:feather",
      label: "Letter spacing",
      description: "Prevent characters from crowding",
      min: 0,
      max: 0.3,
      step: 0.05,
      value: preferences.text.letterSpacing,
      formatValue: (value: number) => `${value.toFixed(2)}em`,
      onChange: (val: number) => updateText("letterSpacing", val),
    },
    {
      key: "wordSpacing",
      icon: "fa6:compass",
      label: "Word spacing",
      description: "Give each word clear separation",
      min: 0,
      max: 0.5,
      step: 0.1,
      value: preferences.text.wordSpacing,
      formatValue: (value: number) => `${value.toFixed(1)}em`,
      onChange: (val: number) => updateText("wordSpacing", val),
    },
  ] as const;

  const visualToggleTiles = [
    {
      key: "linkHighlight",
      icon: "fa6:link",
      label: "Highlight links",
      description: "Add background to every link",
      active: preferences.visual.linkHighlight,
      onToggle: () => updateVisual("linkHighlight", !preferences.visual.linkHighlight),
    },
    {
      key: "titleHighlight",
      icon: "fa6:layer-group",
      label: "Headline focus",
      description: "Accent headings with a pill",
      active: preferences.visual.titleHighlight,
      onToggle: () => updateVisual("titleHighlight", !preferences.visual.titleHighlight),
    },
    {
      key: "contrastBoost",
      icon: "fa6:shield-halved",
      label: "Boost contrast",
      description: "Darken text and light backgrounds",
      active: preferences.visual.contrastBoost,
      onToggle: () => updateVisual("contrastBoost", !preferences.visual.contrastBoost),
    },
  ] as const;

  const readingToggleTiles = [
    {
      key: "readingGuide",
      icon: "fa6:life-ring",
      label: "Reading guide",
      description: "Follow text with a subtle line",
      active: preferences.reading.readingGuide,
      onToggle: () => updateReading("readingGuide", !preferences.reading.readingGuide),
    },
    {
      key: "readingMask",
      icon: "fa6:eye",
      label: "Reading mask",
      description: "Dim everything except the focus area",
      active: preferences.reading.readingMask,
      onToggle: () => updateReading("readingMask", !preferences.reading.readingMask),
    },
    {
      key: "focusHighlight",
      icon: "fa6:bullseye",
      label: "Focus outline",
      description: "Thick border for tab focus",
      active: preferences.reading.focusHighlight,
      onToggle: () => updateReading("focusHighlight", !preferences.reading.focusHighlight),
    },
    {
      key: "bigCursor",
      icon: "fa6:robot",
      label: "Big cursor",
      description: "Increase pointer visibility",
      active: preferences.reading.bigCursor,
      onToggle: () => updateReading("bigCursor", !preferences.reading.bigCursor),
    },
    {
      key: "pauseAnimations",
      icon: "fa6:clock-rotate-left",
      label: "Pause motion",
      description: "Stop autoplay and animations",
      active: preferences.reading.pauseAnimations,
      onToggle: () => updateReading("pauseAnimations", !preferences.reading.pauseAnimations),
    },
  ] as const;

  const contentToggleTiles = [
    {
      key: "hideImages",
      icon: "lu:image",
      label: "Hide images",
      description: "Replace visuals with alt text",
      active: preferences.content.hideImages,
      onToggle: () => updateContent("hideImages", !preferences.content.hideImages),
    },
    {
      key: "muteSounds",
      icon: "fa6:headset",
      label: "Mute sounds",
      description: "Silence audio & video elements",
      active: preferences.content.muteSounds,
      onToggle: () => updateContent("muteSounds", !preferences.content.muteSounds),
    },
    {
      key: "reducedMotion",
      icon: "fa6:wand-magic-sparkles",
      label: "Reduce motion",
      description: "Shorter transitions and fades",
      active: preferences.content.reducedMotion,
      onToggle: () => updateContent("reducedMotion", !preferences.content.reducedMotion),
    },
  ] as const;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeButton={false}
      allowScroll={true}
      ariaLabel="Accessibility preferences"
      position="bottom-right"
      overlayClass="bg-transparent"
      className="p-0 max-w-[420px] w-full"
      ssr={false}
    >
      <div className="a11y-modal-shell">
        <div className="bg-primary px-6 py-4 text-bg flex-shrink-0">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="shrink-0">
                  <Icon icon="fa6:universal-access" size="lg" className="text-bg" />
                </span>
                <div>
                  <h2 className="text-xl font-bold leading-snug">Accessibility</h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onMouseEnter={() => setHoveredAction("reset")}
                  onMouseLeave={() => setHoveredAction(null)}
                  onFocus={() => setHoveredAction("reset")}
                  onBlur={() => setHoveredAction(null)}
                  onClick={resetPreferences}
                  className="a11y-header-action relative"
                  aria-label="Reset preferences"
                >
                  <Icon icon="fa6:rotate-left" size="sm" className="text-bg" />
                  <span
                    className={`absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-bg text-text small-text tracking-wide px-2 py-1 shadow-md transition-opacity ${
                      hoveredAction === "reset" ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    Reset
                  </span>
                </button>
                <button
                  type="button"
                  onMouseEnter={() => setHoveredAction("close")}
                  onMouseLeave={() => setHoveredAction(null)}
                  onFocus={() => setHoveredAction("close")}
                  onBlur={() => setHoveredAction(null)}
                  onClick={onClose}
                  aria-label="Close accessibility menu"
                  className="a11y-header-action relative"
                >
                  <Icon icon="fa6:xmark" size="md" className="text-bg" />
                  <span
                    className={`absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-bg text-text small-text tracking-wide px-2 py-1 shadow-md transition-opacity ${
                      hoveredAction === "close" ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    Close
                  </span>
                </button>
              </div>
            </div>
            <p className="text-sm text-bg/80 max-w-sm">
              Fine-tune how {siteData.title} displays information.
            </p>
          </div>
        </div>

        <div className="a11y-scroll-region w-full mx-auto">
          <div className="a11y-card a11y-card--spacious">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text/70">
              Language
            </p>
            <div className="mt-3">
              <LanguageSwitcher />
            </div>
          </div>

          <SectionBlock
            title="Text"
            description="Adjust typography for clarity and pace."
          >
            <div className="space-y-3">
              {textSliderTiles.map((tile) => (
                <SliderTile key={tile.key} {...tile} />
              ))}
            </div>
            <div className="space-y-3 pt-2">
              <SegmentedTile
                icon="fa6:palette"
                label="Readable fonts"
                description="Choose the type styles that work best."
                value={preferences.text.fontFamily}
                options={[
                  { value: "default", label: "Default" },
                  { value: "readable", label: "Readable" },
                  { value: "dyslexia", label: "Dyslexia" },
                ]}
                onChange={(val) =>
                  updateText("fontFamily", val as A11yPreferences["text"]["fontFamily"])
                }
              />
              <SegmentedTile
                icon="fa6:scale-balanced"
                label="Font weight"
                description="Balance thickness and emphasis."
                value={preferences.text.fontWeight}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "semibold", label: "Medium" },
                  { value: "bold", label: "Bold" },
                ]}
                onChange={(val) =>
                  updateText("fontWeight", val as A11yPreferences["text"]["fontWeight"])
                }
              />
              <SegmentedTile
                icon="fa6:file-lines"
                label="Text alignment"
                description="Keep lines left or fully justified."
                value={preferences.text.textAlign}
                options={[
                  { value: "left", label: "Left" },
                  { value: "justify", label: "Justify" },
                ]}
                onChange={(val) =>
                  updateText("textAlign", val as A11yPreferences["text"]["textAlign"])
                }
              />
            </div>
          </SectionBlock>

          <SectionBlock
            title="Visual"
            description="Elevate color, contrast, and highlights."
          >
            <div className="grid grid-cols-1 gap-3">
              <SegmentedTile
                icon="fa6:palette"
                label="Color mode"
                description="Pick a saturation style."
                value={preferences.visual.saturation}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "low", label: "Low" },
                  { value: "high", label: "High" },
                  { value: "monochrome", label: "Gray" },
                ]}
                onChange={(val) =>
                  updateVisual("saturation", val as A11yPreferences["visual"]["saturation"])
                }
              />
            </div>
            <div className="grid grid-cols-1 gap-3">
              {visualToggleTiles.map((tile) => (
                <ToggleTile key={tile.key} {...tile} />
              ))}
            </div>
          </SectionBlock>

          <SectionBlock
            title="Reading aids"
            description="Guide focus and reduce overload."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {readingToggleTiles.map((tile) => (
                <ToggleTile key={tile.key} {...tile} />
              ))}
            </div>
          </SectionBlock>

          <SectionBlock
            title="Content filters"
            description="Simplify visuals and motion-heavy elements."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contentToggleTiles.map((tile) => (
                <ToggleTile key={tile.key} {...tile} />
              ))}
            </div>
          </SectionBlock>

          <div className="rounded-2xl border border-dashed border-surface/70 bg-surface/40 p-4 text-xs text-text/70">
            Preferences save instantly in your browser and sync across tabs.
            These adjustments change visual presentation only&mdash;assistive
            technologies continue working as expected.
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface SectionBlockProps {
  title: string;
  description?: string;
  children: ReactNode;
}

function SectionBlock({ title, description, children }: SectionBlockProps) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-heading">{title}</p>
        {description && (
          <p className="text-xs text-text/70">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

interface SliderTileProps {
  icon: IconName;
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
}

function SliderTile({
  icon,
  label,
  description,
  value,
  min,
  max,
  step = 1,
  formatValue,
  onChange,
}: SliderTileProps) {
  const valueLabel = formatValue ? formatValue(value) : `${value}`;

  return (
    <div className="a11y-card a11y-card--compact">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconBadge icon={icon} size="md" />
          <div>
            <p className="text-sm font-semibold text-heading">{label}</p>
            {description && (
              <p className="text-xs text-text/70">{description}</p>
            )}
          </div>
        </div>
        <span className="text-sm font-semibold text-heading">{valueLabel}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="a11y-slider"
        aria-label={label}
      />
    </div>
  );
}

interface ToggleTileProps {
  icon: IconName;
  label: string;
  description?: string;
  active: boolean;
  onToggle: () => void;
}

function ToggleTile({ icon, label, description, active, onToggle }: ToggleTileProps) {
  const buttonClasses = [
    "a11y-toggle",
    active ? "a11y-toggle--active" : "a11y-toggle--idle",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={onToggle}
      className={buttonClasses}
    >
      <div className="flex items-center gap-3">
        <IconBadge icon={icon} active={active} />
        <div>
          <p className="text-sm font-semibold text-heading">{label}</p>
          {description && (
            <p className="text-xs text-text/70">{description}</p>
          )}
        </div>
      </div>
    </button>
  );
}

interface SegmentedTileProps {
  icon: IconName;
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string; icon?: IconName }[];
  onChange: (value: string) => void;
}

function SegmentedTile({
  icon,
  label,
  description,
  value,
  options,
  onChange,
}: SegmentedTileProps) {
  return (
    <div className="a11y-card a11y-card--compact">
      <div className="flex items-center gap-3">
        <IconBadge icon={icon} size="md" />
        <div>
          <p className="text-sm font-semibold text-heading">{label}</p>
          {description && (
            <p className="text-xs text-text/70">{description}</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border border-text/10 bg-surface text-text hover:border-primary/40"
              }`}
            >
              {option.icon && (
                <Icon icon={option.icon} size="sm" className="text-current" />
              )}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface IconBadgeProps {
  icon: IconName;
  active?: boolean;
  size?: "sm" | "md" | "lg";
}

function IconBadge({ icon, active = false, size = "sm" }: IconBadgeProps) {
  const sizeClasses: Record<NonNullable<IconBadgeProps["size"]>, string> = {
    sm: "icon-small",
    md: "icon-medium",
    lg: "icon-large",
  };
  const badgeIconSizes = {
    sm: "sm",
    md: "md",
    lg: "lg",
  } as const;

  const wrapperClasses = [
    "inline-flex items-center justify-center rounded-2xl transition-all",
    sizeClasses[size],
    active
      ? "border border-primary/20 bg-primary/10 text-primary"
      : "border border-text/10 bg-surface text-primary",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={wrapperClasses}>
      <Icon icon={icon} size={badgeIconSizes[size]} className="text-current" />
    </span>
  );
}

export default memo(AccessibilityModal);
