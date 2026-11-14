// src/integrations/preferences/ui/accessibility/components/AccessibilityButton.tsx
/**
 * Accessibility Button (Default UI)
 *
 * Triggers the accessibility modal. For custom UI, use the
 * useAccessibility hook from core directly.
 */
import { useState, lazy, Suspense, memo } from "react";
import Button from "@/components/Button/Button";
import type { ButtonSize } from "@/components/Button/Button";

const AccessibilityModal = lazy(() => import("./AccessibilityModal"));

interface AccessibilityButtonProps {
  className?: string;
  size?: ButtonSize;
}

function AccessibilityButton({
  className = "",
  size = "sm",
}: AccessibilityButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button
        variant="link"
        size={size}
        onClick={() => setShowModal(true)}
        aria-label="Manage reading preferences"
        aria-expanded={showModal}
        rightIcon="lucide:book-open"
        className={className}
      >
        Reading Preferences
      </Button>

      {showModal && (
        <Suspense fallback={null}>
          <AccessibilityModal isOpen={showModal} onClose={() => setShowModal(false)} />
        </Suspense>
      )}
    </>
  );
}

export default memo(AccessibilityButton);
