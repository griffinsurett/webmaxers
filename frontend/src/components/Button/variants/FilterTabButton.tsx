// src/components/Button/variants/FilterTabButton.tsx
/**
 * FilterTab Button Variant
 *
 * Pill-style filter tab with AnimatedBorder for card filtering.
 * Used for horizontal filter tabs with optional icon.
 */

import AnimatedBorder from "@/components/AnimatedBorder/AnimatedBorder";
import { ButtonBase, type ButtonProps, type ButtonSize } from "../Button";
import { renderButtonIcon } from "../utils";

export interface FilterTabButtonProps extends Omit<ButtonProps, 'children'> {
  /** Whether the filter is currently active/selected */
  active?: boolean;
  /** Label text to display */
  label: string;
  /** Optional count to show */
  count?: number;
  /** Whether to show the count */
  showCount?: boolean;
}

const sizeClasses: Record<ButtonSize, { padding: string; text: string; gap: string }> = {
  sm: { padding: "px-3 py-2", text: "text-xs", gap: "gap-1.5" },
  md: { padding: "px-4 py-2.5", text: "text-sm", gap: "gap-2" },
  lg: { padding: "px-5 py-3", text: "text-base", gap: "gap-2.5" },
};

export default function FilterTabButton({
  leftIcon,
  active = false,
  label,
  count,
  showCount = false,
  size = "sm",
  className = "",
  ...props
}: FilterTabButtonProps) {
  const currentSize = sizeClasses[size];

  const innerClasses = [
    currentSize.padding,
    "rounded-full font-medium main-duration transition-all",
    "flex items-center",
    currentSize.gap,
    currentSize.text,
    active ? "text-accent" : "text-heading hover:text-accent",
    className,
  ].filter(Boolean).join(" ");

  return (
    <AnimatedBorder
      variant="progress-b-f"
      triggers="controlled"
      active={active}
      duration={400}
      borderRadius="rounded-full"
      borderWidth={2}
      color="var(--color-accent)"
      innerClassName="card-bg border-off-hover"
    >
      <ButtonBase
        {...props}
        unstyled
        className={innerClasses}
        leftIcon={renderButtonIcon(leftIcon, size)}
      >
        <span>{label}</span>
        {showCount && count !== undefined && (
          <span className={`${currentSize.text} opacity-60`}>({count})</span>
        )}
      </ButtonBase>
    </AnimatedBorder>
  );
}
