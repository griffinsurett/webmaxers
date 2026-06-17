// src/components/Button/variants/UnderlineButton.tsx
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
        'group inline-flex items-center justify-between gap-8',
        // Never stretch full-width: cap the width and don't let a flex/grid
        // parent stretch it, so the underline tracks the content, not the column.
        'w-fit max-w-xs self-start',
        'eyebrow-text font-medium text-text',
        'border-b border-text pb-[6px]',
        'hover:text-primary hover:border-primary',
        'transition-colors duration-500',
        'p-0 rounded-none focus:ring-0 focus:ring-offset-0',
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
