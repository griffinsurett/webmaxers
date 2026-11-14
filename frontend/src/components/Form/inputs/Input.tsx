// src/components/Form/inputs/Input.tsx
import {
  type HTMLInputTypeAttribute,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import Field, { useField } from "./Field";

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  name: string;
  label?: string;
  type?: HTMLInputTypeAttribute;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  /** Persistent helper text, linked via aria-describedby. */
  hint?: ReactNode;
  /** Error text; presence sets aria-invalid + links via aria-describedby. */
  error?: ReactNode;
  /** Floating-label look (keeps the compact placeholder appearance). */
  floating?: boolean;
  describedBy?: string;
}

export default function Input({
  name,
  label,
  required = false,
  containerClassName = "space-y-2",
  labelClassName,
  inputClassName = "",
  hint,
  error,
  floating = true,
  describedBy,
  id: idProp,
  defaultValue,
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  ...inputProps
}: InputProps) {
  const a11y = useField({ name, idProp, required, hint, error, describedBy });

  return (
    <Field
      a11y={a11y}
      label={label}
      required={required}
      hint={hint}
      error={error}
      floating={floating}
      containerClassName={containerClassName}
      labelClassName={labelClassName}
    >
      <input
        {...a11y.controlProps}
        name={name}
        required={required}
        value={value}
        defaultValue={defaultValue}
        // In placeholder mode the label is visually hidden, so the label text
        // (plus a "*" for required) becomes the placeholder — it disappears as
        // soon as the user types. An explicit `placeholder` still wins.
        placeholder={
          floating && label
            ? (placeholder ?? `${label}${required ? " *" : ""}`)
            : placeholder
        }
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`peer form-field ${error ? "form-field-error" : ""} ${inputClassName}`.trim()}
        {...inputProps}
      />
    </Field>
  );
}
