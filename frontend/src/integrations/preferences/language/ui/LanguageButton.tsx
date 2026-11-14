// src/integrations/preferences/language/ui/LanguageButton.tsx
/**
 * Language Button
 *
 * Footer control that opens the language picker in a modal. Deliberately built
 * to match CookiePreferencesButton (same `Button` variant/size, same trailing
 * icon treatment) so the two sit beside each other as a pair.
 */
import { useState, lazy, Suspense, memo } from "react";
import Button from "@/components/Button/Button";
import type { ButtonSize } from "@/components/Button/Button";

const LanguageModal = lazy(() => import("./LanguageModal"));

interface LanguageButtonProps {
  className?: string;
  size?: ButtonSize;
}

function LanguageButton({ className = "", size = "sm" }: LanguageButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      {/* No aria-label: the visible text IS the accessible name (WCAG 2.5.3
          label-in-name). The globe icon is decorative and aria-hidden. */}
      <Button
        variant="link"
        size={size}
        onClick={() => setShowModal(true)}
        rightIcon="lucide:globe"
        className={className}
      >
        Choose language
      </Button>

      {showModal && (
        <Suspense fallback={null}>
          <LanguageModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
          />
        </Suspense>
      )}
    </>
  );
}

export default memo(LanguageButton);
