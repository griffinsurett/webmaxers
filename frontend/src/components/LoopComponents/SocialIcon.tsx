// src/components/LoopComponents/SocialIcon.tsx
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

const DIMENSION_MAP: Record<SocialIconSize, string> = {
  sm: "h-12 w-12",
  md: "h-14 w-14",
  lg: "h-16 w-16",
};

export default function SocialIcon({
  title,
  url,
  icon = "lu:globe",
  size = "md",
  onClick,
  ariaLabel,
}: SocialIconProps) {
  const wrapperClass = `${DIMENSION_MAP[size]} ${PADDING_MAP[size]} inline-flex items-center justify-center text-muted transition-all duration-200 hover:bg-bg3 hover:text-heading focus-visible:bg-bg3 focus-visible:text-heading`;
  const iconSize = ICON_SIZE_MAP[size];
  const resolvedAriaLabel = ariaLabel ?? (url ? `Visit our ${title}` : title);

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
        <Icon icon={icon} size={iconSize} className="text-current" />
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
        <Icon icon={icon} size={iconSize} className="text-current" />
      </button>
    );
  }

  return (
    <div className={wrapperClass} title={title}>
      <Icon icon={icon} size={iconSize} className="text-current" />
    </div>
  );
}
