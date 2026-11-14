// src/components/LoopTemplates/FilteredCardRenderer.tsx
/**
 * FilteredCardRenderer - Cards with auto-detecting filter tabs
 *
 * Uses the reusable useFilter hook and FilterTabs component.
 * Automatically derives filter options from the items' data structure.
 *
 * For custom filtered variants, use useFilter hook + FilterTabs directly.
 */
import { useFilter, type FilterConfig } from "@/hooks/useFilter";
import FilterTabs from "./FilterTabs";
import CardRenderer, { type CardRendererProps } from "./CardRenderer";
import type { FeatureCardData } from "@/components/LoopComponents/FeatureCard";

export type { FilterConfig } from "@/hooks/useFilter";

export interface FilteredCardRendererProps extends Omit<CardRendererProps, "items"> {
  items?: FeatureCardData[];
  /** Optional filter configuration for overrides */
  filter?: FilterConfig;
  /** Filter tab size */
  filterSize?: "sm" | "md" | "lg";
  /** Additional class for filter tabs container */
  filterClassName?: string;
  /** Callback when filter changes */
  onFilterChange?: (filterKey: string) => void;
}

export default function FilteredCardRenderer({
  items = [],
  filter,
  filterSize = "sm",
  filterClassName = "",
  onFilterChange,
  ...cardRendererProps
}: FilteredCardRendererProps) {
  const safeItems = Array.isArray(items) ? items : [];

  // Use the reusable filter hook
  const {
    filteredItems,
    filterOptions,
    activeFilter,
    setActiveFilter,
    showFilters,
    groupingField,
    showCount,
  } = useFilter(safeItems as Record<string, unknown>[], filter);

  // Handle filter change with optional callback
  const handleFilterChange = (key: string) => {
    setActiveFilter(key);
    onFilterChange?.(key);
  };

  if (safeItems.length === 0) {
    return null;
  }

  return (
    <div className="filtered-card-renderer">
      {/* Filter Tabs */}
      <FilterTabs
        options={filterOptions}
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        show={showFilters}
        groupingField={groupingField}
        size={filterSize}
        showCount={showCount}
        className={filterClassName}
      />

      {/* Filtered Cards */}
      <div
        className="transition-all duration-300 ease-in-out"
        key={activeFilter}
      >
        <CardRenderer items={filteredItems as FeatureCardData[]} {...cardRendererProps} />
      </div>
    </div>
  );
}
