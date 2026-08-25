// src/components/Button/variants/PillOutlineButton.tsx
/**
 * Pill Outline Button Variant
 *
 * A compact outlined pill — hairline border in the heading colour, transparent
 * fill, inverting to a solid heading-coloured chip on hover. Sized to sit inside
 * the header bar next to the logo lockup, so it sets its own tight padding
 * rather than inheriting the full-size `btn-*` scale.
 *
 * Leads with the Ask-AI sparkle in the brand accent by default — the same mark
 * the Ask-AI modal uses, imported rather than copied. Uses `--color-accent`
 * rather than `--color-primary`: light theme remaps primary to a dark neutral
 * for text contrast, which would render this decorative mark near-black, while
 * accent stays the brand blue in both themes. Pass an explicit `leftIcon` to
 * override it, or `leftIcon={null}` for a plain text pill.
 */

import { ButtonBase, type ButtonProps } from "../Button";
import { renderButtonIcon } from "../utils";
import { SparkleIcon } from "@/components/AskAi/AskAi";

export default function PillOutlineButton({
  leftIcon,
  rightIcon,
  className = "",
  ...props
}: ButtonProps) {
  // Default to the sparkle; `leftIcon={null}` opts out.
  const resolvedLeftIcon =
    leftIcon === undefined ? (
      <span className="text-accent">
        <SparkleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </span>
    ) : (
      leftIcon
    );

  const variantClasses = [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-full border border-0.5 border-heading bg-transparent text-heading",
    // Tight by design: this sits in the header bar, where the standard button
    // padding scale is too tall against the logo.
    "px-3.5 py-1 text-xs font-medium leading-none",
    "sm:px-4 sm:py-1.5 sm:text-sm",
    "transition-colors duration-200",
    "hover:bg-heading hover:text-bg",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heading/40",
  ].join(" ");

  return (
    <ButtonBase
      {...props}
      unstyled
      className={`${variantClasses} ${className}`}
      leftIcon={renderButtonIcon(resolvedLeftIcon, props.size)}
      rightIcon={renderButtonIcon(rightIcon, props.size)}
    />
  );
}
