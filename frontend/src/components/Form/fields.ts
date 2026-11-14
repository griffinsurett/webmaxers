// src/components/Form/fields.ts
/**
 * Declarative field config shared by FormWrapper and the form definitions.
 *
 * Forms describe their fields as data; FormWrapper renders + validates them in a
 * single React island so it can own per-field errors, aria-invalid/describedby,
 * and focus-the-first-invalid behaviour (WCAG 3.3.1 / 3.3.3 / 4.1.2).
 */
import type { ReactNode } from "react";

export type FieldType = "text" | "email" | "tel" | "textarea" | "select";

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  /** HTML autocomplete token (WCAG 1.3.5). */
  autoComplete?: string;
  minLength?: number;
  /** Regex source for pattern validation. */
  pattern?: string;
  /** Persistent helper text shown under the field. */
  hint?: ReactNode;
  /** Custom "invalid" message; falls back to a sensible default per constraint. */
  errorMessage?: string;
  rows?: number;
  options?: SelectOption[];
  placeholder?: string;
  /** Grid span helper, mirrors the old containerClassName usage. */
  colSpan?: 1 | 2;
}

/** Validate one value against a field's constraints. Returns an error string or null. */
export function validateField(
  field: FieldConfig,
  rawValue: FormDataEntryValue | null
): string | null {
  const value = typeof rawValue === "string" ? rawValue.trim() : "";

  if (field.required && value === "") {
    return field.errorMessage ?? `${field.label} is required.`;
  }
  if (value === "") return null; // optional + empty → valid

  if (field.type === "email") {
    // Simple, permissive email shape check.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return (
        field.errorMessage ??
        "Enter a valid email address, e.g. name@example.com."
      );
    }
  }
  if (field.minLength && value.length < field.minLength) {
    return (
      field.errorMessage ??
      `${field.label} must be at least ${field.minLength} characters.`
    );
  }
  if (field.pattern && !new RegExp(`^(?:${field.pattern})$`).test(value)) {
    return field.errorMessage ?? `Enter a valid ${field.label.toLowerCase()}.`;
  }
  return null;
}