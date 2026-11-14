import NumberCard from "@/components/LoopComponents/NumberCard";
import type { NumberCardData, NumberCardProps } from "@/components/LoopComponents/NumberCard";

type ColumnCount = 1 | 2 | 3 | 4;

export interface NumberCardRendererProps {
  items?: NumberCardData[];
  columns?: ColumnCount;
  className?: string;
  showBody?: boolean;
  getCardClassName?: (item: NumberCardData, index: number) => string;
  getRingDuration?: (item: NumberCardData, index: number) => number;
  numberCardProps?: Partial<NumberCardProps>;
  getNumberCardProps?: (item: NumberCardData, index: number) => Partial<NumberCardProps>;
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

export default function NumberCardRenderer({
  items = [],
  columns = 3,
  className = "",
  showBody = false,
  getCardClassName,
  getRingDuration,
  numberCardProps = {},
  getNumberCardProps,
  disableStagger = false,
  animation,
}: NumberCardRendererProps) {
  const safeItems = Array.isArray(items) ? (items as NumberCardData[]) : [];
  const shouldStagger = !disableStagger && safeItems.length >= 3;
  const staggerDelay = 100;
  const defaultAnimationType = "fade-in-up";
  const animationOnce = animation?.once ?? false;

  const getAnimationType = (index: number): string => {
    if (!animation?.type) return defaultAnimationType;
    if (typeof animation.type === "function") return animation.type(index);
    return animation.type;
  };

  const getStaggerDelay = (index: number): number => {
    if (!shouldStagger) return 0;
    const positionInRow = index % columns;
    return positionInRow * staggerDelay;
  };

  const resolveClassName = (item: NumberCardData, index: number): string => {
    if (typeof getCardClassName === "function") return getCardClassName(item, index);
    const record = item as Record<string, any>;
    return [record?.class, record?.className].filter(Boolean).join(" ");
  };

  const resolveRingDuration = (item: NumberCardData, index: number): number => {
    if (typeof getRingDuration === "function") return getRingDuration(item, index);
    const record = item as Record<string, any>;
    return typeof record?.ringDuration === "number" ? record.ringDuration : 800;
  };

  const resolveNumberCardProps = (item: NumberCardData, index: number) => {
    const dynamicProps =
      typeof getNumberCardProps === "function" ? getNumberCardProps(item, index) : {};
    return {
      ...numberCardProps,
      ...dynamicProps,
    };
  };

  if (safeItems.length === 0) return null;

  return (
    <ul className={`${columnClasses[columns]} list-none ${className}`.trim()}>
      {safeItems.map((item, index) => {
        const delay = getStaggerDelay(index);
        const mergedProps = resolveNumberCardProps(item, index);
        const {
          className: overrideClassName,
          ringDuration: overrideRingDuration,
          data: _ignoredData,
          ...restNumberCardProps
        } = mergedProps ?? {};
        const resolvedClassName = [resolveClassName(item, index), overrideClassName]
          .filter(Boolean)
          .join(" ");
        const resolvedRingDuration =
          typeof overrideRingDuration === "number"
            ? overrideRingDuration
            : resolveRingDuration(item, index);
        const animationType = getAnimationType(index);
        const itemRecord = item as Record<string, any> | null | undefined;
        const contentSlotId = itemRecord?.contentSlotId;
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
            <NumberCard
              data={item}
              ringDuration={resolvedRingDuration}
              className={resolvedClassName}
              showBody={itemShowBody}
              contentSlotId={contentSlotId}
              {...restNumberCardProps}
            />
          </li>
        );
      })}
    </ul>
  );
}
