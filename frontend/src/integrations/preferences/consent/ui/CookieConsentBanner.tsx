// src/integrations/preferences/ui/consent/components/CookieConsentBanner.tsx
/**
 * Cookie Consent Banner (Default UI)
 *
 * Initial consent prompt that appears for first-time visitors.
 * Loads eagerly on first user interaction via client:firstInteraction.
 *
 * After consent is given, enables scripts via scriptManager.
 */

import { useState, useEffect, useTransition, lazy, Suspense, useCallback } from "react";
import Modal from "@/components/Modal";
import {
  useCookieSettingsRequests,
  useZestConsent,
} from "@/integrations/preferences/consent/core/hooks/useZestConsent";
import Button from "@/components/Button/Button";

const CookiePreferencesModal = lazy(() => import("./CookiePreferencesModal"));

export default function CookieConsentBanner() {
  const { decided, geoPending, acceptAll, rejectAll } = useZestConsent();
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const showBanner =
    decided === false && geoPending === false && !dismissed;

  const openSettings = useCallback(() => setShowModal(true), []);
  useCookieSettingsRequests(openSettings);

  const handleAcceptAll = () => {
    acceptAll();
    startTransition(() => {
      setDismissed(true);
    });
  };

  const handleRejectAll = () => {
    rejectAll();
    startTransition(() => {
      setDismissed(true);
    });
  };

  useEffect(() => {
    const onChange = () => setDismissed(true);
    window.addEventListener("zest:change", onChange);
    return () => window.removeEventListener("zest:change", onChange);
  }, []);

  return (
    <>
      {/* modal={false}: this is a non-blocking notice, not a dialog. As a modal
          the Modal marks header/main/footer `inert`, which leaves the page
          scrollable but makes nothing on it clickable until the banner is
          answered. */}
      {showBanner && <Modal
        isOpen={showBanner}
        onClose={() => setDismissed(true)}
        closeButton={false}
        position="bottom-full"
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
          <div className="outer-card-style card-bg-2 rounded-none border-x-0 border-b-0 px-0 py-6">
            <div
              className="inner-card-style inner-card-transition inner-card-color"
              aria-hidden="true"
            />
            {/* Full-bleed bar, container-width content: the copy and the actions
                sit on one row from `lg` up, stacking below that so the buttons
                stay full-width and thumb-reachable on phones. */}
            <div className="relative z-10 section-container mx-auto flex w-full max-w-[1600px] flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
              {/* items-center so the cookie sits level with the text block
                  rather than pinned to its first line. */}
              <div className="flex items-center gap-3">
                <span
                  className="text-2xl leading-none shrink-0"
                  role="img"
                  aria-label="Cookie"
                >
                  🍪
                </span>
                <p className="text-sm text-text leading-relaxed">
                  We use cookies to improve your browsing experience and for
                  marketing purposes.{" "}
                  <Button
                    variant="link"
                    onClick={openSettings}
                    type="button"
                    className="text-sm"
                  >
                    Manage preferences
                  </Button>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 lg:shrink-0">
                {/* Stacked on phones it stretches like the hero's mobile CTA; in
                    the row it sits level with Accept All. No arrow: it's an
                    in-place action (secondary only defaults one on links). */}
                <Button
                  variant="secondary"
                  onClick={handleRejectAll}
                  type="button"
                  className="w-full! max-w-none! self-stretch! sm:w-fit! sm:self-center! lg:whitespace-nowrap"
                  size="md"
                  disabled={isPending}
                >
                  Reject All
                </Button>
                <Button
                  variant="primary"
                  onClick={handleAcceptAll}
                  fullWidth={true}
                  className="flex-1 text-xs lg:w-auto lg:flex-none lg:whitespace-nowrap"
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
      </Modal>}

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
