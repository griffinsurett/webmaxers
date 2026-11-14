// src/hooks/useFilter.ts
/**
 * useFilter - Reusable filtering hook for any data collection
 *
 * Automatically derives filter options from the items' data structure:
 * - If items have `parent` field → group by parent
 * - If items have `tags` field → group by tags
 * - If items have `category` field → group by category
 * - If items have a reference field to another collection → group by that
 *
 * @example
 * // Basic usage with auto-detection
 * const { filteredItems, filterOptions, activeFilter, setActiveFilter, showFilters } = useFilter(items);
 *
 * @example
 * // With explicit field and configuration
 * const filter = useFilter(items, { field: 'category', showAll: true, allLabel: 'All Categories' });
 */
import { useState, useMemo, useCallback } from "react";

// Key for "all" filter option
export const ALL_FILTER_KEY = "__all__";

export interface FilterOption {
  key: string;
  label: string;
  icon?: string;
  count?: number;
}

export interface FilterConfig {
  /** Override the auto-detected field */
  field?: string;
  /** Include an "All" option at the start (default: true) */
  showAll?: boolean;
  /** Label for the "All" option */
  allLabel?: string;
  /** Icon for the "All" option */
  allIcon?: string;
  /** Show count of items per filter */
  showCount?: boolean;
  /** Default selected filter key */
  defaultFilter?: string;
}

export interface UseFilterResult<T> {
  /** The currently filtered items */
  filteredItems: T[];
  /** Available filter options */
  filterOptions: FilterOption[];
  /** Currently active filter key */
  activeFilter: string;
  /** Set the active filter */
  setActiveFilter: (key: string) => void;
  /** Whether filters should be shown (more than one option) */
  showFilters: boolean;
  /** The detected or configured grouping field */
  groupingField: string | null;
  /** Whether to show count on filter options */
  showCount: boolean;
}

/**
 * Auto-detect the grouping field from items
 * Priority: parent > tags > category > first reference field found
 */
