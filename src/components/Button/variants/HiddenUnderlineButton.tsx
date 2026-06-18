// src/components/Button/variants/HiddenUnderlineButton.tsx
// Like UnderlineButton, but the underline is HIDDEN at rest and only appears on
// hover — sweeping in (and back out when you leave). The regular UnderlineButton
// (always underlined) is unchanged.
import { ButtonBase, type ButtonProps } from '../Button';
import { renderButtonIcon } from '../utils';

export default function HiddenUnderlineButton({
  className = '',
  size = 'md',
  children,
  rightIcon,
  leftIcon,
  ...props
}: ButtonProps) {
  return (
    <ButtonBase
      {...props}
      size={size}
      className={[
        'group relative inline-flex items-center justify-start gap-2',
        // Never stretch full-width: cap the width so the underline tracks the
        // content, not the column.
        'w-fit max-w-xs self-start',
        'eyebrow-text font-medium text-text',
        'pb-[6px]',
        'hover:text-heading',
        'transition-colors duration-500',
        'p-0 rounded-none focus:ring-0 focus:ring-offset-0',
        // Underline pseudo-element — hidden at rest (scaleX 0), sweeps in on hover.
        'after:content-[""] after:absolute after:left-0 after:bottom-0 after:w-full after:h-px after:bg-current',
        'after:origin-left after:scale-x-0 after:transition-transform after:duration-500 after:ease-out',
        'hover:after:scale-x-100',
        // griffinswebservices arrow motion: diagonal up-right on hover.
        '[&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:translate-x-[0.16rem] hover:[&_svg]:-translate-y-[0.16rem]',
        className,
      ].join(' ')}
      leftIcon={leftIcon}
      rightIcon={renderButtonIcon(rightIcon ?? 'lu:arrow-up-right', size)}
    >
      {children}
    </ButtonBase>
  );
}
