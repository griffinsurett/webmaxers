// src/components/Button/Button.tsx
/**
 * Button Component System
 * 
 * Polymorphic button component that renders as either <button> or <a> based on props.
 * Supports multiple variants (primary, secondary, ghost, link) with consistent API.
 * Uses TypeScript discriminated unions for type safety between button and link modes.
 */

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import PrimaryButton from './variants/PrimaryButton';
import SecondaryButton from './variants/SecondaryButton';
import GhostButton from './variants/GhostButton';
import LinkButton from './variants/LinkButton';
import TertiaryButton from './variants/TertiaryButton';
import UnderlineButton from './variants/UnderlineButton';
import HiddenUnderlineButton from './variants/HiddenUnderlineButton';
import MenuItemButton from './variants/MenuItemButton';

/**
 * Base props shared by all button variants
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface BaseButtonProps {
  leftIcon?: string | ReactNode;
  rightIcon?: string | ReactNode;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
  buttonWrapperClasses?: string;
  fullWidth?: boolean;
  /**
   * Internal escape hatch that allows variant components to opt-out of the
   * default btn-base styling when they need full control over the shell.
   */
  unstyled?: boolean;
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
 * Base component that handles rendering as button or anchor
 * Uses forwardRef to allow ref passing to underlying element
 */
export const ButtonBase = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ href, className = '', leftIcon, rightIcon, size = 'md', children, unstyled = false, ...props }, ref) => {
    // Map size prop to Tailwind classes
    const normalizedSize = size ?? 'md';
    const sizeClass =
      normalizedSize === 'sm'
        ? 'btn-sm'
        : normalizedSize === 'lg'
        ? 'btn-lg'
        : 'btn-md';
    // `unstyled` variants (e.g. menuItemButton) take full control of the shell.
    const baseClasses = unstyled
      ? className.trim()
      : `btn-base ${sizeClass} ${className}`.trim();

    // Render as anchor if href is provided
    if (href) {
      const { href: linkHref, ...anchorProps } = props as AnchorHTMLAttributes<HTMLAnchorElement>;
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={baseClasses}
          {...anchorProps}
        >
          {leftIcon}
          {children}
          {rightIcon}
        </a>
      );
    }

    // Otherwise render as button
    const buttonProps = props as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={baseClasses}
        {...buttonProps}
      >
        {leftIcon}
        {children}
        {rightIcon}
      </button>
    );
  }
);

ButtonBase.displayName = 'ButtonBase';

/**
 * Map of variant names to their component implementations
 */
const VARIANT_MAP = {
  primary: PrimaryButton,
  secondary: SecondaryButton,
  ghost: GhostButton,
  link: LinkButton,
  tertiary: TertiaryButton,
  underline: UnderlineButton,
  hiddenUnderline: HiddenUnderlineButton,
  menuItemButton: MenuItemButton,
};

export type ButtonVariant = keyof typeof VARIANT_MAP;

/**
 * Props for the main Button component including variant selection
 */
export type ButtonComponentProps = ButtonProps & {
  variant?: ButtonVariant;
};

/**
 * Main Button component - delegates to variant components
 * 
 * @example
 * <Button variant="primary" onClick={handleClick}>Click me</Button>
 * <Button variant="secondary" href="/about">Learn more</Button>
 */
export default function Button({ 
  variant = 'primary',
  ...props 
}: ButtonComponentProps) {
  const VariantComponent = VARIANT_MAP[variant] || PrimaryButton;
  return <VariantComponent {...props} />;
}
