// Shared button group control for segmented options

import { useId } from "react";
import Button from "@/components/Button/Button";

interface ButtonGroupOption {
  value: string;
  label: string;
}

interface ButtonGroupControlProps {
  label: string;
  description?: string;
  value: string;
  options: ButtonGroupOption[];
  onChange: (value: string) => void;
}

export default function ButtonGroupControl({
  label,
  description,
  value,
  options,
  onChange,
}: ButtonGroupControlProps) {
  const labelId = useId();

  return (
    <div className="mb-6" role="group" aria-labelledby={labelId}>
      <label id={labelId} className="block font-semibold text-heading mb-2">
        {label}
      </label>
      {description && <p className="text-sm text-text mb-3">{description}</p>}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              variant={isSelected ? "primary" : "secondary"}
              aria-pressed={isSelected}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