function detectGroupingField<T extends Record<string, any>>(items: T[]): string | null {
  if (items.length === 0) return null;

  // Check first few items to detect the pattern
  const sample = items.slice(0, 5);

  // Check for parent field (most common for hierarchical data)
  if (sample.some((item) => item.parent !== undefined && item.parent !== null)) {
    return "parent";
  }

  // Check for tags field
  if (sample.some((item) => Array.isArray(item.tags) && item.tags.length > 0)) {
    return "tags";
  }

  // Check for category field
  if (sample.some((item) => item.category !== undefined && item.category !== null)) {
    return "category";
  }

  // Look for reference fields (objects with collection/id or slug/id pattern)
  for (const item of sample) {
    for (const [key, value] of Object.entries(item)) {
      // Skip known non-grouping fields
      if (["slug", "url", "title", "description", "icon", "image", "order", "Content", "content"].includes(key)) {
        continue;
      }
      // Check if it looks like a reference (has id/slug, or is array of refs)
      if (value && typeof value === "object") {
        if ("id" in value || "slug" in value || "collection" in value) {
          return key;
        }
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
          const first = value[0];
          if ("id" in first || "slug" in first || "collection" in first) {
            return key;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Extract the key from a value (handles strings, refs, objects)
 */
function extractKey(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    // Reference object - extract id or slug
    return value.id || value.slug || null;
  }
  return String(value);
}

/**
 * Format a key into a human-readable label
 */
function formatLabel(key: string): string {
  return key
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Extract unique filter options from items based on detected field
 */
function extractFilterOptions<T extends Record<string, any>>(
  items: T[],
  field: string
): FilterOption[] {
  const optionMap = new Map<string, { label: string; icon?: string; count: number }>();

  for (const item of items) {
    const value = item[field];

    if (value === undefined || value === null) continue;

    // Handle arrays (tags, multiple parents, multiple refs)
    if (Array.isArray(value)) {
      for (const v of value) {
        const key = extractKey(v);
        if (!key) continue;

        const existing = optionMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          // Try to get label and icon from resolved data
          const label = typeof v === "object" ? (v.title || v.label || v.name || key) : key;
          const icon = typeof v === "object" ? v.icon : undefined;

          optionMap.set(key, {
            label: formatLabel(label),
            icon,
            count: 1,
          });
        }
      }
    } else {
      // Handle single values
      const key = extractKey(value);
      if (!key) continue;

      const existing = optionMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        // Try to get label and icon from resolved data or {field}Data pattern
        let label = key;
        let icon: string | undefined;

        if (typeof value === "object") {
          label = value.title || value.label || value.name || key;
          icon = value.icon;
        } else {
          // Check for resolved data in {field}Data pattern (e.g., parentData, industryData)
          const fieldData = item[`${field}Data`];
          if (fieldData) {
            label = fieldData.title || fieldData.label || key;
            icon = fieldData.icon;
          }
        }

        optionMap.set(key, {
          label: formatLabel(label),
          icon,
          count: 1,
        });
      }
    }
  }

  return Array.from(optionMap.entries()).map(([key, data]) => ({
    key,
    label: data.label,
    icon: data.icon,
    count: data.count,
  }));
}

/**
 * Filter items based on selected filter key
 */
function filterItemsByKey<T extends Record<string, any>>(
  items: T[],
  filterKey: string,
  field: string
): T[] {
  if (filterKey === ALL_FILTER_KEY) {
    return items;
  }

  return items.filter((item) => {
    const value = item[field];

    if (value === undefined || value === null) return false;

    if (Array.isArray(value)) {
      return value.some((v) => extractKey(v) === filterKey);
    }

    return extractKey(value) === filterKey;
  });
}

/**
 * Reusable filter hook for any data collection
 */
export function useFilter<T extends Record<string, any>>(
  items: T[],
  config?: FilterConfig
): UseFilterResult<T> {
  const safeItems = Array.isArray(items) ? items : [];

  // Auto-detect or use provided field
  const groupingField = useMemo(() => {
    if (config?.field) return config.field;
    return detectGroupingField(safeItems);
  }, [safeItems, config?.field]);

  // Extract filter options from items
  const filterOptions = useMemo(() => {
    if (!groupingField) return [];

    const extracted = extractFilterOptions(safeItems, groupingField);

    // Prepend "All" option if configured (default: true)
    if (config?.showAll !== false) {
      const allOption: FilterOption = {
        key: ALL_FILTER_KEY,
        label: config?.allLabel ?? "All",
        icon: config?.allIcon,
        count: safeItems.length,
      };
      return [allOption, ...extracted];
    }

    return extracted;
  }, [safeItems, groupingField, config?.showAll, config?.allLabel, config?.allIcon]);

  // Determine initial filter
  const initialFilter = useMemo(() => {
    if (config?.defaultFilter) {
      const exists = filterOptions.some((opt) => opt.key === config.defaultFilter);
      if (exists) return config.defaultFilter;
    }
    return filterOptions[0]?.key ?? ALL_FILTER_KEY;
  }, [config?.defaultFilter, filterOptions]);

  const [activeFilter, setActiveFilter] = useState(initialFilter);

  // Filter items based on active filter
  const filteredItems = useMemo(() => {
    if (!groupingField) return safeItems;
    return filterItemsByKey(safeItems, activeFilter, groupingField);
  }, [safeItems, activeFilter, groupingField]);

  // Handle filter change with callback
  const handleSetActiveFilter = useCallback((key: string) => {
    setActiveFilter(key);
  }, []);

  // Whether to show filters (more than one option, and has grouping field)
  const showFilters = Boolean(groupingField && filterOptions.length > 1);

  return {
    filteredItems,
    filterOptions,
    activeFilter,
    setActiveFilter: handleSetActiveFilter,
    showFilters,
    groupingField,
    showCount: config?.showCount ?? false,
  };
}

export default useFilter;
