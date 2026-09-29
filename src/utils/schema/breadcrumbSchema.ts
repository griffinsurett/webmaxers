/** Serialize resolved navigation data. No routing or hierarchy decisions live here. */
import type { BreadcrumbItem } from "@/utils/breadcrumbs";

export function buildBreadcrumbSchema(items: readonly BreadcrumbItem[]): object | null {
  if (items.length < 2) return null;
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: item.canonicalUrl,
    })),
  };
}
