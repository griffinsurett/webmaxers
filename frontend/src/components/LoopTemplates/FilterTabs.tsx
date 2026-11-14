// src/components/LoopTemplates/FilterTabs.tsx
/**
 * FilterTabs - Reusable filter tabs component
 *
 * A standalone component for rendering filter tabs that works with the useFilter hook.
 * Can be used in any variant that needs filtering functionality.
 * Auto-scrolls to keep the active filter centered.
 *
 * @example
 * // Basic usage with useFilter hook
 * const { filterOptions, activeFilter, setActiveFilter, showFilters, groupingField, showCount } = useFilter(items);
 *
 * return (
 *   <>
 *     <FilterTabs
 *       options={filterOptions}
 *       activeFilter={activeFilter}
 *       onFilterChange={setActiveFilter}
 *       show={showFilters}
 *       groupingField={groupingField}
 *       showCount={showCount}
 *     />
 *     <YourContent items={filteredItems} />
 *   </>
 * );
 */
import FilterTab from "@/components/LoopComponents/FilterTab";
import type { FilterOption } from "@/hooks/useFilter";
import type { ButtonVariant } from "@/components/Button/Button";

export interface FilterTabsProps {
  /** Filter options to display */
  options: FilterOption[];
  /** Currently active filter key */
  activeFilter: string;
  /** Callback when filter changes */
  onFilterChange: (key: string) => void;
  /** Whether to show the filter tabs (usually from useFilter.showFilters) */
  show?: boolean;
  /** The grouping field name (for accessibility label) */
  groupingField?: string | null;
  /** Filter tab size */
  size?: "sm" | "md" | "lg";
  /** Show count of items per filter */
  showCount?: boolean;
  /** Additional class for filter tabs container */
  className?: string;
  /** Button variant to use for filter tabs */
  variant?: ButtonVariant;
}

export default function FilterTabs({
  options,
  activeFilter,
  onFilterChange,
  show = true,
  groupingField,
  size = "sm",
  showCount = false,
  className = "",
  variant = "filterTab",
}: FilterTabsProps) {
  // Don't render if not showing or no options
  if (!show || options.length <= 1) {
    return null;
  }

  // Reorder options so active is always in the center
  // Items rotate around maintaining their relative order
  const activeIndex = options.findIndex((o) => o.key === activeFilter);
  const centerIndex = Math.floor(options.length / 2);

  let reorderedOptions = options;
  if (activeIndex !== -1 && activeIndex !== centerIndex) {
    // Calculate how many positions to rotate
    const shift = activeIndex - centerIndex;
    reorderedOptions = options.map((_, i) => {
      // Rotate the array so active ends up at centerIndex
      const newIndex = (i + shift + options.length) % options.length;
      return options[newIndex];
    });
  }

  return (
    <div
      className={`flex gap-2 items-start justify-center overflow-x-auto scrollbar-hide ${className}`.trim()}
      role="radiogroup"
      aria-label={`Filter by ${groupingField || "category"}`}
    >
      {reorderedOptions.map((option) => (
        <FilterTab
          key={option.key}
          option={option}
          checked={activeFilter === option.key}
          onChange={onFilterChange}
          size={size}
          showCount={showCount}
          variant={variant}
        />
      ))}
    </div>
  );
}

export type { FilterOption };
