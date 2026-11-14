// src/components/LoopComponents/IconListItem.tsx
import {
  isValidElement,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import Icon from "@/components/Icon";
import type { IconType } from "@/content/schema";
import type { IconSize } from "@/integrations/icons";

type Layout = "vertical" | "horizontal" | "horizontal-reverse" | "horizontal-stacked" | "horizontal-stacked-responsive";
type Alignment = "center" | "left" | "right";
type TitleTag =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "div"
  | "span"
  | "p";
type DescriptionTag = "p" | "div" | "span";

interface IconRenderConfig {
  icon: IconType;
  size?: IconSize;
  className?: string;
  color?: string;
  ariaLabel?: string;
}

type IconValue = ReactNode | IconType | IconRenderConfig;

interface IconListData {
  icon?: IconValue;
  image?: { src?: string; alt?: string } | string;
  title?: ReactNode;
  description?: ReactNode;
}

export interface IconListItemProps {
  data: IconListData;
  layout?: Layout;
  alignment?: Alignment;
  className?: string;
  containerClassName?: string;
  iconClassName?: string;
  iconInnerClassName?: string;
  iconStyle?: CSSProperties;
  iconSize?: IconSize;
  imageClassName?: string;
  imageLoading?: "lazy" | "eager";
  titleClassName?: string;
  titleTag?: TitleTag;
  descriptionClassName?: string;
  descriptionTag?: DescriptionTag;
  showIcon?: boolean;
  showImage?: boolean;
  showTitle?: boolean;
  showDescription?: boolean;
}

export default function IconListItem({
  data,
  layout = "vertical",
  alignment = "center",
  className = "",
  containerClassName = "",
  iconClassName = "card-icon-color",
  iconInnerClassName = "",
  iconStyle,
  iconSize = "lg",
  imageClassName = "w-12 h-12 rounded-full object-cover flex-shrink-0",
  imageLoading = "lazy",
  titleClassName = "h4",
  titleTag = "h3",
  descriptionClassName = "text-text text-sm",
  descriptionTag = "p",
  showIcon = true,
  showImage = false,
  showTitle = true,
  showDescription = true,
}: IconListItemProps) {
  const { icon, image, title, description } = data;

  const layouts: Record<Layout, string> = {
    vertical: "flex flex-col",
    horizontal: "flex items-center",
    "horizontal-reverse": "flex items-start flex-row-reverse",
    "horizontal-stacked": "flex flex-col",
    "horizontal-stacked-responsive": "flex flex-col",
  };

  const alignments: Record<Alignment, string> = {
    center: "text-center",
    left: "text-left",
    right: "text-right",
  };

  const iconSizeClasses: Record<IconSize, string> = {
    sm: "icon-small",
    md: "icon-medium",
    lg: "icon-large",
    xl: "icon-large",
    "2xl": "icon-2xl",
    "3xl": "icon-3xl",
  };

  const resolvedIconClassName = [
    iconSizeClasses[iconSize],
    iconClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const TitleTagComponent = titleTag as ElementType;
  const DescriptionTagComponent = descriptionTag as ElementType;

  const fallbackAlt =
    (typeof title === "string" && title) ||
    (typeof description === "string" && description) ||
    "Icon image";

  const imageContent = (() => {
    if (!showImage || !image) return null;
    const imageSrc = typeof image === "string" ? image : image?.src;
    if (!imageSrc) return null;
    const imageAlt =
      (typeof image === "string" ? undefined : image?.alt) || fallbackAlt;

    return (
      <div className={imageClassName}>
        <img
          src={imageSrc}
          alt={imageAlt}
          className="w-full h-full object-cover"
          loading={imageLoading}
        />
      </div>
    );
  })();

  const titleContent =
    showTitle && title ? (
      <TitleTagComponent className={titleClassName}>{title}</TitleTagComponent>
    ) : null;

  const descriptionContent =
    showDescription && description ? (
      <DescriptionTagComponent className={descriptionClassName}>
        {description}
      </DescriptionTagComponent>
    ) : null;

  const iconContent = (() => {
    if (!showIcon || showImage || !icon) return null;

    const isIconConfig =
      typeof icon === "object" &&
      icon !== null &&
      !Array.isArray(icon) &&
      !isValidElement(icon) &&
      "icon" in icon;

    const isRenderableIcon =
      typeof icon === "string" ||
      (typeof icon === "object" &&
        icon !== null &&
        !Array.isArray(icon) &&
        !isValidElement(icon) &&
        !isIconConfig);

    const getWrapperProps = (label?: string) =>
      label && label.length > 0
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": "true" as const };

    if (isIconConfig) {
      const { icon: iconName, size, className: customClass = "", color, ariaLabel } =
        icon as IconRenderConfig;
      return (
        <div className={`shrink-0 ${resolvedIconClassName}`} {...getWrapperProps(ariaLabel)}>
          <Icon
            icon={iconName}
            size={size ?? iconSize}
            className={[customClass, iconInnerClassName].filter(Boolean).join(" ")}
            color={color}
            style={iconStyle}
            aria-label={ariaLabel}
          />
        </div>
      );
    }

    if (isRenderableIcon) {
      return (
        <div className={`shrink-0 ${resolvedIconClassName}`} aria-hidden="true">
          <Icon
            icon={icon as IconType}
            size={iconSize}
            className={iconInnerClassName}
            style={iconStyle}
          />
        </div>
      );
    }

    return (
      <div className={`shrink-0 ${resolvedIconClassName}`} aria-hidden="true">
        {icon}
      </div>
    );
  })();

  // Responsive layout: stacked on mobile, horizontal on md+
  if (layout === "horizontal-stacked-responsive") {
    return (
      <div className={`${alignments[alignment]} ${className}`.trim()}>
        {imageContent}
        {/* Mobile: stacked layout */}
        <div className="flex flex-col md:hidden">
          <div className={`flex items-center ${containerClassName}`}>
            {iconContent}
            {titleContent}
          </div>
          {descriptionContent}
        </div>
        {/* Desktop: horizontal layout */}
        <div className="hidden md:flex md:items-center">
          {iconContent}
          <div className={containerClassName}>
            {titleContent}
            {descriptionContent}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${layouts[layout]} ${alignments[alignment]} ${className}`.trim()}>
      {imageContent}

      {layout === "horizontal-stacked" ? (
        <>
          <div className={`flex items-center ${containerClassName}`}>
            {iconContent}
            {titleContent}
          </div>
          {descriptionContent}
        </>
      ) : (
        <>
          {iconContent}

          {layout.includes("horizontal") ? (
            <div className={containerClassName}>
              {titleContent}
              {descriptionContent}
            </div>
          ) : (
            <>
              {titleContent}
              {descriptionContent}
            </>
          )}
        </>
      )}
    </div>
  );
}
