// src/components/Button/variants/TertiaryButton.tsx
/**
 * Tertiary Button Variant
 *
 * Underlined text action.
 * Used when the CTA should read like a plain text link instead of a filled button.
 */

import { ButtonBase, type ButtonProps } from "../Button";
import { renderButtonIcon } from "../utils";

/**
 * Underlined heading-colored text link
 */
export default function PrimaryButton({
  leftIcon,
  rightIcon,
  className = "",
  ...props
}: ButtonProps) {
  const variantClasses =
    "group inline-flex items-center gap-2 bg-transparent p-0 text-text no-underline hover:underline focus:underline decoration-current underline-offset-4";

  return (
    <ButtonBase
      {...props}
      unstyled
      className={`${variantClasses} ${className}`}
      leftIcon={renderButtonIcon(leftIcon, props.size)}
      rightIcon={
        rightIcon ? (
          <span className="transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-0.5">
            {renderButtonIcon(rightIcon, props.size)}
          </span>
        ) : null
      }
    />
  );
}
