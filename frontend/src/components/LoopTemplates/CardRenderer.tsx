// src/components/LoopTemplates/CardRenderer.tsx
import FeatureCard from "@/components/LoopComponents/FeatureCard";
import type { FeatureCardData, FeatureCardProps } from "@/components/LoopComponents/FeatureCard";

type ColumnCount = 1 | 2 | 3 | 4;

export interface CardRendererProps {
  items?: FeatureCardData[];
  columns?: ColumnCount;
  className?: string;
  /** Enable body content rendering for all cards */
  showBody?: boolean;
  getCardClassName?: (item: FeatureCardData, index: number) => string;
  getRingDuration?: (item: FeatureCardData, index: number) => number;
  featureCardProps?: Partial<FeatureCardProps>;
  getFeatureCardProps?: (item: FeatureCardData, index: number) => Partial<FeatureCardProps>;
  disableStagger?: boolean;
  animation?: {
    type?: string | ((index: number) => string);
    once?: boolean;
    threshold?: number;
    rootMargin?: string;
  };
}

const columnClasses: Record<ColumnCount, string> = {
  1: "grid grid-cols-1 gap-8",
  2: "grid grid-cols-1 md:grid-cols-2 gap-8",
  3: "max-3-secondary",
  4: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8",
};

export default function CardRenderer({
  items = [],
  columns = 3,
  className = "",
  showBody = false,
  getCardClassName,
  getRingDuration,
  featureCardProps = {},
  getFeatureCardProps,
  disableStagger = false,
  animation,
}: CardRendererProps) {
  const safeItems = Array.isArray(items) ? (items as FeatureCardData[]) : [];

  // Enable stagger when we have 3+ cards (will show multiple columns on larger screens)
  const shouldStagger = !disableStagger && safeItems.length >= 3;
  const staggerDelay = 100; // ms between each card animation

  // Animation configuration
  const defaultAnimationType = "fade-in-up";
  const animationOnce = animation?.once ?? false;

  const getAnimationType = (index: number): string => {
    if (!animation?.type) return defaultAnimationType;
    if (typeof animation.type === "function") return animation.type(index);
    return animation.type;
  };

  // Calculate delay based on position in row, not overall index
  const getStaggerDelay = (index: number): number => {
    if (!shouldStagger) return 0;
    // Reset delay for each new row based on column count
    const positionInRow = index % columns;
    return positionInRow * staggerDelay;
  };

  const resolveClassName = (item: FeatureCardData, index: number): string => {
    if (typeof getCardClassName === "function") return getCardClassName(item, index);
    const record = item as Record<string, any>;
    return [record?.class, record?.className].filter(Boolean).join(" ");
  };

  const resolveRingDuration = (item: FeatureCardData, index: number): number => {
    if (typeof getRingDuration === "function") return getRingDuration(item, index);
    const record = item as Record<string, any>;
    return typeof record?.ringDuration === "number" ? record.ringDuration : 800;
  };

  const resolveFeatureCardProps = (item: FeatureCardData, index: number) => {
    const dynamicProps = typeof getFeatureCardProps === "function" ? getFeatureCardProps(item, index) : {};
    return {
      ...featureCardProps,
      ...dynamicProps,
    };
  };

  if (safeItems.length === 0) {
    return null;
  }

  return (
    <ul className={`${columnClasses[columns]} list-none ${className}`.trim()}>
      {safeItems.map((item, index) => {
        const delay = getStaggerDelay(index);
        const mergedProps = resolveFeatureCardProps(item, index);
        const {
          className: overrideClassName,
          ringDuration: overrideRingDuration,
          data: _ignoredData,
          ...restFeatureCardProps
        } = mergedProps ?? {};
        const resolvedClassName = [resolveClassName(item, index), overrideClassName]
          .filter(Boolean)
          .join(" ");
        const resolvedRingDuration =
          typeof overrideRingDuration === "number"
            ? overrideRingDuration
            : resolveRingDuration(item, index);

        const animationType = getAnimationType(index);

        // Extract body-related props from item if present
        const itemRecord = item as Record<string, any> | null | undefined;
        const contentSlotId = itemRecord?.contentSlotId;
        // Use renderer-level showBody, allow item-level override
        const itemShowBody = itemRecord?.showBody ?? showBody;

        return (
          <li
            key={index}
            className="h-full"
            data-animate={animationType}
            data-animate-once={animationOnce ? "true" : undefined}
            data-animate-delay={shouldStagger ? String(delay) : undefined}
            data-animate-threshold={animation?.threshold !== undefined ? String(animation.threshold) : undefined}
            data-animate-root-margin={animation?.rootMargin}
          >
            <FeatureCard
              data={item}
              ringDuration={resolvedRingDuration}
              className={resolvedClassName}
              showBody={itemShowBody}
              contentSlotId={contentSlotId}
              {...restFeatureCardProps}
            />
          </li>
        );
      })}
    </ul>
  );
}
