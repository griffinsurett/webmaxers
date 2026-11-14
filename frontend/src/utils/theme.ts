// src/constants/theme.ts
/**
 * Theme-related constants shared between Astro layouts and React hooks.
 */

export const ACCENT_COLORS = [
  "var(--main-accent)",
  "var(--color-purple-700)",
  "var(--color-teal-500)",
  "var(--color-emerald-500)",
  "var(--color-lime-500)",
  "var(--color-red-500)",
  "var(--color-pink-500)",
  "var(--color-orange-500)",
  "#722F37",
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export const DEFAULT_THEME: "system" = "system";
