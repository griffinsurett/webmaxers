// src/components/Button/variants/SecondaryButton.tsx
// The site's secondary CTA: underlined text whose underline sweeps out and back
// in on hover; the arrow nudges up-right. (Formerly the `underline` variant —
// it replaced the old bordered-pill secondary site-wide.)
import { ButtonBase, type ButtonProps } from '../Button';
import { renderButtonIcon } from '../utils';

export default function SecondaryButton({
  className = '',
  size = 'md',
  children,
  rightIcon,
  leftIcon,
  fullWidth = false,
  ...props
}: ButtonProps) {
  // The up-right arrow means "this takes you somewhere", so it's the default
  // only for links. In-place actions (Reject All, Cookie Settings) get no arrow
  // unless one is passed; an explicit `null` suppresses it on a link too.
  const defaultIcon = props.href ? 'lu:arrow-up-right' : undefined;

  return (
    <ButtonBase
      {...props}
      size={size}
      className={[
        'group relative inline-flex items-center justify-between gap-8',
        // By default never stretch: cap the width and don't let a flex/grid
        // parent stretch it, so the underline tracks the content, not the
        // column. `fullWidth` opts into spanning the container instead.
        fullWidth ? 'w-full self-stretch' : 'w-fit max-w-xs self-start',
        'eyebrow-text font-medium text-text',
        'pb-[6px]',
        'hover:text-heading',
        'transition-colors duration-500',
        'p-0 rounded-none focus:ring-0 focus:ring-offset-0',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        // Underline as a pseudo-element so it can sweep out and back in on hover.
        'after:content-[""] after:absolute after:left-0 after:bottom-0 after:w-full after:h-px after:bg-current',
        'hover:after:animate-underline-sweep',
        // Arrow motion: diagonal up-right on hover.
        '[&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:translate-x-[0.16rem] hover:[&_svg]:-translate-y-[0.16rem]',
        className,
      ].join(' ')}
      leftIcon={renderButtonIcon(leftIcon, size)}
      rightIcon={renderButtonIcon(
        rightIcon === null ? undefined : rightIcon ?? defaultIcon,
        size,
      )}
    >
      {children}
    </ButtonBase>
  );
}
