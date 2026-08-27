// src/components/Button/variants/SecondaryButton.tsx
import AnimatedBorder from "@/components/AnimatedBorder/AnimatedBorder";
import { ButtonBase, type ButtonProps } from "../Button";
import { getButtonBaseClasses, renderButtonIcon } from "../utils";
import { animationProps } from "@/integrations/scroll-animations";

const BORDER_RADIUS_CLASS = "rounded-full";

export default function SecondaryButton({
  leftIcon,
  rightIcon,
  className = "",
  animated = true,
  buttonWrapperClasses,
  fullWidth = false,
  ...props
}: ButtonProps) {
  const innerButtonClasses = [
    getButtonBaseClasses(props.size),
    fullWidth ? "!w-full" : "",
    "bg-transparent text-heading shadow-none [&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:translate-x-[0.16rem] hover:[&_svg]:-translate-y-[0.16rem]",
    BORDER_RADIUS_CLASS,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const wrapperClasses = [
    fullWidth ? "inline-flex w-full" : "inline-flex w-full lg:w-auto",
    buttonWrapperClasses,
  ]
    .filter(Boolean)
    .join(" ");

  // The scroll-reveal wrapper starts at opacity:0 and clears only when its
  // IntersectionObserver fires. Inside a position:fixed container (the cookie
  // banner) it never does, leaving the button invisible and unclickable — so
  // fixed-position callers opt out with animated={false}.
  const inner = (
      <AnimatedBorder
        variant="progress-b-f"
        triggers={animated ? "visible" : "always"}
        color="var(--color-accent)"
        borderWidth={2}
        borderRadius={BORDER_RADIUS_CLASS}
        duration={800}
        className="justify-center items-center w-full transition-all duration-700 ease-out hover:-translate-y-1"
        innerClassName="flex p-0 shadow-none border-transparent justify-center items-center bg-transparent w-full"
      >
        <ButtonBase
          {...props}
          className={innerButtonClasses}
          leftIcon={renderButtonIcon(leftIcon, props.size)}
          rightIcon={renderButtonIcon(rightIcon, props.size)}
        />
      </AnimatedBorder>
  );

  if (!animated) {
    return <span className={wrapperClasses}>{inner}</span>;
  }

  return (
    <span
      className={wrapperClasses}
      {...animationProps("fade-in-up", { once: true })}
    >
      {inner}
    </span>
  );
}
