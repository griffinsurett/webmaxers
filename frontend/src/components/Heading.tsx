import type { HTMLAttributes, ReactNode } from "react";
import type * as ReactNamespace from "react";
import type { HeadingContent } from "@/content/schema";

type HeadingTag = Extract<
  keyof ReactNamespace.JSX.IntrinsicElements,
  keyof HTMLElementTagNameMap
>;

interface HeadingSegmentProps {
  id?: string;
  className?: string;
  [key: string]: unknown;
}

interface HeadingProps extends HTMLAttributes<HTMLElement> {
  className?: string;
  tagName?: HeadingTag;
  before?: ReactNode;
  text?: ReactNode;
  after?: ReactNode;
  beforeClass?: string;
  textClass?: string;
  afterClass?: string;
  beforeId?: string;
  textId?: string;
  afterId?: string;
  beforeProps?: HeadingSegmentProps;
  textProps?: HeadingSegmentProps;
  afterProps?: HeadingSegmentProps;
  segmented?: HeadingContent | null;
  children?: ReactNode;
}

export default function Heading({
  tagName: Tag = "h2",
  className = "",
  before,
  text,
  after,
  beforeClass = "",
  textClass = "",
  afterClass = "",
  beforeId,
  textId,
  afterId,
  beforeProps,
  textProps,
  afterProps,
  segmented,
  children,
  ...props
}: HeadingProps) {
  const tagLevel = typeof Tag === "string" ? Tag.toLowerCase() : "h2";
  const isHeadingTag = ["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagLevel);
  const hasManualHeadingClass = /\bh[1-6]\b/.test(className);
  const finalClassName =
    hasManualHeadingClass || !isHeadingTag
      ? className
      : `${tagLevel} ${className}`.trim();

  const isPropBased =
    before !== undefined || text !== undefined || after !== undefined;
  const hasSegmented =
    segmented !== undefined && segmented !== null;

  const mergeProps = (
    idFromProp: string | undefined,
    clsFromProp: string,
    bag?: HeadingSegmentProps
  ) => {
    const bagSafe = bag ?? {};
    const mergedClass = [clsFromProp, bagSafe.className]
      .filter(Boolean)
      .join(" ");
    return {
      id: idFromProp ?? bagSafe.id,
      ...bagSafe,
      className: mergedClass || undefined,
    };
  };

  const TagComponent = Tag as HeadingTag;

  return (
    <TagComponent className={`${finalClassName} capitalize`} {...props}>
      {hasSegmented ? (
        <>
          {segmented?.before !== undefined && (
            <span {...mergeProps(beforeId, beforeClass, beforeProps)}>
              {`${segmented.before} `}
            </span>
          )}
          {segmented?.text !== undefined && (
            <span {...mergeProps(textId, textClass, textProps)}>
              {`${segmented.text} `}
            </span>
          )}
          {segmented?.after !== undefined && (
            <span {...mergeProps(afterId, afterClass, afterProps)}>
              {segmented.after}
            </span>
          )}
        </>
      ) : isPropBased ? (
        <>
          {before !== undefined && (
            <>
              <span {...mergeProps(beforeId, beforeClass, beforeProps)}>
                {before}
              </span>
              {" "}
            </>
          )}
          {text !== undefined && (
            <>
              <span {...mergeProps(textId, textClass, textProps)}>{text}</span>
              {" "}
            </>
          )}
          {after !== undefined && (
            <span {...mergeProps(afterId, afterClass, afterProps)}>
              {after}
            </span>
          )}
        </>
      ) : (
        children
      )}
    </TagComponent>
  );
}
