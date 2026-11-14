import {
  cloneElement,
  isValidElement,
  useId,
  type CSSProperties,
  type ReactElement,
} from "react";
import { ButtonBase, type ButtonProps, type ButtonSize } from "../Button";
import { renderButtonIcon } from "../utils";

const SIZE_STYLES: Record<
  ButtonSize,
  {
    shell: string;
    body: string;
    icon: string;
    iconInner: string;
    text: string;
  }
> = {
  sm: {
    shell: "min-h-[3.45rem]",
    body: "inset-y-[0.2rem] inset-x-0 rounded-[1.35rem]",
    icon: "h-[3.58rem] w-[3.58rem]",
    iconInner: "[&_svg]:h-[1.52rem] [&_svg]:w-[1.52rem]",
    text: "pl-[3.7rem] pr-[1.35rem] text-[1rem] tracking-[0.19em]",
  },
  md: {
    shell: "min-h-[3.7rem]",
    body: "inset-y-[0.22rem] inset-x-0 rounded-[1.45rem]",
    icon: "h-[3.8rem] w-[3.8rem]",
    iconInner: "[&_svg]:h-[1.68rem] [&_svg]:w-[1.68rem]",
    text: "pl-[3.95rem] pr-[1.5rem] text-[1.06rem] tracking-[0.21em]",
  },
  lg: {
    shell: "min-h-[4rem]",
    body: "inset-y-[0.24rem] inset-x-0 rounded-[1.55rem]",
    icon: "h-[4rem] w-[4rem]",
    iconInner: "[&_svg]:h-[1.82rem] [&_svg]:w-[1.82rem]",
    text: "pl-[4.2rem] pr-[1.65rem] text-[1.12rem] tracking-[0.22em]",
  },
};

export default function LinkPageButton({
  leftIcon,
  className = "",
  size = "md",
  children,
  ...props
}: ButtonProps) {
  const iconGradientId = useId();
  const normalizedSize = size ?? "md";
  const styles = SIZE_STYLES[normalizedSize];
  const iconRenderSize = normalizedSize === "sm" ? "md" : normalizedSize;
  const rawIconNode = renderButtonIcon(leftIcon, iconRenderSize);
  const iconNode = isValidElement(rawIconNode)
    ? cloneElement(rawIconNode as ReactElement<{ style?: CSSProperties }>, {
        style: {
          ...((rawIconNode.props as { style?: CSSProperties })?.style ?? {}),
          color: `url(#${iconGradientId})`,
          fill: `url(#${iconGradientId})`,
          stroke: `url(#${iconGradientId})`,
        },
      })
    : rawIconNode;
  const hasLeadingIcon = Boolean(iconNode);

  const buttonClasses = [
    "group relative inline-flex w-full items-center overflow-hidden bg-transparent text-heading no-underline",
    "button-style transition-transform main-duration hover:-translate-y-1",
    styles.shell,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ButtonBase {...props} className={buttonClasses} unstyled>
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        focusable="false"
        className="pointer-events-none absolute h-0 w-0 overflow-hidden"
      >
        <defs>
          <linearGradient id={iconGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" className="text-primary-100" />
            <stop offset="55%" stopColor="currentColor" className="text-primary" />
            <stop offset="100%" stopColor="currentColor" className="text-primary-800" />
          </linearGradient>
        </defs>
      </svg>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute card-bg ${styles.body}`}
      />
      {hasLeadingIcon && (
        <span
          className={`pointer-events-none absolute left-[0.95rem] top-1/2 inline-flex -translate-y-1/2 shrink-0 items-center justify-center ${styles.iconInner}`}
          aria-hidden="true"
        >
          {iconNode}
        </span>
      )}
      <span
        className={`relative z-10 block w-full min-w-0 text-center font-semibold uppercase text-heading ${styles.text}`}
      >
        {children}
      </span>
    </ButtonBase>
  );
}
