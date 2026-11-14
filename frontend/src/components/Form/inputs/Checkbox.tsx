// src/components/Form/inputs/Checkbox.tsx
/**
 * Accessible checkbox — unique id (useId, no collisions), aria-required/invalid,
 * error text linked via aria-describedby, and a required marker that carries a
 * text alternative (not colour alone). HTML5 validation still applies.
 */
import { useId, type InputHTMLAttributes, type ReactNode } from "react";

interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  name: string;
  label?: ReactNode;
  children?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
  labelClassName?: string;
  checkboxClassName?: string;
  describedBy?: string;
}

export default function Checkbox({
  name,
  label,
  children,
  required = false,
  error,
  containerClassName = "mb-4",
  labelClassName = "flex items-start gap-1.5 cursor-pointer",
  checkboxClassName = "w-4 h-4 text-primary border-surface accent-accent rounded mt-0.5",
  describedBy,
  id: idProp,
  ...checkboxProps
}: CheckboxProps) {
  const reactId = useId();
  const id = idProp ?? `${name}-${reactId}`;
  const errorId = error ? `${id}-error` : undefined;
  const ariaDescribedBy =
    [describedBy, errorId].filter(Boolean).join(" ") || undefined;

  const labelContent = children ?? label;

  return (
    <div className={containerClassName}>
      <label htmlFor={id} className={labelClassName}>
        <input
          type="checkbox"
          id={id}
          name={name}
          className={checkboxClassName}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={ariaDescribedBy}
          {...checkboxProps}
        />
        {labelContent && (
          <span className="text-muted">
            {labelContent}
            {required && (
              <span className="text-primary">
                {" *"}
                <span className="sr-only"> (required)</span>
              </span>
            )}
          </span>
        )}
      </label>
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-red-500">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
    </div>
  );
}
