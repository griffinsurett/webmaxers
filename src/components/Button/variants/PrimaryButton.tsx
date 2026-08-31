// src/components/Button/variants/PrimaryButton.tsx
/**
 * Primary Button Variant
 *
 * A fully rounded pill using the same surface treatment as the AskAi input bar:
 * a `bg2` fill inside a hairline border that carries the brand accent. Light
 * mode: `primary/40` at rest, full `primary` on hover/focus. Dark mode inverts
 * that — full `primary` at rest, easing to `primary/40` on hover — because on
 * the dark ground the accent hairline is what marks this as the primary action.
 * The default and most prominent button style — used for form submissions and
 * main CTAs.
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
    // hairline border, so the CTA reads as a quiet inset control rather than a
    // saturated slab. (Replaces the primary→primary-700 gradient fill.)
    //
    // The border carries the BRAND ACCENT at rest, at 40% so it reads as a tint
    // on the hairline rather than a hard outline — it is the same accent the
    // arrow icon already carries, so the control is tied to the brand without
    // becoming a coloured slab. Hover/focus brings it to full strength.
    //
    // Note `--color-primary` differs by theme: it is the blue accent in dark
    // mode but zinc-900 in light, so this reads as a blue hairline on dark and
    // a crisp near-black one on light. Both are intentional — it is the same
    // token the rest of the UI treats as "primary".
    //
    // A plain colour transition rather than `primary-button-transition`: that
    // utility adds a 700ms lift + shadow-2xl, which reads as a floating slab and
    // works against this inset, hairline-bordered surface.
    "transition-colors duration-200 ease-out border border-primary/40 bg-bg2 text-heading",
    "hover:border-primary hover:bg-bg3 focus-visible:border-primary",
    // DARK MODE: the two border states are swapped. On the dark ground the
    // accent hairline is what makes the CTA read as the primary action, so it
    // gets the FULL-strength primary border at rest and settles back to the
    // 40% tint on hover — the inverse of the light-mode treatment above, where
    // the accent arrives on interaction. `bg-bg2` is likewise held on hover so
    // the surface does not lift. The arrow's translate animation is untouched
    // and still runs in both themes.
    "dark:border-primary dark:hover:border-primary/40 dark:hover:bg-bg2 dark:focus-visible:border-primary/40",
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
