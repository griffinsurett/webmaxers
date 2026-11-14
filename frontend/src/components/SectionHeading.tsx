// src/components/SectionHeading.tsx
/**
 * SectionHeading — the ONE "top of section" component: eyebrow + heading +
 * description. Every section and every ContentRenderer variant renders its
 * header through this. Change the section-header look for the whole site here.
 *
 * eyebrow → <Eyebrow> (theme-safe primary gradient, single source).
 * heading → <Heading> (plain, segmented before/emphasis/after, or a
 *           HeadingContent object).
 * description → <p>. Plain prose by default; only exposed to AT as a heading
 *           when a caller explicitly sets descriptionAsHeading={true}.
 *
 * .tsx hybrid: usable from .tsx directly and from .astro (no client directive
 * needed — it's static; data-animate attrs are read from the DOM by the
 * scroll-animations integration).
 */
import Eyebrow from "@/components/Eyebrow";
import Heading from "@/components/Heading";
import type { ReactNode } from "react";
import type * as ReactNamespace from "react";
import type { HeadingContent } from "@/content/schema";

type HeadingTag = Extract<
  keyof ReactNamespace.JSX.IntrinsicElements,
  keyof HTMLElementTagNameMap
>;

export interface SectionHeadingProps {
  /** Eyebrow label (alias: `title`). */
  eyebrow?: ReactNode;
  /** Alias for `eyebrow` — kept so existing callers passing `title` keep working. */
  title?: ReactNode;
  eyebrowClassName?: string;
  /** Alias for `eyebrowClassName`. */
  titleClassName?: string;
  heading?: ReactNode | HeadingContent | null;
  headingBefore?: ReactNode;
  headingEmphasis?: ReactNode;
  headingAfter?: ReactNode;
  headingTag?: HeadingTag;
  headingClassName?: string;
  emphasisClassName?: string;
  description?: ReactNode;
  descriptionClassName?: string;
  /** Treat description as a heading (adds role/aria-level). Opt-in only — defaults to false. */
  descriptionAsHeading?: boolean;
  /** Heading level used when description is treated as heading. */
  descriptionHeadingLevel?: number;
  className?: string;
  headerProps?: Record<string, unknown>;
  animateHeading?: boolean;
  animateDescription?: boolean;
  animateOnce?: boolean;
}

const isHeadingContent = (value: unknown): value is HeadingContent => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const hasKeys = "before" in record || "text" in record || "after" in record;
  const looksLikeReactElement = "props" in record && "type" in record;
  return hasKeys && !looksLikeReactElement;
};

export default function SectionHeading({
  eyebrow,
  title,
  eyebrowClassName,
  titleClassName,
  heading,
  headingBefore,
  headingEmphasis,
  headingAfter,
  headingTag = "h2",
  headingClassName = "h2 mb-6",
  emphasisClassName = "emphasized-text",
  description,
  descriptionClassName = "large-text",
  descriptionAsHeading,
  descriptionHeadingLevel,
  className = "text-section",
  headerProps = {},
  animateHeading = false,
  animateDescription = false,
  animateOnce = true,
}: SectionHeadingProps) {
  const eyebrowLabel = eyebrow ?? title;
  const eyebrowClasses = eyebrowClassName ?? titleClassName ?? "";
  const headingContent = isHeadingContent(heading) ? heading : undefined;

  const hasSegmentedHeading =
    headingBefore !== undefined ||
    headingEmphasis !== undefined ||
    headingAfter !== undefined;

  const hasContentHeading = headingContent !== undefined;
  const hasPlainHeading =
    !hasContentHeading && heading !== undefined && heading !== null;

  const headingLevelFromTag = (() => {
    if (typeof headingTag !== "string") return 2;
    const match = headingTag.match(/h([1-6])/i);
    return match ? Number(match[1]) : 2;
  })();

  // Only expose the description as a heading when a caller EXPLICITLY opts in
  // (descriptionAsHeading={true}). Previously this was inferred from the
  // `large-text` style class, which let styling drive semantics — every card
  // section's prose description became a fake role="heading", polluting the
  // screen-reader heading outline (WCAG 1.3.1). Audited all 7 large-text
  // callers: none rely on the heading role (each already has a real `heading`).
  const shouldTreatDescriptionAsHeading = Boolean(
    description && descriptionAsHeading === true
  );

  const resolvedDescriptionHeadingLevel =
    descriptionHeadingLevel ?? Math.min(headingLevelFromTag + 1, 6);

  const headingAnim = animateHeading
    ? { "data-animate": "fade-in", "data-animate-once": String(animateOnce) }
    : {};

  return (
    <div className={className}>
      {eyebrowLabel && (
        <div className="inline-block mb-3">
          <Eyebrow className={eyebrowClasses}>{eyebrowLabel}</Eyebrow>
        </div>
      )}

      {hasContentHeading ? (
        <div {...headingAnim}>
          <Heading
            tagName={headingTag}
            className={headingClassName}
            segmented={headingContent}
            textClass={emphasisClassName}
            {...headerProps}
          />
        </div>
      ) : hasSegmentedHeading ? (
        <div {...headingAnim}>
          <Heading
            tagName={headingTag}
            className={headingClassName}
            before={headingBefore}
            text={headingEmphasis}
            after={headingAfter}
            textClass={emphasisClassName}
            {...headerProps}
          />
        </div>
      ) : (
        hasPlainHeading && (
          <div {...headingAnim}>
            <Heading
              tagName={headingTag}
              className={headingClassName}
              {...headerProps}
            >
              {heading as ReactNode}
            </Heading>
          </div>
        )
      )}

      {description && (
        <p
          className={descriptionClassName}
          {...(animateDescription
            ? {
                "data-animate": "fade-in",
                "data-animate-once": String(animateOnce),
              }
            : {})}
          role={shouldTreatDescriptionAsHeading ? "heading" : undefined}
          aria-level={
            shouldTreatDescriptionAsHeading
              ? resolvedDescriptionHeadingLevel
              : undefined
          }
        >
          {description}
        </p>
      )}
    </div>
  );
}
