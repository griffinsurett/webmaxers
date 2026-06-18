import { useAccessibility } from "@/integrations/preferences/accessibility/core/hooks/useAccessibility";
import { CircleCheckbox } from "./checkboxes/CircleCheckbox";
import Icon from "@/components/Icon";

interface ReducedMotionToggleProps {
  gradientId: string;
  onApplied?: () => void;
}

/**
 * Reduced-motion toggle — same circle-button shape as DarkLightToggle, using the
 * magic-wand icon. Flips the existing accessibility `content.reducedMotion`
 * preference (the same one the accessibility modal sets), so it persists and
 * drives `data-a11y-motion` across the app.
 */
export default function ReducedMotionToggle({ gradientId, onApplied }: ReducedMotionToggleProps) {
  const { preferences, setPreferences } = useAccessibility();
  const reduced = preferences.content.reducedMotion;

  return (
    <div className="flex h-8 sm:h-9 shrink-0 items-center">
      <CircleCheckbox
        checked={reduced}
        onChange={(event) => {
          setPreferences({
            ...preferences,
            content: { ...preferences.content, reducedMotion: event.target.checked },
          });
          onApplied?.();
        }}
        aria-label="Toggle reduced motion"
        className="faded-bg"
      >
        <span className="block leading-none" aria-hidden="true">
          <Icon icon="fa6:wand-magic-sparkles" size="sm" color={`url(#${gradientId})`} />
        </span>
      </CircleCheckbox>
    </div>
  );
}
