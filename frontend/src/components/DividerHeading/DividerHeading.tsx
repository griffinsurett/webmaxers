// src/components/DividerHeading/DividerHeading.tsx
/**
 * DividerHeading Component
 *
 * Reusable heading block with optional gradient divider + description.
 * Keeps heading presentation consistent wherever it's used.
 */
import { createElement, type ReactNode } from "react";

export interface DividerHeadingProps {
  title?: ReactNode;
  description?: ReactNode;
  tag?: keyof JSX.IntrinsicElements;
  showDivider?: boolean;
  className?: string;
  headingClassName?: string;
  descriptionClassName?: string;
  dividerClassName?: string;
}

export default function DividerHeading({
  title,
  description,
  tag = "h2",
  showDivider = true,
  className = "",
  headingClassName = "h4 text-heading",
  descriptionClassName = "text-text max-w-3xl",
  dividerClassName = "inline-flex h-1 rounded-full primary-gradient w-20",
}: DividerHeadingProps) {
  if (!title && !description) return null;

  const gapClass =
    showDivider || description ? "gap-3" : "gap-2";

  return (
    <div className={`flex flex-col ${gapClass} ${className}`.trim()}>
      {title &&
        createElement(
          tag,
          { className: headingClassName },
          title,
        )}
      {showDivider && (
        <span
          className={dividerClassName}
          aria-hidden="true"
        />
      )}
      {description && (
        <p className={descriptionClassName}>{description}</p>
      )}
    </div>
  );
}
