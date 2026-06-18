// src/components/LoopComponents/SocialIcon.tsx
/**
 * Social Icon (React)
 *
 * React counterpart of SocialIcon.astro, for use inside client components such
 * as the mobile menu drawer footer. Visual style matches the .astro version:
 * circular surface background, hover scale, size variants.
 */

import Icon from "@/components/Icon";
import type { IconType } from "@/content/schema";
import type { IconSize } from "@/integrations/icons";

type SocialIconSize = "sm" | "md" | "lg";

export interface SocialIconProps {
  title: string;
  url?: string;
  icon?: IconType;
  size?: SocialIconSize;
  onClick?: () => void;
  ariaLabel?: string;
}

const PADDING_MAP: Record<SocialIconSize, string> = {
  sm: "p-2",
  md: "p-2.5",
  lg: "p-3",
};

const ICON_SIZE_MAP: Record<SocialIconSize, IconSize> = {
  sm: "sm",
  md: "md",
  lg: "lg",
};

export default function SocialIcon({
  title,
  url,
  icon = "lu:globe",
  size = "md",
  onClick,
  ariaLabel,
}: SocialIconProps) {
  const wrapperClass = `${PADDING_MAP[size]} bg-surface hover:bg-primary/10 rounded-full inline-flex items-center justify-center transition-all duration-200 hover:scale-110`;
  const iconSize = ICON_SIZE_MAP[size];
  const resolvedAriaLabel = ariaLabel ?? (url ? `Visit our ${title} page` : title);

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={wrapperClass}
        aria-label={resolvedAriaLabel}
        title={title}
      >
        <Icon icon={icon} size={iconSize} className="text-text" />
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={wrapperClass}
        aria-label={resolvedAriaLabel}
        title={title}
      >
        <Icon icon={icon} size={iconSize} className="text-text" />
      </button>
    );
  }

  return (
    <div className={wrapperClass} title={title}>
      <Icon icon={icon} size={iconSize} className="text-text" />
    </div>
  );
}
