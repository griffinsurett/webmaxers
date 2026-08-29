// src/components/Button/variants/PrimaryButton.tsx
/**
 * Primary Button Variant
 *
 * A fully rounded pill using the same surface treatment as the AskAi input bar:
 * a `bg2` fill inside a hairline `heading/15` border, with the brand accent
 * arriving on hover/focus (border warms to primary) rather than at rest. The
 * default and most prominent button style — used for form submissions and main
 * CTAs.
 */

import { animationProps } from "@/integrations/scroll-animations";
import { ButtonBase, type ButtonProps } from "../Button";
import { getButtonBaseClasses, renderButtonIcon } from "../utils";
import IconGradientDefs, { useIconGradient } from "@/components/IconGradientDefs";

/**
 * Primary button: rounded pill, bg2 fill, hairline border, heading label.
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
  // Primary-gradient arrow. See @/utils/iconGradient.
  const iconGrad = useIconGradient();
  const baseShell = getButtonBaseClasses(props.size);
  const variantClasses = [
    baseShell,
    fullWidth ? "!w-full" : "",
    // Pill shell with an eyebrow-styled label. Keeps the base shell's
    // `rounded-full`.
    //
    // The `!` matters: the size class from `getButtonBaseClasses` (btn-lg) sets
    // `px-10 lg:px-12` and `lg:text-lg xl:text-xl`, which otherwise win. These
    // force the tighter padding and hold the eyebrow's small size, so the pill
    // hugs its label at every breakpoint.
    //
    // `tracking-[0.12em]` narrows `eyebrow-text`'s 0.2em: at 14px that spacing
    // alone added ~45px across a 16-character label — most of the button's
    // excess width. The letterspaced look survives; the pill gets ~25px tighter.
    "px-6! py-3.5! eyebrow-text tracking-[0.12em]! font-medium group",
    // Same surface treatment as the AskAi input bar: a `bg2` fill inside a
    // hairline `heading/15` border, so the CTA reads as a quiet inset control
    // rather than a saturated slab. (Replaces the primary→primary-700 gradient
    // fill.) Hover/focus warms the border to primary and lifts the label to
    // full-contrast heading — the accent arrives on interaction, not at rest.
    // A plain colour transition rather than `primary-button-transition`: that
    // utility adds a 700ms lift + shadow-2xl, which reads as a floating slab and
    // works against this inset, hairline-bordered surface.
    "transition-colors duration-200 ease-out border border-heading/15 bg-bg2 text-heading",
    "hover:border-primary/50 hover:bg-bg3 focus-visible:border-primary/50",
    // The icon carries the brand gradient while the label stays neutral — the
    // one spot of colour on an otherwise quiet control. The paint comes from
    // `iconGrad.style` below (an SVG gradient), not a text colour.
    "[&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:translate-x-[0.16rem] hover:[&_svg]:-translate-y-[0.16rem]",
  ]
    .filter(Boolean)
    .join(" ");

  const buttonContent = (
    <>
      <IconGradientDefs {...iconGrad.defsProps} />
      <ButtonBase
        {...props}
        className={`${variantClasses} ${className}`.trim()}
        leftIcon={renderButtonIcon(leftIcon, props.size, iconGrad.style)}
        rightIcon={renderButtonIcon(rightIcon, props.size, iconGrad.style)}
      />
    </>
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
