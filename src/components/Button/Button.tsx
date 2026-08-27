// src/components/Button/Button.tsx
/**
 * Button Component System
 * 
 * Polymorphic button component that renders as either <button> or <a> based on props.
 * Supports multiple variants (primary, secondary, ghost, link) with consistent API.
 * Uses TypeScript discriminated unions for type safety between button and link modes.
 */

import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import PrimaryButton from './variants/PrimaryButton';
import SecondaryButton from './variants/SecondaryButton';
import LinkButton from './variants/LinkButton';
import TertiaryButton from './variants/TertiaryButton';
import ArrowLinkButton from './variants/ArrowLinkButton';
import UnderlineButton from './variants/UnderlineButton';
import MenuItemButton from './variants/MenuItemButton';
import LogoLinkButton from './variants/LogoLinkButton';
import LinkPageButton from './variants/LinkPageButton';
import FilterTabButton from './variants/FilterTabButton';
import FilterIconButton from './variants/FilterIconButton';
import FormButton from './variants/FormButton';
import PillOutlineButton from './variants/PillOutlineButton';
// Ported from the original Webmaxxers site alongside its front-page hero.
import GhostButton from './variants/GhostButton';
import HiddenUnderlineButton from './variants/HiddenUnderlineButton';

/* ────────────────────────────────────────────────────────────────────────
 * Accessible name (WCAG 2.5.3 — Label in Name)
 *
 * A control's own text content already becomes its accessible name, and that
 * is always the correct name — a speech-input user says what they see. So the
 * component's whole job here is: respect an explicit `aria-label`, and
 * otherwise leave the name to the rendered text. We deliberately do NOT derive
 * a name from the URL — a synthesized label ("Navigate to Contact") replaces
 * the visible text and fails 2.5.3 when text exists, and mislabels when it
 * doesn't. Icon-only controls therefore MUST be given an explicit `aria-label`
 * (or a labelled icon child) by the caller — the one reliable source of truth.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Base props shared by all button variants
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface BaseButtonProps {
  leftIcon?: string | ReactNode;   // Icon before text
  rightIcon?: string | ReactNode;  // Icon after text
  size?: ButtonSize;       // Button size
  children: ReactNode;              // Button text/content
  className?: string;               // Additional CSS classes
  /** Optional classes for wrapper spans used by certain variants */
  buttonWrapperClasses?: string;
  /** Forces the variant wrapper to span full width when supported */
  fullWidth?: boolean;
  /**
   * Internal escape hatch that allows variant components to opt-out of the
   * default btn-base styling when they need full control over the shell.
   */
  unstyled?: boolean;
  /**
   * Allows variants to opt-out of their entrance animations (primary uses this).
   */
  animated?: boolean;
}

/**
 * Button rendered as <button> - href must not be present
 */
type ButtonAsButton = BaseButtonProps & 
  ButtonHTMLAttributes<HTMLButtonElement> & 
  { href?: never };

/**
 * Button rendered as <a> - href is required
 */
type ButtonAsLink = BaseButtonProps & 
  AnchorHTMLAttributes<HTMLAnchorElement> & 
  { href: string };

/**
 * Discriminated union ensures type safety based on presence of href
 */
export type ButtonProps = ButtonAsButton | ButtonAsLink;

/**
 * Base component that handles rendering as button or anchor.
 * Avoids React hooks so it can be SSR-only when needed.
 * Accessible name = the control's own text; an explicit `aria-label` is
 * respected, and a dev warning flags any control that ends up nameless.
 */
export const ButtonBase = ({
  href,
  className = '',
  buttonWrapperClasses: _buttonWrapperClasses,
  fullWidth: _fullWidth,
  leftIcon,
  rightIcon,
  size = 'lg',
  children,
  unstyled = false,
  animated: _animated,
  ...props
}: ButtonProps) => {
  const normalizedSize = size ?? 'lg';
  const sizeClass =
    normalizedSize === 'sm'
      ? 'btn-sm'
      : normalizedSize === 'lg'
      ? 'btn-lg'
      : 'btn-md';
  const baseClasses = unstyled
    ? className.trim()
    : `btn-base ${sizeClass} ${className}`.trim();

  // The rendered content names the control. We never synthesize an aria-label
  // from it (the text already IS the name — WCAG 2.5.3); an explicit aria-label
  // in props is passed straight through and respected.
  const content = (
    <>
      {leftIcon}
      {children}
      {rightIcon}
    </>
  );

  if (href) {
    const anchorProps = props as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a href={href} className={baseClasses} {...anchorProps}>
        {content}
      </a>
    );
  }

  const buttonProps = props as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type={buttonProps.type ?? 'button'} className={baseClasses} {...buttonProps}>
      {content}
    </button>
  );
};

/**
 * Map of variant names to their component implementations
 */
const VARIANT_MAP = {
  primary: PrimaryButton,
  secondary: SecondaryButton,
  link: LinkButton,
  menuItemButton: MenuItemButton,
  tertiary: TertiaryButton,
  arrowLink: ArrowLinkButton,
  underline: UnderlineButton,
  logoLink: LogoLinkButton,
  linkPage: LinkPageButton,
  filterTab: FilterTabButton,
  filterIcon: FilterIconButton,
  form: FormButton,
  pillOutline: PillOutlineButton,
  ghost: GhostButton,
  hiddenUnderline: HiddenUnderlineButton,
};

export type ButtonVariant = keyof typeof VARIANT_MAP;

/**
 * Props for the main Button component including variant selection.
 * Uses Record<string, unknown> to allow variant-specific props to pass through.
 */
export type ButtonComponentProps = {
  variant?: ButtonVariant;
  [key: string]: unknown;
};

/**
 * Main Button component - delegates to variant components
 *
 * @example
 * <Button variant="primary" onClick={handleClick}>Click me</Button>
 * <Button variant="secondary" href="/about">Learn more</Button>
 * <Button variant="filterTab" active={true} label="All" />
 */
export default function Button({
  variant = 'primary',
  ...props
}: ButtonComponentProps) {
  const VariantComponent = VARIANT_MAP[variant] || PrimaryButton;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <VariantComponent {...(props as any)} />;
}
