// src/components/Button/utils.tsx
import { isValidElement, type CSSProperties, type ReactNode } from 'react';
import Icon from '@/components/Icon';
import type { IconSize } from '@/integrations/icons';
import type { ButtonSize } from './Button';

function mapButtonSizeToIconSize(size?: ButtonSize): IconSize {
  return size ?? 'md';
}

function normalizeButtonIcon(icon: string): string {
  const arrowIcons = new Set([
    'lu:arrow-right',
    'lucide:arrow-right',
    'fa6-solid:arrow-right',
    'arrow-right',
  ]);

  return arrowIcons.has(icon) ? 'lu:arrow-up-right' : icon;
}

export function renderButtonIcon(
  icon: string | ReactNode | undefined,
  size?: ButtonSize,
  /** Optional inline style for the rendered <Icon> — e.g. an SVG gradient paint
   *  from `useIconGradient()`. Only applies when `icon` is a name string; an
   *  already-built element is passed through untouched. */
  style?: CSSProperties
): ReactNode {
  if (!icon) return null;

  const iconSize = mapButtonSizeToIconSize(size);
  if (isValidElement(icon)) return icon;
  if (typeof icon === 'string') {
    return <Icon icon={normalizeButtonIcon(icon)} size={iconSize} style={style} />;
  }
  return null;
}

const BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

export function getButtonBaseClasses(size?: ButtonSize): string {
  const normalizedSize = size ?? 'lg';

  return [
    'inline-flex items-center justify-center gap-2',
    'rounded-full font-semibold',
    'button-style',
    'button-transition',
    'button-hover-transition',
    'focus-visible:outline-none',
    'w-full lg:w-auto',
    'disabled:opacity-60 disabled:cursor-not-allowed',
    BUTTON_SIZE_CLASSES[normalizedSize],
  ]
    .filter(Boolean)
    .join(' ');
}
