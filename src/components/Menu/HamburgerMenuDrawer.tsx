// src/components/HamburgerMenuDrawer.tsx
/**
 * Mobile Menu Drawer Template
 *
 * Manages open/close state for mobile menu with checkbox-based hamburger button.
 */

import { useState } from "react";
import Modal from "@/components/Modal";
import MobileMenuItem from "@/components/LoopComponents/Menu/MobileMenuItem";
import HamburgerButton from "./HamburgerButton";

interface MobileMenuDrawerProps {
  items: any[];
  className?: string;
  hamburgerTransform?: boolean;
  closeButton?: boolean;
}

export default function MobileMenuDrawer({
  items,
  className = "",
  hamburgerTransform = true,
  closeButton = true,
}: MobileMenuDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigate = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Checkbox-based Hamburger Button */}
      <HamburgerButton
        isOpen={isOpen}
        onChange={setIsOpen}
        hamburgerTransform={hamburgerTransform}
        ariaLabel={isOpen ? "Close menu" : "Open menu"}
        id="mobile-menu-toggle"
      />

      {/* Mobile Menu Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        position="center"
        className="w-full max-w-full h-full bg-bg p-0 rounded-none"
        overlayClass="bg-black/50"
        closeButton={closeButton}
        closeButtonClass="absolute top-4 right-4 p-2 text-text hover:text-primary transition-colors z-[100000]"
        ariaLabel="Mobile navigation menu"
        ssr={false}
      >
        <nav
          className={`${className} h-full overflow-y-auto p-6`}
          aria-label="Mobile navigation"
        >
          <ul className="space-y-1">
            {items.map((item) => (
              <MobileMenuItem
                key={item.id}
                {...item}
                onNavigate={handleNavigate}
              />
            ))}
          </ul>
        </nav>
      </Modal>
    </>
  );
}
