// src/components/Button/variants/MenuItemButton.tsx
/**
 * Menu Item Button Variant
 *
 * Styled as a large underlined text link rather than a button.
 * Uses link-specific styling classes instead of button classes.
 * Can still render as either <a> or <button> based on href.
 */

import { ButtonBase, type ButtonProps } from '../Button';
import { renderButtonIcon } from '../utils';

export default function MenuItemButton({
  leftIcon,
  rightIcon,
  className = '',
  size = 'lg',
  children,
  ...props
}: ButtonProps) {
  // Map size to link-specific classes (no padding like buttons)
  const sizeClass = size === 'sm' ? 'link-sm' : size === 'lg' ? 'link-lg' : 'link-md';
  const baseClasses = `link-base ${sizeClass} ${className}`.trim();

  return (
    <ButtonBase
      {...props}
      className={`${baseClasses} inline-flex w-auto items-center justify-start rounded-none px-0 py-2.5 font-normal text-2xl leading-[1.18] text-heading whitespace-normal text-balance transition-colors duration-300 lg:leading-[1.14]`}
      leftIcon={renderButtonIcon(leftIcon, size)}
      rightIcon={renderButtonIcon(rightIcon, size)}
      size={size}
      unstyled
    >
      {children}
    </ButtonBase>
  );
}
