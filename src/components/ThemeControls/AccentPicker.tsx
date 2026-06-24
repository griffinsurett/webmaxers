import { useEffect, useRef, useState } from "react";
import { CircleCheckbox } from "./checkboxes/CircleCheckbox";
import AccentPickerContent from "./AccentPickerContent";
import Icon from "@/components/Icon";

interface AccentPickerProps {
  gradientId: string;
  onApplied?: () => void;
}

/** Droplet button that opens the accent-color swatch popover (desktop). */
export default function AccentPicker({ gradientId, onApplied }: AccentPickerProps) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleToggle = () => {
    if (!hasOpened) setHasOpened(true);
    setOpen((v) => !v);
  };

  return (
    <div ref={containerRef} className="relative inline-flex h-9 shrink-0">
      <CircleCheckbox
        checked={open}
        onChange={handleToggle}
        aria-label="Pick accent color"
        className="faded-bg"
      >
        <Icon icon="fa6:droplet" size="sm" color={`url(#${gradientId})`} />
      </CircleCheckbox>

      {hasOpened && (
        <AccentPickerContent
          open={open}
          onClose={() => setOpen(false)}
          onApplied={onApplied}
        />
      )}
    </div>
  );
}
