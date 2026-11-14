// src/components/ContentRenderer/variants/utils/footerMenuClasses.ts
/**
 * Shared class strings for the footer menu's "hover one, mute the rest" links.
 * Single source of truth so the Astro FooterMenuVariant and the React
 * HorizontalLegalFooter (which can't render the Astro component) stay identical.
 *
 * Colour states, layered so precedence is deterministic regardless of Tailwind's
 * utility source order:
 *   • rest                → text-text
 *   • any sibling hovered → this row mutes (group-hover, important beats rest)
 *   • THIS row hovered    → heading (arbitrary-property !important beats the mute)
 * The parent <nav> must carry `group/menu` (FOOTER_MENU_NAV_BASE includes it).
 */

/** Per-row link/button classes — typography-neutral; add sizing where used. */
export const FOOTER_MENU_ITEM_CLASS = [
  "p-0! justify-start! font-normal no-underline hover:no-underline",
  "transition-colors main-duration",
  "text-text! group-hover/menu:text-muted! [&:hover]:![color:var(--color-heading)] focus-visible:![color:var(--color-heading)]",
].join(" ");

/** Nav wrapper — carries the `group/menu` marker the rows key off. */
export const FOOTER_MENU_NAV_BASE = "group/menu list-none";

/** Layout add-ons. Vertical = the main-footer column; horizontal = the menu footer. */
export const FOOTER_MENU_NAV_VERTICAL = "flex flex-col items-start gap-3";
export const FOOTER_MENU_NAV_HORIZONTAL =
  "flex flex-nowrap items-center gap-2.5 sm:gap-4";
