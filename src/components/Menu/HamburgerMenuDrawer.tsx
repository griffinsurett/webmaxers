// src/components/Menu/HamburgerMenuDrawer.tsx
/**
 * Mobile Menu Drawer
 *
 * Full-screen mobile menu with drill-down submenu navigation (forward/back
 * slide), an in-drawer footer (social + legal + utility buttons), and body
 * scroll lock. Hydrates on hover/touch for instant interactivity.
 */

import { useCallback, useEffect, useState } from "react";
import Modal from "@/components/Modal";
import MobileMenuItem from "@/components/LoopComponents/Menu/MobileMenuItem";
import HamburgerButton from "./HamburgerButton";
import HorizontalLegalFooter from "@/components/Footer/HorizontalLegalFooter";
import type { IconType } from "@/content/schema";

interface MobileMenuDrawerProps {
  items: any[];
  currentPath: string;
  socialLinks?: Array<{
    title: string;
    url?: string;
    icon?: IconType;
  }>;
  className?: string;
  hamburgerTransform?: boolean;
  closeButton?: boolean;
}

interface MenuLevel {
  title: string;
  items: any[];
}

export default function MobileMenuDrawer({
  items,
  currentPath,
  socialLinks = [],
  className = "",
  hamburgerTransform = true,
  closeButton = false,
}: MobileMenuDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStack, setMenuStack] = useState<MenuLevel[]>(() => [
    { title: "Main Menu", items },
  ]);

  const resetMenuStack = useCallback(() => {
    setMenuStack([{ title: "Main Menu", items }]);
  }, [items]);

  useEffect(() => {
    resetMenuStack();
  }, [resetMenuStack]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.toggle("mobile-menu-open", isOpen);
    body.classList.toggle("mobile-menu-open", isOpen);

    return () => {
      root.classList.remove("mobile-menu-open");
      body.classList.remove("mobile-menu-open");
    };
  }, [isOpen]);

  const toggleMenu = useCallback(
    (forced?: boolean) => {
      setIsOpen((prev) => {
        const next = typeof forced === "boolean" ? forced : !prev;
        if (!next) {
          resetMenuStack();
        }
        return next;
      });
    },
    [resetMenuStack]
  );

  const handleNavigate = () => {
    toggleMenu(false);
  };

  const handleOpenSubmenu = (title: string, nextItems: any[]) => {
    if (!nextItems?.length) {
      return;
    }

    setMenuStack((prev) => [...prev, { title, items: nextItems }]);
  };

  const handleBack = () => {
    setMenuStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const slideOffset = (menuStack.length - 1) * 100;

  return (
    <>
      <HamburgerButton
        isOpen={isOpen}
        onChange={() => toggleMenu()}
        hamburgerTransform={hamburgerTransform}
        ariaLabel={isOpen ? "Close menu" : "Open menu"}
      />

      {/* Mobile Menu Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => toggleMenu(false)}
        position="center"
        className={`w-full max-w-full h-full bg-gradient p-0 rounded-none transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        overlayClass={`bg-black/50 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        closeButton={closeButton}
        ariaLabel="Mobile navigation menu"
        ssr={false}
      >
        <nav
          className={`${className} mobile-menu-nav landscape-hero relative h-full w-full overflow-hidden`}
          aria-label="Mobile navigation"
        >
          <div className="mobile-menu-content inner-section absolute inset-x-0 top-24 bottom-72 md:bottom-52">
            <div className="relative flex h-full w-full justify-center overflow-hidden">
              <div
                className="flex h-full w-full transition-transform duration-300 ease-in-out"
                style={{ transform: `translateX(-${slideOffset}%)` }}
              >
                {menuStack.map((level, index) => (
                  <div
                    key={`${level.title}-${index}`}
                    className="h-full w-full flex-shrink-0"
                    aria-hidden={index !== menuStack.length - 1}
                  >
                    <div
                      className={`mx-auto flex h-full w-full max-w-[18rem] md:max-w-[22rem] lg:max-w-[26rem] xl:max-w-[30rem] flex-col text-left ${
                        index === 0 ? "justify-center" : ""
                      }`}
                    >
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={handleBack}
                          className="mb-6 flex items-center gap-2 text-text hover:underline"
                          aria-label={`Go back to ${
                            menuStack[index - 1]?.title ?? "previous menu"
                          }`}
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                          Back
                        </button>
                      )}

                      <div
                        className={`overflow-y-auto overflow-x-hidden ${
                          index > 0 ? "min-h-0 flex-1" : "max-h-full"
                        }`}
                      >
                        <ul className="menu-item-spacing text-left">
                          {level.items.map((item) => (
                            <MobileMenuItem
                              key={item.id}
                              {...item}
                              currentPath={currentPath}
                              onNavigate={handleNavigate}
                              onOpenSubmenu={(submenu) =>
                                handleOpenSubmenu(submenu.title, submenu.items)
                              }
                            />
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0">
            <div className="border-t border-border-soft"></div>
            <div className="inner-section">
              <HorizontalLegalFooter
                socialLinks={socialLinks}
                showBorder={false}
                onLinkClick={() => toggleMenu(false)}
              />
            </div>
          </div>
        </nav>
      </Modal>
    </>
  );
}
