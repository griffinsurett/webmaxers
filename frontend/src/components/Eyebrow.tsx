// src/components/Eyebrow.tsx
/**
 * Eyebrow — the single source of truth for the small uppercase gradient label
 * above section headings ("ABOUT", "WHY CHOOSE US?", "WORK", …). Every eyebrow
 * on the site flows through this one component.
 *
 * Style: eyebrow-text (size/tracking/uppercase) + font-light + the PRIMARY
 * gradient (secondary-primary-gradient). The primary scale is the accent blue in
 * dark mode and near-black in light mode, so the eyebrow stays WCAG-AA readable
 * in both themes. Change the eyebrow look for the whole site by editing this one
 * file. .astro callers render it directly (Astro compiles framework components to
 * static HTML when no client: directive is given).
 */
import Heading from "@/components/Heading";
import type { ReactNode } from "react";
import type * as ReactNamespace from "react";

type HeadingTag = Extract<
  keyof ReactNamespace.JSX.IntrinsicElements,
  keyof HTMLElementTagNameMap
>;

/** The one eyebrow class list — the single source of the eyebrow look. */
export const EYEBROW_CLASS =
  "eyebrow-text secondary-primary-gradient bg-clip-text text-transparent font-light! uppercase!";

export interface EyebrowProps {
  children: ReactNode;
  /** Optional extra classes (spacing, alignment, per-caller tweaks). */
  className?: string;
  /** Element tag to render. Default <span> (so it can sit inside a heading block). */
  as?: HeadingTag;
  [key: string]: unknown;
}

export default function Eyebrow({
  children,
  className = "",
  as = "span",
  ...rest
}: EyebrowProps) {
  return (
    // Caller className comes FIRST so its layout extras (spacing, alignment)
    // apply, then the identity classes come LAST with important flags so
    // casing/weight/gradient can never be overridden — the eyebrow is ALWAYS the
    // uppercase logo style.
    <Heading tagName={as} className={`${className} ${EYEBROW_CLASS}`} {...rest}>
      {children}
    </Heading>
  );
}
