import AnimatedBorder from "../AnimatedBorder/AnimatedBorder";
import IconListItem, { type IconListItemProps } from "./IconListItem";
import {
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

type IconValue = IconListItemProps["data"]["icon"];

export type NumberCardData =
  | (IconListItemProps["data"] & { data?: Record<string, unknown> })
  | Record<string, unknown>
  | null
  | undefined;

export interface NumberCardProps {
  data?: NumberCardData;
  icon?: IconValue;
  image?: IconListItemProps["data"]["image"];
  title?: ReactNode;
  description?: ReactNode;
  stepNumber?: number | string;
  hideDisplayNumber?: boolean;
  linkProps?: AnchorHTMLAttributes<HTMLAnchorElement>;
  className?: string;
  innerClassName?: string;
  ringDuration?: number;
  listItemProps?: Partial<Omit<IconListItemProps, "data">>;
  stretchToFill?: boolean;
  showBody?: boolean;
  contentSlotId?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

const ICON_KEYS = ["icon", "Icon", "iconName"];
const TITLE_KEYS = ["title", "name", "heading", "label"];
const DESCRIPTION_KEYS = ["description", "summary", "excerpt", "body", "content"];
const IMAGE_KEYS = ["image", "img", "media"];
const URL_KEYS = ["url"];
const TARGET_KEYS = ["target"];
const REL_KEYS = ["rel"];
const OPEN_IN_NEW_TAB_KEYS = ["openInNewTab"];
const ORDER_KEYS = ["stepNumber", "step", "order", "index"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasContent = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
};

const collectDataSources = (
  input: NumberCardData,
  seen = new Set<Record<string, unknown>>()
): Record<string, unknown>[] => {
  if (!isRecord(input) || seen.has(input)) return [];
  seen.add(input);
  const record = input as Record<string, unknown>;
  const nestedSources = collectDataSources(record.data as NumberCardData, seen);
  return [...nestedSources, record];
};

const pickValue = (sources: Record<string, unknown>[], keys: string[]) => {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (hasContent(value)) return value;
    }
  }
  return undefined;
};

const createOverrideSource = ({
  icon,
  image,
  title,
  description,
  stepNumber,
}: {
  icon?: IconValue;
  image?: IconListItemProps["data"]["image"];
  title?: ReactNode;
  description?: ReactNode;
  stepNumber?: number | string;
}) => {
  const overrides: Record<string, unknown> = {};
  if (hasContent(icon)) overrides.icon = icon;
  if (hasContent(image)) overrides.image = image;
  if (hasContent(title)) overrides.title = title;
  if (hasContent(description)) overrides.description = description;
  if (hasContent(stepNumber)) overrides.stepNumber = stepNumber;
  return Object.keys(overrides).length > 0 ? overrides : undefined;
};

type NormalizedPayload = {
  content: IconListItemProps["data"];
  url?: string;
  target?: string;
  rel?: string;
  openInNewTab?: boolean;
  displayNumber?: string;
};

const formatDisplayNumber = (value: unknown): string | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.max(1, value)).padStart(2, "0");
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const trimmed = value.trim();
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return String(Math.max(1, numeric)).padStart(2, "0");
    }
    return trimmed;
  }
  return undefined;
};

