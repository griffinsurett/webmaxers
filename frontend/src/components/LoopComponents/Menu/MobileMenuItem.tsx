// src/components/LoopComponents/Menu/MobileMenuItem.tsx
/**
 * Mobile Menu Item Component
 *
 * One row in the full-screen mobile navigation. Plain typographic link — no
 * underline, no button chrome. Colour is the only affordance:
 *   • rest            → text-text (active item: text-heading)
 *   • any sibling hovered → non-hovered rows fade to text-muted
 *   • the hovered row → text-heading
 * The "fade the rest" effect uses the `group/menu` marker on the parent <ul>
 * (see HamburgerMenuDrawer): group-hover mutes every row, then the row's own
 * :hover promotes it back to heading.
 */

import Icon from "@/components/Icon";
import { isActivePath } from "@/utils/navigation";

interface MobileMenuItemProps {
  title: string;
  url?: string;
  slug: string;
  children?: any[];
  openInNewTab?: boolean;
  currentPath: string;
  onNavigate: () => void;
  onOpenSubmenu?: (submenu: { title: string; items: any[] }) => void;
}

// Shared link typography (no colour, no underline). Colour is applied per-row
// below so the active row can carry a different resting colour.
const ITEM_CLASS = [
  "inline-flex w-auto max-w-full items-center justify-start",
  "py-2.5 text-left text-2xl font-normal leading-[1.18] lg:leading-[1.14]",
  "whitespace-normal text-balance",
  "transition-colors duration-300",
].join(" ");

// Colour states, layered by importance so precedence is deterministic (not
// dependent on Tailwind's utility source order):
//   • rest  → text-text, or text-heading for the active row
//   • any sibling hovered → this row mutes (group-hover, important beats rest)
//   • THIS row hovered    → heading (double-important beats the group-hover mute)
// `!` = Tailwind important; `text-heading!!`-style isn't a thing, so the hovered
// state uses an arbitrary property with !important to sit above the mute.
const COLOR_CLASS =
  "group-hover/menu:text-muted! [&:hover]:![color:var(--color-heading)]";

export default function MobileMenuItem({
  title,
  url,
  children = [],
  openInNewTab = false,
  currentPath,
  onNavigate,
  onOpenSubmenu,
}: MobileMenuItemProps) {
  const hasChildren = children.length > 0;
  // Active item = current page. It reads text-heading at rest; when a sibling
  // is hovered it mutes with the rest (group-hover), and returns to heading if
  // it's the one hovered — same rules as every row, just a brighter resting state.
  const isActive = isActivePath(url, currentPath);
  // Resting colour: active row is heading, the rest are text. COLOR_CLASS layers
  // the hover/group-hover states on top (both important, so they win over this).
  const restClass = isActive ? "text-heading" : "text-text";

  const openSubmenu = () => {
    if (!hasChildren) return;
    onOpenSubmenu?.({ title, items: children });
  };

  const handleParentClick = () => {
    if (url) {
      onNavigate();
      return;
    }
    openSubmenu();
  };

  if (hasChildren) {
    const sharedProps = {
      className: `${ITEM_CLASS} ${restClass} ${COLOR_CLASS}`,
      onClick: handleParentClick,
    };
    return (
      <li className="w-full max-w-full">
        <div className="inline-flex max-w-full items-center gap-2 align-top">
          {url ? (
            <a
              {...sharedProps}
              href={url}
              target={openInNewTab ? "_blank" : undefined}
              rel={openInNewTab ? "noopener noreferrer" : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              {title}
            </a>
          ) : (
            <button {...sharedProps} type="button">
              {title}
            </button>
          )}

          <button
            type="button"
            onClick={openSubmenu}
            aria-label={`View submenu for ${title}`}
            className="shrink-0 text-text transition-colors duration-300 hover:text-heading"
          >
            <Icon icon="lu:chevron-right" size="md" className="h-6 w-6" />
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="w-full max-w-full">
      <a
        href={url || "#"}
        onClick={onNavigate}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noopener noreferrer" : undefined}
        aria-current={isActive ? "page" : undefined}
        className={`${ITEM_CLASS} w-full ${restClass} ${COLOR_CLASS}`}
      >
        {title}
      </a>
    </li>
  );
}
