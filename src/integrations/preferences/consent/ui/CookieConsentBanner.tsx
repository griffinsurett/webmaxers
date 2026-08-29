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
                    onClick={handleOpenSettings}
                    type="button"
                    className="text-sm"
                  >
                    Manage preferences
                  </Button>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 lg:shrink-0">
                {/* Same `underline` treatment as the hero's "View Our Work" —
                    the quiet, secondary action next to a solid primary. It has
                    no `fullWidth` prop (the variant sizes to its text so the
                    rule tracks the label), so the width is set here: full on
                    mobile where the two buttons stack, natural from lg. */}
                <Button
                  variant="underline"
                  onClick={handleRejectAll}
                  animated={false}
                  type="button"
                  /* The variant defaults to an up-right arrow, which reads as
                     "opens elsewhere" — wrong for an in-place consent choice.
                     An explicit null suppresses it (see UnderlineButton). */
                  rightIcon={null}
                  className="w-full! max-w-none! self-center! text-xs lg:w-auto! lg:whitespace-nowrap"
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
