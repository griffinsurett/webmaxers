// src/components/LoopComponents/Menu/MobileMenuItem.tsx
/**
 * Mobile Menu Item Component
 *
 * Drill-down menu item for mobile navigation. Parents with children open a
 * nested level (via onOpenSubmenu) rather than expanding inline.
 * Accessible navigation pattern with proper ARIA.
 */

import Button from "@/components/Button/Button";
import Icon from "@/components/Icon";

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

export default function MobileMenuItem({
  title,
  url,
  children = [],
  openInNewTab = false,
  onNavigate,
  onOpenSubmenu,
}: MobileMenuItemProps) {
  const hasChildren = children.length > 0;

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
    return (
      <li className="w-full max-w-full">
        <div className="inline-flex max-w-full items-center gap-2 align-top">
          <Button
            variant="menuItemButton"
            className="max-w-full text-left"
            onClick={handleParentClick}
            {...(url
              ? {
                  href: url,
                  target: openInNewTab ? "_blank" : undefined,
                  rel: openInNewTab ? "noopener noreferrer" : undefined,
                }
              : { type: "button" as const })}
          >
            {title}
          </Button>

          <button
            type="button"
            onClick={openSubmenu}
            aria-label={`View submenu for ${title}`}
            className="shrink-0 text-text"
          >
            <Icon icon="lu:chevron-right" size="md" className="w-6 h-6" />
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="w-full max-w-full">
      <Button
        variant="menuItemButton"
        href={url || "#"}
        onClick={onNavigate}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noopener noreferrer" : undefined}
        className="inline-flex w-full max-w-full text-left"
      >
        {title}
      </Button>
    </li>
  );
}
