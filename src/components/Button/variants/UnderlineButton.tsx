// src/components/Button/variants/UnderlineButton.tsx
import { ButtonBase, type ButtonProps } from '../Button';

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
        'text-[11px] font-medium tracking-[0.18em] uppercase text-zinc-400',
        'border-b border-zinc-400 pb-[6px]',
        'hover:text-white hover:border-white',
        'transition-colors duration-200',
        'p-0 rounded-none focus:ring-0 focus:ring-offset-0',
        className,
      ].join(' ')}
      leftIcon={leftIcon}
      rightIcon={
        rightIcon ?? (
          <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
        )
      }
    >
      {children}
    </ButtonBase>
  );
}
