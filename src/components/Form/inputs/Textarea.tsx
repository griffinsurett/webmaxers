// src/components/Form/inputs/Textarea.tsx
import { type ReactNode, type TextareaHTMLAttributes } from "react";
import Field, { useField } from "./Field";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  name: string;
  label?: string;
  containerClassName?: string;
  labelClassName?: string;
  textareaClassName?: string;
  hint?: ReactNode;
  error?: ReactNode;
  floating?: boolean;
  describedBy?: string;
}

export default function Textarea({
  name,
  label,
  required = false,
  containerClassName = "space-y-2",
  labelClassName,
  textareaClassName = "",
  hint,
  error,
  floating = true,
  describedBy,
  rows = 5,
  id: idProp,
  defaultValue,
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  ...textareaProps
}: TextareaProps) {
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
      <textarea
        {...a11y.controlProps}
        name={name}
        rows={rows}
        required={required}
        value={value}
        defaultValue={defaultValue}
        placeholder={
          floating && label
            ? (placeholder ?? `${label}${required ? " *" : ""}`)
            : placeholder
        }
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`peer form-field resize-none ${error ? "form-field-error" : ""} ${textareaClassName}`.trim()}
        {...textareaProps}
      />
    </Field>
  );
}
