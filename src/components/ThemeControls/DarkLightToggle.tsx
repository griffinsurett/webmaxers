import { UseMode } from "@/hooks/theme/UseMode";
import { CircleCheckbox } from "./checkboxes/CircleCheckbox";
import Icon from "@/components/Icon";
import "./DarkLightToggle.css";

interface DarkLightToggleProps {
  gradientId: string;
  onApplied?: () => void;
}

export default function DarkLightToggle({ gradientId, onApplied }: DarkLightToggleProps) {
  const [isLight, setIsLight] = UseMode();

  return (
    <div className="flex h-8 sm:h-9 shrink-0 items-center">
      <CircleCheckbox
        checked={isLight}
        onChange={(event) => {
          setIsLight(event.target.checked);
          onApplied?.();
        }}
        aria-label="Toggle light mode"
        className="faded-bg"
      >
        <div className="theme-toggle-icon theme-toggle-icon--moon" aria-hidden="true">
          <Icon icon="fa6:moon" size="md" color={`url(#${gradientId})`} />
        </div>
        <div className="theme-toggle-icon theme-toggle-icon--sun" aria-hidden="true">
          <Icon icon="fa6:sun" size="sm" color={`url(#${gradientId})`} />
        </div>
      </CircleCheckbox>
    </div>
  );
}
