// Shared slider control for numeric preferences

import { useCallback, useId, useState } from "react";
import AnimatedBorder from "@/components/AnimatedBorder/AnimatedBorder";

interface SliderControlProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
  id?: string;
}

export default function SliderControl({
  label,
  description,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
  id,
}: SliderControlProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const [engaged, setEngaged] = useState(false);

  const handleFocus = useCallback(() => setEngaged(true), []);
  const handleBlur = useCallback(() => setEngaged(false), []);
  const handlePointerUp = useCallback(() => setEngaged(false), []);

  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-2">
        <label className="font-semibold text-heading" htmlFor={controlId}>
          {label}
        </label>
        <span className="text-sm font-mono text-text">
          {value}
          {suffix}
        </span>
      </div>
      {description && (
        <p id={descriptionId} className="text-sm text-text mb-3">
          {description}
        </p>
      )}
      <AnimatedBorder
        variant="solid"
        triggers="controlled"
        active={engaged}
        duration={900}
        borderWidth={2}
        borderRadius="rounded-xl"
        color="var(--color-accent)"
        className="block"
        innerClassName="!bg-transparent !border-transparent rounded-xl"
      >
        <div className="rounded-xl border border-soft-strong px-4 py-3 bg-transparent">
          <input
            id={controlId}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-describedby={descriptionId}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onMouseDown={handleFocus}
            onMouseUp={handlePointerUp}
            onTouchStart={handleFocus}
            onTouchEnd={handlePointerUp}
            className="w-full h-2 bg-text/20 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </AnimatedBorder>
      <div className="flex justify-between text-xs text-text mt-2">
        <span>
          {min}
          {suffix}
        </span>
        <span>
          {max}
          {suffix}
        </span>
      </div>
    </div>
  );
}
