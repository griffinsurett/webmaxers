import { useEffect, useRef, useState } from "react";
import { animationProps } from "@/integrations/scroll-animations";

interface FaqAccordionItemData {
  id?: string;
  title: string;
  contentSlotId: string;
}

interface FaqAccordionProps {
  items: FaqAccordionItemData[];
  allowMultiple?: boolean;
  className?: string;
}

export default function FaqAccordion({
  items,
  allowMultiple = false,
  className = "",
}: FaqAccordionProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const panelRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!allowMultiple) next.clear();
        next.add(id);
      }

      return next;
    });
  };

  useEffect(() => {
    expandedItems.forEach((itemId) => {
      const panel = panelRefs.current.get(itemId);
      const item = items.find((entry, index) => (entry.id || `item-${index}`) === itemId);

      if (panel && item?.contentSlotId && panel.children.length === 0) {
        const hiddenContent = document.getElementById(item.contentSlotId);

        if (hiddenContent) {
          const clone = hiddenContent.cloneNode(true) as HTMLElement;
          clone.style.display = "";
          clone.removeAttribute("id");
          panel.appendChild(clone);
        }
      }
    });
  }, [expandedItems, items]);

  return (
    <div className={`border-t border-border ${className}`.trim()}>
      {items.map((item, index) => {
        const itemId = item.id || `item-${index}`;
        const isExpanded = expandedItems.has(itemId);

        return (
          <div
            key={itemId}
            className="border-b border-border"
            {...animationProps("fade-in-up", { once: false })}
          >
            <button
              type="button"
              id={`${itemId}-trigger`}
              aria-expanded={isExpanded}
              aria-controls={`${itemId}-content`}
              className="group flex w-full items-center justify-between gap-6 py-7 text-left text-heading transition-colors duration-200 md:py-9"
              onClick={() => toggleItem(itemId)}
            >
              <span className="text-[1.7rem] font-normal leading-[1.15] tracking-[-0.03em] md:text-[2.1rem]">
                {item.title}
              </span>
              <span
                className="relative flex h-10 w-10 shrink-0 items-center justify-center text-[2.1rem] font-extralight text-muted transition-transform duration-300 group-hover:text-heading"
                aria-hidden="true"
              >
                <span className="absolute h-px w-7 bg-current" />
                <span
                  className={`absolute h-7 w-px bg-current transition-transform duration-300 ${
                    isExpanded ? "scale-y-0" : "scale-y-100"
                  }`}
                />
              </span>
            </button>

            <div
              id={`${itemId}-content`}
              role="region"
              aria-labelledby={`${itemId}-trigger`}
              className={`overflow-hidden transition-[max-height,opacity] duration-500 ease-out ${
                isExpanded ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="max-w-4xl pb-8 pr-14 text-lg leading-relaxed text-text md:pb-10">
                <div
                  ref={(el) => {
                    if (el) panelRefs.current.set(itemId, el);
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
