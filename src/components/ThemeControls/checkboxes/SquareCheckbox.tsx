import type { InputHTMLAttributes } from "react";

interface SquareCheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  color: string;
}

/** A color swatch checkbox used by the accent picker. */
export function SquareCheckbox({
  color,
  checked,
  onChange,
  ...props
}: SquareCheckboxProps) {
  return (
    <label className="inline-flex shrink-0 cursor-pointer leading-none align-middle">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={onChange}
        {...props}
      />
      <span
        className="block aspect-square w-7 sm:w-8 rounded-[3px] border-2 border-transparent transition-colors peer-checked:border-heading peer-checked:shadow-lg"
        style={{ backgroundColor: color }}
      />
    </label>
  );
}