const normalizeNumberCardData = (
  sources: Record<string, unknown>[]
): NormalizedPayload => {
  const icon = pickValue(sources, ICON_KEYS);
  const title = pickValue(sources, TITLE_KEYS);
  const description = pickValue(sources, DESCRIPTION_KEYS);
  const image = pickValue(sources, IMAGE_KEYS);
  const urlValue = pickValue(sources, URL_KEYS);
  const targetValue = pickValue(sources, TARGET_KEYS);
  const relValue = pickValue(sources, REL_KEYS);
  const openInNewTabValue = pickValue(sources, OPEN_IN_NEW_TAB_KEYS);
  const displayNumber = formatDisplayNumber(pickValue(sources, ORDER_KEYS));
  const url =
    typeof urlValue === "string" && urlValue.trim().length > 0
      ? urlValue
      : undefined;
  const target =
    typeof targetValue === "string" && targetValue.trim().length > 0
      ? targetValue.trim()
      : undefined;
  const rel =
    typeof relValue === "string" && relValue.trim().length > 0
      ? relValue.trim()
      : undefined;
  const openInNewTab =
    typeof openInNewTabValue === "boolean" ? openInNewTabValue : undefined;

  const normalized: IconListItemProps["data"] = {};
  if (icon !== undefined) normalized.icon = icon as IconValue;
  if (image !== undefined) normalized.image = image as IconListItemProps["data"]["image"];
  if (title !== undefined) normalized.title = title as ReactNode;
  if (description !== undefined) normalized.description = description as ReactNode;

  return {
    content: normalized,
    ...(url ? { url } : {}),
    ...(target ? { target } : {}),
    ...(rel ? { rel } : {}),
    ...(typeof openInNewTab === "boolean" ? { openInNewTab } : {}),
    ...(displayNumber ? { displayNumber } : {}),
  };
};

const EMPTY_PAYLOAD: NormalizedPayload = { content: {} };

