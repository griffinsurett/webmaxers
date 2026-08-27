// src/integrations/preferences/ui/consent/components/CookieConsentBanner.tsx
/**
 * Cookie Consent Banner (Default UI)
 *
 * Initial consent prompt that appears for first-time visitors.
 * Loads eagerly on first user interaction via client:firstInteraction.
 *
 * After consent is given, enables scripts via scriptManager.
 */

import { useState, useEffect, useTransition, lazy, Suspense } from "react";
import { enableConsentedScripts } from "@/integrations/preferences/consent/core/scripts/scriptManager";
import Modal from "@/components/Modal";
import {
  defaultConsent,
  fullConsent,
} from "@/integrations/preferences/consent/core/types";
import {
  getConsent,
  saveConsent,
} from "@/integrations/preferences/consent/core/utils/consent";
import Button from "@/components/Button/Button";

const CookiePreferencesModal = lazy(() => import("./CookiePreferencesModal"));

export default function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Returning visitor with a valid, current-version choice: honour it.
    // getConsent() returns null for a pre-v2 cookie, so those visitors see the
    // banner again and reconsent under the Consent Mode types.
    if (getConsent()) {
      enableConsentedScripts();
      return;
    }

    setShowBanner(true);
  }, []);

  const handleAcceptAll = () => {
    // saveConsent writes the cookie and dispatches "consent-changed", which the
    // GTM inline script listens for to send its `consent update`.
    saveConsent(fullConsent());
    enableConsentedScripts();

    startTransition(() => {
      setShowBanner(false);
    });
  };

  const handleRejectAll = () => {
    // Records an explicit refusal (essentials only) rather than leaving the
    // visitor in the "no choice made" state — the banner must not reappear.
    saveConsent(defaultConsent());
    enableConsentedScripts();

    startTransition(() => {
      setShowBanner(false);
    });
  };

  const handleOpenSettings = () => {
    startTransition(() => {
      setShowModal(true);
    });
  };

  return (
    <>
      {/* modal={false}: this is a non-blocking notice, not a dialog. As a modal
          the Modal marks header/main/footer `inert`, which leaves the page
          scrollable but makes nothing on it clickable until the banner is
          answered. */}
      <Modal
        isOpen={showBanner}
        onClose={() => setShowBanner(false)}
        closeButton={false}
        position="bottom-left"
        className="consent-banner"
        overlayClass="bg-transparent pointer-events-none"
        allowScroll={true}
        modal={false}
        ssr={false}
        ariaLabel="Cookie consent banner"
      >
        <div
          id="cookie-consent-banner"
          className="outer-card-transition group text-left"
        >
          <div className="outer-card-style card-bg-2">
            <div
              className="inner-card-style inner-card-transition inner-card-color"
              aria-hidden="true"
            />
            <div className="relative z-10 flex flex-col gap-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl" role="img" aria-label="Cookie">
                  🍪
                </span>
                <p className="text-sm text-text leading-relaxed">
                  We use cookies to improve your browsing experience and for
                  marketing purposes.{" "}
                  <Button
                    variant="link"
                    onClick={handleOpenSettings}
                    type="button"
                    className="text-sm"
                  >
                    Manage preferences
                  </Button>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="secondary"
                  onClick={handleRejectAll}
                  fullWidth={true}
                  type="button"
                  buttonWrapperClasses="text-center"
                  size="md"
                  disabled={isPending}
                >
                  Reject All
                </Button>
                <Button
                  variant="primary"
                  onClick={handleAcceptAll}
                  fullWidth={true}
                  className="flex-1"
                  animated={false}
                  type="button"
                  size="md"
                  disabled={isPending}
                >
                  Accept All
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {showModal && (
        <Suspense fallback={null}>
          <CookiePreferencesModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
          />
        </Suspense>
      )}
    </>
  );
}
