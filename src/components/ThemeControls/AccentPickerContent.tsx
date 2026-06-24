import { useAccentColor } from "@/hooks/useAccentColor";
import { SquareCheckbox } from "./checkboxes/SquareCheckbox";

interface Props {
  open: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

/** The accent-swatch popover shown under the droplet button. */
export default function AccentPickerContent({ open, onClose, onApplied }: Props) {
  const { accent, setAccent, accents } = useAccentColor();

  if (!open) return null;

  return (
    <div className="absolute left-1/2 top-full z-50 mt-2 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center justify-center gap-2 overflow-x-auto rounded-2xl card-bg-2 p-3 shadow-2xl sm:left-0 sm:-translate-x-0">
      {accents.map((color) => (
        <SquareCheckbox
          key={color}
          color={color}
          checked={accent === color}
          onChange={() => {
            setAccent(color);
            onClose();
            onApplied?.();
          }}
          aria-label={`Select accent color ${color}`}
        />
      ))}
    </div>
  );
}
