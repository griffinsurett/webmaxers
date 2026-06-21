// src/components/Button/variants/PrimaryButton.tsx
/**
 * Primary Button Variant
 *
 * Solid blue button - the default and most prominent button style.
 * Used for primary actions like form submissions, main CTAs.
 */

import { ButtonBase, type ButtonProps } from "../Button";
import { renderButtonIcon } from "../utils";

/**
 * Primary button with blue background and white text
 */
export default function PrimaryButton({
  leftIcon,
  rightIcon,
  className = "",
  ...props
}: ButtonProps) {
  // Primary button styling — solid primary background. `text-bg` reads in both
  // themes: --color-bg is near-white in light mode (light text on the near-black
  // light-mode primary) and near-black in dark mode (dark text on the blue
  // dark-mode primary).
  const variantClasses =
    "bg-primary text-bg focus:ring-primary hover:bg-primary-600 transition-all";

  return (
    <ButtonBase
      {...props}
      className={`${variantClasses} ${className}`}
      leftIcon={renderButtonIcon(leftIcon, props.size)}
      rightIcon={renderButtonIcon(rightIcon, props.size)}
    />
  );
}