export default function NumberCard({
  data,
  icon,
  image,
  title,
  description,
  stepNumber,
  hideDisplayNumber = false,
  linkProps,
  className = "",
  innerClassName = "",
  ringDuration = 800,
  listItemProps,
  stretchToFill = false,
  showBody = false,
  contentSlotId,
  bodyClassName = "",
  children,
}: NumberCardProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [hasRenderedBody, setHasRenderedBody] = useState(false);

  useEffect(() => {
    if (!showBody || !contentSlotId || !bodyRef.current) return;
    if (bodyRef.current.children.length > 0) return;

    const hiddenContent = document.getElementById(contentSlotId);
    if (!hiddenContent) {
      setHasRenderedBody(false);
      return;
    }

    const hasMeaningfulContent =
      hiddenContent.childElementCount > 0 ||
      (hiddenContent.textContent?.trim().length ?? 0) > 0 ||
      hiddenContent.innerHTML.trim().length > 0;

    if (!hasMeaningfulContent) {
      setHasRenderedBody(false);
      return;
    }

    const clone = hiddenContent.cloneNode(true) as HTMLElement;
    clone.style.display = "";
    clone.removeAttribute("id");
    bodyRef.current.appendChild(clone);
    setHasRenderedBody(true);
  }, [showBody, contentSlotId]);

  const overrideSource = createOverrideSource({ icon, image, title, description, stepNumber });
  const dataSources = [
    ...(overrideSource ? [overrideSource] : []),
    ...collectDataSources(data),
  ];
  const {
    content: resolvedData,
    url: resolvedUrl,
    target: resolvedTarget,
    rel: resolvedRel,
    openInNewTab,
    displayNumber,
  } =
    dataSources.length > 0 ? normalizeNumberCardData(dataSources) : EMPTY_PAYLOAD;

  const cardUrl =
    typeof resolvedUrl === "string" && resolvedUrl.trim().length > 0
      ? resolvedUrl.trim()
      : undefined;
  const explicitTarget =
    typeof linkProps?.target === "string" && linkProps.target.trim().length > 0
      ? linkProps.target.trim()
      : typeof resolvedTarget === "string" && resolvedTarget.length > 0
        ? resolvedTarget
        : undefined;
  const shouldOpenInNewTab =
    explicitTarget === "_blank" ||
    openInNewTab === true ||
    (typeof cardUrl === "string" && /^https?:\/\//i.test(cardUrl));
  const finalTarget = explicitTarget ?? (shouldOpenInNewTab ? "_blank" : undefined);
  const finalRel =
    typeof linkProps?.rel === "string" && linkProps.rel.trim().length > 0
      ? linkProps.rel.trim()
      : typeof resolvedRel === "string" && resolvedRel.length > 0
        ? resolvedRel
        : shouldOpenInNewTab
          ? "noopener noreferrer"
          : undefined;
  const isInteractive = Boolean(cardUrl);

  const {
    layout,
    alignment,
    iconClassName,
    iconSize,
    titleClassName,
    titleTag,
    descriptionClassName,
    descriptionTag,
    ...restListItemProps
  } = listItemProps ?? {};

  const resolvedLayout = layout ?? "vertical";
  const resolvedAlignment = alignment ?? (resolvedLayout.includes("horizontal") ? "left" : "center");
  const defaultIconClassName = resolvedLayout.includes("horizontal")
    ? "icon-large z-10 card-icon-color mx-auto"
    : "icon-large z-10 mb-5 card-icon-color mx-auto";

  const listItemConfig: Omit<IconListItemProps, "data"> = {
    layout: resolvedLayout,
    alignment: resolvedAlignment,
    iconClassName: iconClassName ?? defaultIconClassName,
    iconSize: iconSize ?? "xl",
    titleClassName: titleClassName ?? "h3 mb-3 relative z-10",
    titleTag: titleTag ?? "h3",
    descriptionClassName:
      descriptionClassName ?? "text-text leading-relaxed relative z-10",
    descriptionTag: descriptionTag ?? "p",
    ...restListItemProps,
    showImage: hasRenderedBody ? false : restListItemProps.showImage,
  };

  const innerCardClass =
    resolvedLayout.includes("horizontal")
      ? "lg:h-55 w-full px-4 md:px-8 py-6 relative flex flex-col justify-center items-center overflow-hidden card-bg"
      : "min-h-90 mx-auto px-6 md:px-10 py-8 flex flex-col justify-center items-center relative overflow-hidden card-bg";

  const resolvedInnerCardClass = [
    stretchToFill ? "h-full" : "",
    innerCardClass,
    innerClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const wrapperTextClass = resolvedLayout.includes("horizontal") ? "text-left" : "text-center";
  const hoverLift = !resolvedLayout.includes("horizontal") && isInteractive ? "hover:-translate-y-3" : "";
  const wrapperClassName = [
    isInteractive ? "group" : "",
    stretchToFill ? "h-full" : "",
    wrapperTextClass,
    "outer-card-transition",
    hoverLift,
    "!duration-[900ms]",
    "ease-out",
  ]
    .filter(Boolean)
    .join(" ");

  const shouldRenderBodyContainer = showBody || Boolean(children);
  const shouldRenderBody = hasRenderedBody || Boolean(children);
  const displayNumberWrapClassName = resolvedLayout.includes("horizontal")
    ? "justify-start"
    : "justify-center lg:justify-start";

  return (
    <div className={className}>
      <AnimatedBorder
        variant={isInteractive ? "progress-b-f" : "none"}
        triggers={isInteractive ? "hover" : []}
        duration={ringDuration}
        borderRadius="rounded-3xl"
        borderWidth={2}
        className={wrapperClassName}
        innerClassName={resolvedInnerCardClass}
        linkProps={
          isInteractive
            ? {
                ...linkProps,
                href: cardUrl,
                target: finalTarget,
                rel: finalRel,
              }
            : undefined
        }
      >
        <div className="inner-card-style inner-card-transition inner-card-color" />
        {!hideDisplayNumber && displayNumber && (
          <div className={`relative z-10 mb-5 flex w-full ${displayNumberWrapClassName}`.trim()}>
            <span
              aria-hidden="true"
              className="inline-flex items-center rounded-full border border-soft-strong bg-primary/12 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-primary shadow-[0_12px_30px_rgba(32,60,170,0.18)] backdrop-blur-sm"
            >
              Step {displayNumber}
            </span>
          </div>
        )}
        {shouldRenderBodyContainer && (
          <div
            className={[
              "relative z-10 mb-6 w-full max-w-[16rem] mx-auto lg:mx-0",
              shouldRenderBody ? "" : "hidden",
              bodyClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div ref={bodyRef} />
            {children}
          </div>
        )}
        <IconListItem
          data={resolvedData}
          {...listItemConfig}
        />
      </AnimatedBorder>
    </div>
  );
}
