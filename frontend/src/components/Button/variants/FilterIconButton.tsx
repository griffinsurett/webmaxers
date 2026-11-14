// src/components/Button/variants/FilterIconButton.tsx
/**
 * FilterIcon Button Variant
 *
 * Vertical icon-above-text filter button for portfolio filtering.
 * No border, just icon stacked on top of label text.
 */

import { ButtonBase, type ButtonProps, type ButtonSize } from "../Button";
import IconListItem from "@/components/LoopComponents/IconListItem";
import type { IconSize } from "@/integrations/icons";

export interface FilterIconButtonProps extends Omit<ButtonProps, 'children'> {
  /** Whether the filter is currently active/selected */
  active?: boolean;
  /** Label text to display */
  label: string;
  /** Icon to display above the label */
  icon?: string;
  /** Optional count to show */
  count?: number;
  /** Whether to show the count */
  showCount?: boolean;
}

const sizeClasses: Record<ButtonSize, { padding: string; text: string; gap: string; iconSize: IconSize }> = {
  sm: { padding: "px-3 py-2", text: "text-sm md:text-xs", gap: "gap-1.5", iconSize: "md" },
  md: { padding: "px-4 py-2.5", text: "text-sm md:text-xs", gap: "gap-2", iconSize: "lg" },
  lg: { padding: "px-5 py-3", text: "text-base md:text-sm", gap: "gap-2.5", iconSize: "xl" },
};

export default function FilterIconButton({
  active = false,
  label,
  icon,
  count,
  showCount = false,
  size = "md",
  className = "",
  ...props
}: FilterIconButtonProps) {
  const currentSize = sizeClasses[size];
  const iconData = icon
    ? {
        icon: {
          icon,
          className: active ? "text-bg" : "",
        },
        title: label,
      }
    : undefined;

  const buttonClasses = [
    currentSize.padding,
    "font-medium main-duration transition-all group",
    "text-text max-w-[100px] md:max-w-[110px]",
    className,
  ].filter(Boolean).join(" ");

  // Icon wrapper: card-bg + accent text by default, primary gradient on hover/active
  const iconWrapperClasses = active
    ? "filter-icon-wrapper active"
    : "filter-icon-wrapper";

  return (
    <ButtonBase
      {...props}
      unstyled
      className={buttonClasses}
    >
      {icon ? (
        <IconListItem
          data={iconData}
          layout="vertical"
          alignment="center"
          className={`${currentSize.gap} items-center`}
          iconClassName={iconWrapperClasses}
          iconSize={currentSize.iconSize}
          titleClassName={`${currentSize.text} font-medium text-center leading-tight`}
          titleTag="span"
          showDescription={false}
        />
      ) : (
        <span className={currentSize.text}>{label}</span>
      )}
      {showCount && count !== undefined && (
        <span className={`${currentSize.text} opacity-60 block text-center`}>
          ({count})
        </span>
      )}
    </ButtonBase>
  );
}
