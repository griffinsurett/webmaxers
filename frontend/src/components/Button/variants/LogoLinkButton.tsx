// src/components/Button/variants/LogoLinkButton.tsx
/**
 * Logo Link Button Variant
 *
 * Text link that reveals an animated logo icon rolling from the left on hover.
 * The logo slides in from the left using CSS transform animations.
 */

import { ButtonBase, type ButtonProps } from '../Button';
import Logo from "@/assets/GWS-animated.png"

export default function LogoLinkButton({
  className = '',
  size = 'md',
  children,
  ...props
}: ButtonProps) {
  // Map size to link-specific classes
  const sizeClass = size === 'sm' ? 'link-sm' : size === 'lg' ? 'link-lg' : 'link-md';
  const baseClasses = `logo-link-base ${sizeClass} ${className}`.trim();

  return (
    <ButtonBase
      {...props}
      className={baseClasses}
      leftIcon={
        <span className="logo-link-icon">
          <img
            src={Logo.src}
            alt=""
            aria-hidden="true"
            className="w-5 h-5"
          />
        </span>
      }
      size={size}
      unstyled
    >
      <span className="logo-link-text">{children}</span>
    </ButtonBase>
  );
}
