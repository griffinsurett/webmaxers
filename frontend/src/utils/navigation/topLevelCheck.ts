// src/utils/navigation/topLevelCheck.ts
/**
 * Top-level placement heuristics shared across components.
 * Determines whether a component is likely positioned at the top
 * of the page (e.g., site header, masthead, navbar).
 */

interface TopLevelContext {
  id?: string;
  className?: string;
  isTopLevel?: boolean;
  keywords?: readonly string[];
}

const DEFAULT_KEYWORDS = [
  "header",
  "site-header",
  "main-header",
  "masthead",
  "top-bar",
  "navbar",
  "primary-nav",
  "top-nav",
  "main-nav",
] as const;

export function isTopLevelPlacement(
  context: TopLevelContext = {}
): boolean {
  const { isTopLevel, id, className, keywords = DEFAULT_KEYWORDS } = context;

  if (typeof isTopLevel === "boolean") {
    return isTopLevel;
  }

  const combined = `${id ?? ""} ${className ?? ""}`.toLowerCase().trim();
  if (!combined) return false;

  return keywords.some((keyword) => combined.includes(keyword));
}
