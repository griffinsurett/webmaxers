// src/integrations/preferences/ui/consent/components/OptOutButton.tsx
/**
 * CCPA Opt-Out Button (Default UI)
 */

import { useState } from "react";

export default function OptOutButton() {
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleOptOut = () => {
    (window as any).Zest?.rejectAll?.();
    setShowConfirmation(true);
    setTimeout(() => window.location.reload(), 1500);
  };

  if (showConfirmation) {
    return (
      <div className="bg-success/10 border-2 border-success rounded-lg p-6">
        <p className="font-semibold text-success text-lg">✅ Success!</p>
        <p className="text-success/80 text-sm mt-2">
          You've opted out. Non-essential cookies disabled. Reloading...
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={handleOptOut}
      className="bg-primary text-bg px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-700 transition-colors"
      type="button"
    >
      🚫 Opt Out of Data Sharing
    </button>
  );
}
