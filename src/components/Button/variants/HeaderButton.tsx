// src/components/Button/variants/HeaderButton.tsx
/**
 * Header Button Variant
 *
 * The header CTA ("Let's Talk"). Like the secondary button (transparent pill
 * with an outline) but WITHOUT the animated border, and it always carries the
 * primary arrow (lu:arrow-up-right) with the same diagonal hover motion.
 */
import { ButtonBase, type ButtonProps } from "../Button";
import { getButtonBaseClasses, renderButtonIcon } from "../utils";

export default function HeaderButton({
  leftIcon,
  rightIcon,
  className = "",
  fullWidth = false,
  ...props
}: ButtonProps) {
  const variantClasses = [
    getButtonBaseClasses(props.size),
    fullWidth ? "!w-full" : "",
    "rounded-full bg-transparent text-heading",
    // Same arrow motion as the primary button: diagonal up-right on hover.
    "[&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:translate-x-[0.16rem] hover:[&_svg]:-translate-y-[0.16rem]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ButtonBase
      {...props}
      className={variantClasses}
      leftIcon={renderButtonIcon(leftIcon, props.size)}
      rightIcon={renderButtonIcon(rightIcon ?? "lu:arrow-up-right", props.size)}
    />
  );
}
