// Shared select control for preference pickers

import { useId, type ChangeEvent } from "react";
import SelectInput from "@/components/Form/inputs/Select";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectControlProps {
  label: string;
  description?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  id?: string;
}

export default function SelectControl({
  label,
  description,
  value,
  options,
  onChange,
  id,
}: SelectControlProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-col gap-1">
        <label
          className="block font-semibold text-heading"
          htmlFor={controlId}
          id={`${controlId}-label`}
        >
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-sm text-text">
            {description}
          </p>
        )}
      </div>

      <SelectInput
        id={controlId}
        name={controlId}
        label={label}
        showLabel={false}
        value={value}
        options={options}
        aria-describedby={descriptionId}
        placeholder=""
        onChange={handleChange}
      />
    </div>
  );
}
