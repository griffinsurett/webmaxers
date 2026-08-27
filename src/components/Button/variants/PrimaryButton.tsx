// src/components/Button/variants/PrimaryButton.tsx
/**
 * Primary Button Variant
 *
 * Solid blue button - the default and most prominent button style.
 * Used for primary actions like form submissions, main CTAs.
 */

import { animationProps } from "@/integrations/scroll-animations";
import { ButtonBase, type ButtonProps } from "../Button";
import { getButtonBaseClasses, renderButtonIcon } from "../utils";

/**
 * Primary button with blue background and white text
 */
export default function PrimaryButton({
  leftIcon,
  rightIcon,
  className = "",
  animated = true,
  buttonWrapperClasses,
  fullWidth = false,
  ...props
}: ButtonProps) {
  const baseShell = getButtonBaseClasses(props.size);
  const variantClasses = [
    baseShell,
    fullWidth ? "!w-full" : "",
    // Squared-off shell with an eyebrow-styled label — the hero CTA treatment,
    // now the project-wide primary. `rounded-xl` overrides the base shell's
    // `rounded-full`; both are plain classes, so the later one in the string
    // wins only by specificity tie-break — keep it after `baseShell`.
    "!rounded-xl px-6 py-3.5 eyebrow-text font-medium shadow-md group",
    "primary-button-transition border-2 border-primary primary-gradient gradient-disappear-on-hover text-bg hover:text-heading [&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:translate-x-[0.16rem] hover:[&_svg]:-translate-y-[0.16rem]",
  ]
    .filter(Boolean)
    .join(" ");

  const buttonContent = (
    <ButtonBase
      {...props}
      className={`${variantClasses} ${className}`.trim()}
      leftIcon={renderButtonIcon(leftIcon, props.size)}
      rightIcon={renderButtonIcon(rightIcon, props.size)}
    />
  );

  const wrapperClasses = [
    fullWidth ? "inline-flex w-full" : "inline-flex w-full lg:w-auto",
    buttonWrapperClasses,
  ]
    .filter(Boolean)
    .join(" ");

  if (!animated) {
    return <span className={wrapperClasses}>{buttonContent}</span>;
  }

  return (
    <span
      {...animationProps("zoom-in", { once: true })}
      className={wrapperClasses}
    >
      {buttonContent}
    </span>
  );
}
