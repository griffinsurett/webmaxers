// src/components/LoopComponents/FilterTab.tsx
import Button, { type ButtonVariant } from "@/components/Button/Button";
import type { FilterOption } from "@/hooks/useFilter";

// Re-export FilterOption from the hook for backwards compatibility
export type { FilterOption } from "@/hooks/useFilter";

export interface FilterTabProps {
  option: FilterOption;
  checked: boolean;
  onChange: (value: string) => void;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  className?: string;
  /** Button variant to use for the filter tab */
  variant?: ButtonVariant;
}

export default function FilterTab({
  option,
  checked,
  onChange,
  size = "sm",
  showCount = false,
  className = "",
  variant = "filterTab",
}: FilterTabProps) {
  const handleClick = () => {
    onChange(option.key);
  };

  // For filterIcon variant, pass icon as the `icon` prop (handled by IconListItem)
  // For other variants like filterTab, pass as leftIcon (handled by renderButtonIcon)
  const iconProp = variant === "filterIcon"
    ? { icon: option.icon }
    : { leftIcon: option.icon };

  return (
    <Button
      variant={variant}
      active={checked}
      label={option.label}
      {...iconProp}
      count={option.count}
      showCount={showCount}
      size={size}
      className={`shrink-0 ${className}`.trim()}
      onClick={handleClick}
      role="radio"
      aria-checked={checked}
    />
  );
}
