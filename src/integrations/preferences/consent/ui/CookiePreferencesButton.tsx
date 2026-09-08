// src/integrations/preferences/ui/consent/components/CookiePreferencesButton.tsx
import { memo } from "react";
import Button from "@/components/Button/Button";
import type { ButtonSize } from "@/components/Button/Button";


interface CookiePreferencesButtonProps {
  className?: string;
  size?: ButtonSize;
}

function CookiePreferencesButton({
  className = "",
  size = "sm",
}: CookiePreferencesButtonProps) {

  return (
    <>
      {/* No aria-label: the visible text "Your Privacy Choices" IS the
          accessible name. An aria-label that omits the visible text breaks
          WCAG 2.5.3 (label-in-name) — voice-control users can't say what they
          see. The settings icon is aria-hidden, so it doesn't affect the name. */}
      <Button
        variant="link"
        size={size}
        onClick={() => (window as any).Zest?.showSettings?.()}
        rightIcon="lucide:settings"
        className={className}
      >
        Your Privacy Choices
      </Button>
    </>
  );
}

export default memo(CookiePreferencesButton);
