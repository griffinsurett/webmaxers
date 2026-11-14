import Button from "@/components/Button/Button";
import { type AnchorHTMLAttributes, type ReactNode } from "react";
import type { IconType } from "@/content/schema";

type LinkCardData =
  | {
      icon?: ReactNode | IconType;
      title?: ReactNode;
      url?: string;
      target?: string;
      rel?: string;
      openInNewTab?: boolean;
    }
  | Record<string, unknown>
  | null
  | undefined;

export interface LinkCardProps {
  data?: LinkCardData;
  className?: string;
  linkProps?: AnchorHTMLAttributes<HTMLAnchorElement>;
  showIcon?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasContent = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
};

const pickValue = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (hasContent(value)) return value;
  }
  return undefined;
};

const resolveCardData = (data: LinkCardData) => {
  if (!isRecord(data)) return {};

  return {
    icon: pickValue(data, ["icon", "Icon", "iconName"]),
    title: pickValue(data, ["title", "name", "heading", "label"]),
    url: pickValue(data, ["url"]),
    target: pickValue(data, ["target"]),
    rel: pickValue(data, ["rel"]),
    openInNewTab: pickValue(data, ["openInNewTab"]),
  };
};

export default function LinkCard({
  data,
  className = "",
  linkProps,
  showIcon = true,
}: LinkCardProps) {
  const { icon, title, url, target, rel, openInNewTab } = resolveCardData(data);
  const cardUrl =
    typeof url === "string" && url.trim().length > 0 ? url.trim() : undefined;
  const explicitTarget =
    typeof linkProps?.target === "string" && linkProps.target.trim().length > 0
      ? linkProps.target.trim()
      : typeof target === "string" && target.trim().length > 0
        ? target.trim()
        : undefined;
  const shouldOpenInNewTab =
    explicitTarget === "_blank" ||
    openInNewTab === true ||
    (typeof cardUrl === "string" && /^https?:\/\//i.test(cardUrl));
  const finalTarget = explicitTarget ?? (shouldOpenInNewTab ? "_blank" : undefined);
  const finalRel =
    typeof linkProps?.rel === "string" && linkProps.rel.trim().length > 0
      ? linkProps.rel.trim()
      : typeof rel === "string" && rel.trim().length > 0
        ? rel.trim()
        : shouldOpenInNewTab
          ? "noopener noreferrer"
          : undefined;
  const isInteractive = Boolean(cardUrl);
  const resolvedIcon = showIcon
    ? hasContent(icon)
      ? (icon as ReactNode | IconType)
      : "fa6-solid:link"
    : undefined;
  const buttonClassName = [
    "w-full",
    className,
    typeof linkProps?.className === "string" ? linkProps.className : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    isInteractive ? (
      <Button
        {...linkProps}
        variant="linkPage"
        href={cardUrl}
        target={finalTarget}
        rel={finalRel}
        leftIcon={resolvedIcon}
        size="sm"
        className={buttonClassName}
      >
        {title}
      </Button>
    ) : (
      <div className={buttonClassName}>
        <Button
          variant="linkPage"
          leftIcon={resolvedIcon}
          size="sm"
          className="cursor-default"
          type="button"
          disabled
        >
          {title}
        </Button>
      </div>
    )
  );
}
