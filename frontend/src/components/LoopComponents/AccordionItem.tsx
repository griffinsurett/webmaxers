// src/components/LoopComponents/AccordionItem.tsx
import type { ReactNode } from "react";
import type { IconType } from "@/content/schema";
import AnimatedBorder from "@/components/AnimatedBorder/AnimatedBorder";
import IconListItem from "@/components/LoopComponents/IconListItem";
import Icon from "@/components/Icon";

export interface AccordionItemProps {
  id: string;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  isExpanded: boolean;
  onToggle: () => void;
  headerClassName?: string;
  headerSlot?: ReactNode;
  showIndicator?: boolean;
  indicatorIcons?: {
    expanded?: IconType;
    collapsed?: IconType;
  };
}

export default function AccordionItem({
  id,
  title,
  description,
  className = "",
  children,
  isExpanded,
  onToggle,
  headerClassName = "h5",
  headerSlot,
  showIndicator = true,
  indicatorIcons,
}: AccordionItemProps) {
  const expandedIcon = indicatorIcons?.expanded ?? "lucide:minus";
  const collapsedIcon = indicatorIcons?.collapsed ?? "lucide:plus";

  return (
    <div
      className={`group relative ${className}`.trim()}
      data-accordion-item
      data-active={isExpanded ? "true" : "false"}
    >
      <AnimatedBorder
        variant="progress-b-f"
        triggers="controlled"
        active={isExpanded}
        borderRadius="rounded-3xl"
        borderWidth={2}
        duration={800}
        className="transition-all duration-200 overflow-hidden"
        innerClassName="card-bg"
      >
        <button
          type="button"
          id={`${id}-trigger`}
          aria-expanded={isExpanded}
          aria-controls={`${id}-content`}
          className={`w-full text-left flex items-center justify-between px-6 py-5 hover:bg-transparent transition-colors duration-300 cursor-pointer relative z-20 ${headerClassName}`.trim()}
          onClick={onToggle}
        >
          {headerSlot ? (
            <div className="flex-1">{headerSlot}</div>
          ) : (
            <IconListItem
              data={{ title }}
              layout="horizontal"
              alignment="left"
              className="gap-4 flex-1"
              titleTag="h3"
              showDescription={false}
            />
          )}

          {showIndicator && (
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 text-lg font-semibold ${
                isExpanded
                  ? "bg-primary text-bg"
                  : "faded-bg border border-soft-strong text-accent"
              }`}
              aria-hidden="true"
            >
              <Icon
                icon={isExpanded ? expandedIcon : collapsedIcon}
                size="sm"
                className="w-4 h-4"
              />
            </div>
          )}
        </button>

        <div
          id={`${id}-content`}
          role="region"
          aria-labelledby={`${id}-trigger`}
          className={`overflow-hidden transition-all duration-500 ease-in-out relative z-20 ${
            isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="px-6 pb-6">
            <div className="w-full h-px bg-primary/15 mb-4" />
            {description && (
              <p className="text-text leading-relaxed mb-4">{description}</p>
            )}
            {children}
          </div>
        </div>
      </AnimatedBorder>
    </div>
  );
}
