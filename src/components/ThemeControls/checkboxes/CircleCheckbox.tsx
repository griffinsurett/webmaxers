import type { InputHTMLAttributes, ReactNode } from "react";

interface CircleCheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  className?: string;
  children?: ReactNode;
}

export function CircleCheckbox({
  checked,
  className = "circle-box",
  children,
  ...props
}: CircleCheckboxProps) {
  return (
    <label className="inline-flex items-center cursor-pointer circle-checkbox">
      <input
        type="checkbox"
        checked={checked}
        className="sr-only peer circle-checkbox-input"
        {...props}
      />
      <span
        className={`${className} h-8 w-8 sm:h-9 sm:w-9 rounded-full transition-all flex items-center justify-center relative shrink-0 circle-checkbox-visual`}
      >
        {children}
      </span>
    </label>
  );
}
