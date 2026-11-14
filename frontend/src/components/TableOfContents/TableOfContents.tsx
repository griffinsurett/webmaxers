import { useEffect, useMemo, useState } from "react";

interface TocItem {
  id: string;
  text: string;
  level: number;
  element: HTMLElement;
}

interface TocGroup {
  parent: TocItem;
  children: TocItem[];
}

export interface TableOfContentsProps {
  id?: string;
  className?: string;
  contentId: string;
  title?: string;
  headingSelector?: string;
  scrollOffset?: number;
  emptyLabel?: string;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

const defaultSelector = "h2, h3";

export default function TableOfContents({
  id,
  className = "",
  contentId,
  title = "Table of Contents",
  headingSelector = defaultSelector,
  scrollOffset = 140,
  emptyLabel = "Headings will appear here automatically.",
}: TableOfContentsProps) {
  const navId = id ?? `${contentId}-toc`;
  const listId = `${navId}-list`;

  const [groups, setGroups] = useState<TocGroup[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const selector = useMemo(() => {
    return headingSelector
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ") || defaultSelector;
  }, [headingSelector]);

  useEffect(() => {
    const contentEl = document.getElementById(contentId);
    if (!contentEl) return;

    const headingNodes = Array.from(
      contentEl.querySelectorAll<HTMLElement>(selector),
    )
      .map((element, index) => {
        const text = element.textContent?.trim();
        if (!text) return null;
        const level =
          Number.parseInt(element.tagName.replace("H", ""), 10) || 2;
        if (!element.id) {
          element.id = `${contentId}-${slugify(text)}-${index}`;
        }
        element.dataset.tocAnchor = element.id;
        return { id: element.id, text, level, element };
      })
      .filter(Boolean) as TocItem[];

    const grouped: TocGroup[] = [];
    headingNodes.forEach((node) => {
      if (node.level <= 2 || grouped.length === 0) {
        grouped.push({ parent: node, children: [] });
      } else {
        grouped[grouped.length - 1]!.children.push(node);
      }
    });

    setGroups(grouped);

    if (headingNodes.length > 0) {
      setActiveId((prev) => prev ?? headingNodes[0]!.id);
    }

    if (headingNodes.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-45% 0px -45% 0px",
        threshold: 0.15,
      },
    );

    headingNodes.forEach(({ element }) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, [contentId, selector]);

  useEffect(() => {
    if (groups.length === 0) return;
    setOpenGroups(() => {
      const next: Record<string, boolean> = {};
      groups.forEach((group, index) => {
        next[group.parent.id] = index === 0;
      });
      return next;
    });
  }, [groups]);

  useEffect(() => {
    if (!activeId || groups.length === 0) return;
    const owningGroup = groups.find(
      (group) =>
        group.parent.id === activeId ||
        group.children.some((child) => child.id === activeId),
    );
    if (!owningGroup) return;

    setOpenGroups(() => {
      const next: Record<string, boolean> = {};
      groups.forEach((group) => {
        next[group.parent.id] = group.parent.id === owningGroup.parent.id;
      });
      return next;
    });
  }, [activeId, groups]);

  const scrollToHeading = (itemId: string) => {
    const heading = document.getElementById(itemId);
    if (!heading) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const top =
      heading.getBoundingClientRect().top + window.scrollY - scrollOffset;

    window.scrollTo({
      top,
      behavior: prefersReducedMotion.matches ? "auto" : "smooth",
    });

    setActiveId(itemId);
    history.replaceState(null, "", `#${itemId}`);
  };

  const handleParentClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    groupId: string,
  ) => {
    event.preventDefault();
    setOpenGroups(() => {
      const next: Record<string, boolean> = {};
      groups.forEach((group) => {
        next[group.parent.id] = group.parent.id === groupId;
      });
      return next;
    });
    scrollToHeading(groupId);
  };

  const handleChildClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    itemId: string,
  ) => {
    event.preventDefault();
    scrollToHeading(itemId);
  };

  const tocContent = (
    <ol id={listId} className="m-0 list-none p-0">
      {groups.length === 0 ? (
        <li className="px-5 py-5 text-sm text-text md:px-6">{emptyLabel}</li>
      ) : (
        groups.map((group) => {
          const groupId = group.parent.id;
          const isOpen = Boolean(openGroups[groupId]);
          const parentActive =
            activeId === groupId ||
            group.children.some((child) => child.id === activeId);
          const childListId = `${groupId}-children`;

          return (
            <li
              key={groupId}
              className="list-none border-t border-border-soft first:border-t-0"
            >
              <button
                type="button"
                className={`flex w-full items-start justify-between gap-3 px-5 py-5 text-left text-lg leading-[1.45] no-underline transition-colors duration-200 md:px-6 md:py-6 md:text-[1.05rem] ${
                  parentActive
                    ? "bg-bg text-heading"
                    : "text-text hover:bg-bg3/30 hover:text-text focus-visible:bg-bg3/30 focus-visible:text-heading"
                }`}
                aria-expanded={isOpen}
                aria-controls={childListId}
                onClick={(event) => handleParentClick(event, groupId)}
              >
                <span className="flex-1 text-left leading-[1.45]">
                  {group.parent.text}
                </span>
              </button>

              {group.children.length > 0 && (
                <ol
                  id={childListId}
                  className={`${isOpen ? "flex" : "hidden"} m-0 list-none flex-col gap-3 border-t border-border-soft bg-bg2/35 px-5 py-4 md:px-6`}
                  aria-hidden={!isOpen}
                >
                  {group.children.map((child) => {
                    const isChildActive = child.id === activeId;
                    return (
                      <li key={child.id} className="list-none">
                        <a
                          href={`#${child.id}`}
                          className={`flex items-start gap-3 text-[0.95rem] leading-[1.45] no-underline transition-colors duration-200 hover:text-primary focus-visible:text-primary ${
                            isChildActive
                              ? "font-semibold text-heading"
                              : "text-text"
                          }`}
                          aria-current={isChildActive}
                          onClick={(event) =>
                            handleChildClick(event, child.id)
                          }
                        >
                          <span className="flex-1 text-left leading-tight">{child.text}</span>
                        </a>
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          );
        })
      )}
    </ol>
  );

  return (
    <nav
      id={navId}
      className={`hidden lg:block ${className}`.trim()}
      aria-label={title}
    >
      <div className="overflow-hidden rounded-[1.35rem] border border-border-soft bg-black/25 shadow-[0_22px_60px_-45px_rgba(0,0,0,0.65)]">
        <div className="border-b border-border-soft px-5 py-5 md:px-6">
          <p className="text-left text-[0.82rem] font-medium uppercase tracking-[0.24em] text-heading">
            {title}
          </p>
        </div>
        <div>{tocContent}</div>
      </div>
    </nav>
  );
}
