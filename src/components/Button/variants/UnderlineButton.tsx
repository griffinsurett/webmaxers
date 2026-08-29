// src/components/Button/variants/UnderlineButton.tsx
// Ported from webmaxers for the AboutSection port. Underlined text CTA whose
// underline sweeps out and back in on hover; arrow nudges up-right.
import { ButtonBase, type ButtonProps } from '../Button';
import { renderButtonIcon } from '../utils';

export default function UnderlineButton({
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
        'group relative inline-flex items-center justify-between gap-8',
        // Never stretch full-width: cap the width and don't let a flex/grid
        // parent stretch it, so the underline tracks the content, not the column.
        'w-fit max-w-xs self-start',
        'eyebrow-text font-medium text-text',
        'pb-[6px]',
        'hover:text-heading',
        'transition-colors duration-500',
        'p-0 rounded-none focus:ring-0 focus:ring-offset-0',
        // Underline as a pseudo-element so it can sweep out and back in on hover.
        'after:content-[""] after:absolute after:left-0 after:bottom-0 after:w-full after:h-px after:bg-current',
        'hover:after:animate-underline-sweep',
        // Arrow motion: diagonal up-right on hover.
        '[&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:translate-x-[0.16rem] hover:[&_svg]:-translate-y-[0.16rem]',
        className,
      ].join(' ')}
      leftIcon={leftIcon}
      // Defaults to the up-right arrow, but an explicit `null` suppresses it —
      // `??` alone would treat null as "not supplied" and re-add the arrow,
      // leaving no way to opt out (an in-place action like "Reject All" should
      // not carry a leaves-the-page arrow).
      rightIcon={renderButtonIcon(
        rightIcon === null ? undefined : rightIcon ?? 'lu:arrow-up-right',
        size,
      )}
    >
      {children}
    </ButtonBase>
  );
}
