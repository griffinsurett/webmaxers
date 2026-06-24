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
  // dark-mode primary). The icon-transition classes nudge the arrow up-right on
  // hover (matches the hero CTA's behaviour for every primary button).
  const variantClasses =
    "bg-primary text-bg focus:ring-primary hover:bg-primary-600 transition-all " +
    "[&_svg]:transition-transform [&_svg]:duration-200 " +
    "hover:[&_svg]:translate-x-[0.16rem] hover:[&_svg]:-translate-y-[0.16rem]";

  // Default the trailing icon to the upper-right arrow so every primary button
  // carries it; an explicit rightIcon from the caller still wins.
  const resolvedRightIcon = rightIcon ?? "lu:arrow-up-right";

  return (
    <ButtonBase
      {...props}
      className={`${variantClasses} ${className}`}
      leftIcon={renderButtonIcon(leftIcon, props.size)}
      rightIcon={renderButtonIcon(resolvedRightIcon, props.size)}
    />
  );
}
