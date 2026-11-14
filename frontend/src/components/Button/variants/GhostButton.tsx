// src/components/Button/variants/GhostButton.tsx
/**
 * Ghost Button Variant
 *
 * Transparent button that shows background on hover.
 * Used for tertiary actions or when subtle interaction is needed.
 */

import { ButtonBase, type ButtonProps } from "../Button";
import { renderButtonIcon } from "../utils";

export default function GhostButton({
  leftIcon,
  rightIcon,
  className = "",
  ...props
}: ButtonProps) {
  // Outlined style with blue border
  const variantClasses =
    "bg-bg/25 text-bg border-0 hover:bg-primary focus:ring-primary";

  return (
    <ButtonBase
      {...props}
      className={`${variantClasses} ${className}`}
      leftIcon={renderButtonIcon(leftIcon, props.size)}
      rightIcon={renderButtonIcon(rightIcon, props.size)}
    />
  );
}
