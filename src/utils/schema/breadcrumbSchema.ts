// src/utils/schema/breadcrumbSchema.ts
/**
 * BreadcrumbList schema — derived from a page's URL path.
 *
 * Site-wide by nature (every non-home page has a position in the hierarchy),
 * so it's built in the SEO layer from the canonical path. Returns null on the
 * homepage (a single-item breadcrumb adds nothing).
 *
 * The last crumb uses the page's own title when given (a root-level item at
 * /far would otherwise humanize to "Far"); parents humanize their slug.
 */
import { siteData } from "@site/content/siteData";
import { humanizeSlug } from "@/utils/string";
import { canonicalWebUrl } from "@/utils/links/linkBehavior";

export function buildBreadcrumbSchema(
  canonicalPath: string,
  pageTitle?: string,
  canonicalUrl?: string,
): object | null {
  const segments = canonicalPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteData.url },
      ...segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return {
          "@type": "ListItem",
          position: i + 2,
          // Some pages pass "Title | Site" — keep just the title part.
          name: (isLast && pageTitle?.split(" | ")[0].trim()) || humanizeSlug(seg),
          item: isLast && canonicalUrl ? canonicalUrl : canonicalWebUrl(`/${segments.slice(0, i + 1).join("/")}`, siteData.url),
        };
      }),
    ],
  };
}
