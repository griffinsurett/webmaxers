// src/components/Menu/HamburgerButton.tsx
/**
 * Animated Hamburger Button
 *
 * Thin three-line hamburger that transforms into an X when open. The middle
 * line is shorter at rest and extends to full width on hover. Ported from
 * griffinswebservices to match its header navigation.
 */

import type { ButtonHTMLAttributes, Dispatch, SetStateAction } from "react";

interface HamburgerButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  isOpen: boolean;
  onChange: ((isOpen: boolean) => void) | Dispatch<SetStateAction<boolean>>;
  className?: string;
  hamburgerTransform?: boolean;
  ariaLabel?: string;
}

export default function HamburgerButton({
  isOpen,
  onChange,
  className = "",
  ariaLabel = "Toggle menu",
  hamburgerTransform = true,
  ...props
}: HamburgerButtonProps) {
  const shouldTransform = hamburgerTransform && isOpen;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-expanded={isOpen}
      onClick={() => onChange(!isOpen)}
      className={`group relative h-4 lg:h-[1.125rem] w-5 lg:w-6 cursor-pointer flex flex-col justify-between items-start text-text hover:text-heading ${className}`.trim()}
      {...props}
    >
      <span
        className={`block h-[0.5px] w-full bg-current transition-all duration-300 ${
          shouldTransform ? "absolute top-1/2 -translate-y-1/2 rotate-45" : ""
        }`}
      />
      <span
        className={`block h-[0.5px] self-end bg-current transition-all duration-300 ${
          shouldTransform ? "opacity-0 w-full" : "opacity-100 w-3.5 group-hover:w-full"
        }`}
      />
      <span
        className={`block h-[0.5px] w-full bg-current transition-all duration-300 ${
          shouldTransform ? "absolute top-1/2 -translate-y-1/2 -rotate-45" : ""
        }`}
      />
    </button>
  );
}
