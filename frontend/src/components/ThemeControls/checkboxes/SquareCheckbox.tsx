import type { InputHTMLAttributes } from "react";

interface SquareCheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  color: string;
}

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
        className={[
          "block aspect-square w-7 sm:w-8 rounded-[2px] border-2 border-transparent transition-colors",
          "peer-checked:border-primary-light peer-checked:shadow-lg",
          // Visible keyboard-focus indicator (WCAG 2.4.7 / 1.4.11). The input is
          // sr-only, so the indicator lives on this swatch. An OFFSET outline
          // (outline + gap) reads against any accent fill AND the popover
          // background, which a single flush border can't guarantee per swatch.
          "peer-focus-visible:outline-2 peer-focus-visible:outline-primary peer-focus-visible:outline-offset-2",
        ].join(" ")}
        style={{ backgroundColor: color }}
      />
    </label>
  );
}
