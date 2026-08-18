// src/components/Form/inputs/Field.tsx
/**
 * Field — the accessible foundation every form control is built on.
 *
 * Owns the label ↔ control ↔ error/hint relationships so WCAG 2.2 AA holds for
 * free at every call site:
 *   - a real <label for={id}> always exists. In `floating` (placeholder) mode
 *     it is visually hidden and the same text is shown as the control's native
 *     placeholder, so it just disappears on typing — the accessible name is
 *     never lost, it is only the visual copy that the placeholder provides.
 *   - required marked with aria-required AND a text-labelled "*" (not colour
 *     alone) — 1.4.1 / 3.3.2.
 *   - hint + error text linked to the control via aria-describedby, and
 *     aria-invalid toggled on error — 3.3.1 / 3.3.3 / 4.1.2.
 *
 * Controls (Input/Textarea/Select) call `useField()` to get the wired ids and
 * ARIA props, then render themselves inside <Field>.
 */
import { useId, type ReactNode } from "react";

export interface FieldA11y {
  /** id for the control (label's htmlFor points here). */
  id: string;
  /** Props to spread onto the <input>/<textarea>/<select>. */
  controlProps: {
    id: string;
    "aria-required"?: true;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  };
  hintId?: string;
  errorId?: string;
}

/**
 * Compute the ids + ARIA wiring for a control. Call from Input/Textarea/Select.
 */
export function useField(opts: {
  name: string;
  idProp?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  describedBy?: string;
}): FieldA11y {
  const reactId = useId();
  const id = opts.idProp ?? `${opts.name}-${reactId}`;
  const hintId = opts.hint ? `${id}-hint` : undefined;
  const errorId = opts.error ? `${id}-error` : undefined;

  const describedBy =
    [opts.describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;

  return {
    id,
    hintId,
    errorId,
    controlProps: {
      id,
      ...(opts.required ? { "aria-required": true as const } : {}),
      ...(opts.error ? { "aria-invalid": true as const } : {}),
      ...(describedBy ? { "aria-describedby": describedBy } : {}),
    },
  };
}

interface FieldProps {
  a11y: FieldA11y;
  label?: ReactNode;
  required?: boolean;
  /** Persistent helper text (format hints etc.). */
  hint?: ReactNode;
  /** Error text; presence flips the control to the invalid state. */
  error?: ReactNode;
  containerClassName?: string;
  labelClassName?: string;
  /**
   * Placeholder mode: the label is visually hidden and its text is shown as the
   * control's native placeholder. Default true.
   */
  floating?: boolean;
  children: ReactNode;
}

export default function Field({
  a11y,
  label,
  required = false,
  hint,
  error,
  containerClassName = "space-y-2",
  labelClassName,
  floating = true,
  children,
}: FieldProps) {
  const { id, hintId, errorId } = a11y;

  // Placeholder mode: the label text is shown via the control's native
  // `placeholder`, so it simply disappears as soon as the user types — no
  // floating or resizing. The <label for> is still rendered for assistive tech,
  // just visually hidden, so the field keeps its accessible name.
  if (floating && label) {
    return (
      <div className={`relative ${containerClassName === "space-y-2" ? "" : containerClassName}`.trim()}>
        <div className="relative">
          {children}
          <label htmlFor={id} className="sr-only">
            {label}
            {required && <span>{" (required)"}</span>}
          </label>
        </div>
        {hint && (
          <p id={hintId} className="mt-1 text-xs text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="mt-1 text-xs font-medium text-red-500">
            <span aria-hidden="true">⚠ </span>
            {error}
          </p>
        )}
      </div>
    );
  }

  // Stacked (non-floating) layout for controls that can't host a floating label.
  return (
    <div className={containerClassName}>
      {label && (
        <label
          htmlFor={id}
          className={labelClassName ?? "block text-sm text-text"}
        >
          {label}
          {required && (
            <span className="text-primary">
              {" *"}
              <span className="sr-only"> (required)</span>
            </span>
          )}
        </label>
      )}
      {children}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-red-500">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
    </div>
  );
}
