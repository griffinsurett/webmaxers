// src/components/PlayForDiscountPopup/PlayForDiscountPopup.tsx
/**
 * "Play for a discount" popup — a timed modal inviting visitors to /game.
 *
 * Port of the i75 `SpecialCampaignPopup` pattern: every string, the timing and
 * the frequency rule arrive as props from `popupData` in siteData.ts. Nothing
 * about the offer is decided here.
 *
 * ── Trigger ────────────────────────────────────────────────────────────────
 * A `delayMs` timer RACES a `scrollPercent` threshold; whichever lands first
 * opens the modal, and `settled` makes that one-way so it cannot re-open.
 * Same as i75.
 *
 * ── Frequency ──────────────────────────────────────────────────────────────
 *   "campaign" → localStorage, keyed by `campaignSlug` (once per browser;
 *                bumping the slug re-shows it to everyone)
 *   "session"  → sessionStorage (returns next visit)
 *   "always"   → no persistence, opens every load (for previewing)
 * Every storage access is wrapped: Safari private mode throws on access, and a
 * throw must mean "show the popup", never "crash the page".
 */
import { useEffect, useId, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button/Button";
import PanelStarfield from "@/components/Starfield/PanelStarfield";
import { useZestConsent } from "@/integrations/preferences/consent/core/hooks/useZestConsent";

export type PopupFrequencyMode = "campaign" | "session" | "always";

export interface PlayForDiscountPopupProps {
  eyebrow?: string;
  heading: string;
  description?: string;
  buttonText: string;
  href: string;
  secondaryButtonText?: string;
  secondaryHref?: string;
  secondaryExternal?: boolean;
  campaignSlug: string;
  delayMs?: number;
  scrollPercent?: number;
  frequencyMode?: PopupFrequencyMode;
  storageKeyPrefix?: string;
}

function getScrollProgressPercent(): number {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || 0;
  const maxScrollable = Math.max(doc.scrollHeight - window.innerHeight, 0);
  // A page shorter than the viewport can never be scrolled, so treat it as
  // fully read rather than never-triggering.
  if (maxScrollable === 0) return 100;
  return (scrollTop / maxScrollable) * 100;
}

export default function PlayForDiscountPopup({
  eyebrow,
  heading,
  description = "",
  buttonText,
  href,
  secondaryButtonText,
  secondaryHref,
  secondaryExternal = false,
  campaignSlug,
  delayMs = 8000,
  scrollPercent = 35,
  frequencyMode = "campaign",
  storageKeyPrefix = "play-for-discount",
}: PlayForDiscountPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const descriptionId = useId();

  // WAIT FOR CONSENT. Both this and the cookie banner are fixed overlays, and
  // on a phone they land on top of each other — measured at 390x844, the banner
  // covered this panel's buttons. Consent is a legal requirement and a promo is
  // not, so the promo yields rather than the two being z-index'd apart.
  //
  // `decided` is null until Zest has booted, false while the banner is up, and
  // true once answered; the hook re-renders on `zest:change`, so dismissing the
  // banner releases this on the spot without a reload.
  const { decided } = useZestConsent();
  const consentSettled = decided === true;

  const normalizedDelayMs = Number.isFinite(delayMs) ? Math.max(0, delayMs) : 8000;
  const normalizedScrollPercent = Number.isFinite(scrollPercent)
    ? Math.min(Math.max(scrollPercent, 0), 100)
    : 35;

  const persistenceKey = useMemo(() => {
    if (frequencyMode === "always") return "";
    return frequencyMode === "session"
      ? `${storageKeyPrefix}:session`
      : `${storageKeyPrefix}:campaign:${campaignSlug.trim().toLowerCase()}`;
  }, [campaignSlug, frequencyMode, storageKeyPrefix]);

  useEffect(() => {
    // Hold everything — timer included — until consent is answered, so the
    // delay starts from when the visitor can actually see the page rather than
    // running out behind the banner.
    if (!consentSettled) return;

    if (frequencyMode === "always") {
      setIsOpen(true);
      return;
    }

    const store = () =>
      frequencyMode === "session" ? window.sessionStorage : window.localStorage;

    try {
      if (store().getItem(persistenceKey) === "1") return;
    } catch {
      // Storage unavailable (private mode) — fall through and show it.
    }

    // One-way latch: the timer and the scroll listener race, and only the first
    // one to fire has any effect.
    let settled = false;

    const openPopup = () => {
      if (settled) return;
      settled = true;
      setIsOpen(true);
      window.removeEventListener("scroll", handleScroll);
    };

    const handleScroll = () => {
      if (getScrollProgressPercent() >= normalizedScrollPercent) openPopup();
    };

    const timer = window.setTimeout(openPopup, normalizedDelayMs);
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Covers a deep-link that restores scroll position past the threshold.
    handleScroll();

    return () => {
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [consentSettled, frequencyMode, normalizedDelayMs, normalizedScrollPercent, persistenceKey]);

  const markDismissed = () => {
    if (frequencyMode === "always") return;
    try {
      const store =
        frequencyMode === "session" ? window.sessionStorage : window.localStorage;
      store.setItem(persistenceKey, "1");
    } catch {
      // Storage unavailable — the popup simply returns next load.
    }
  };

  // Dismiss on ANY exit, including taking the CTA: a visitor who has gone to
  // play should not meet this again when they come back.
  const handleClose = () => {
    markDismissed();
    setIsOpen(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabel={heading.replace(/\n/g, " ")}
      ariaDescribedBy={description ? descriptionId : undefined}
      // Matches i75's popup exactly: a plain 65% black scrim and NO blur.
      // The blur was the real culprit in the earlier version — at /70 the
      // opacity alone still left the page legible, but `backdrop-blur-sm`
      // smeared the hero into a grey field, so the site read as "gone" rather
      // than "behind". Tint dims; blur destroys. Keep this un-blurred.
      overlayClass="bg-black/65"
      // The shell carries NO theme-dependent colour of its own: the panel
      // re-scopes the palette to dark on the div below, and anything painted
      // out here would resolve against the SITE theme instead — a light border
      // ringing a dark panel. Border and fill both live inside.
      className="w-full max-w-2xl mx-4 overflow-hidden rounded-2xl shadow-2xl"
      closeButtonClass="absolute top-4 right-4 z-30 text-white/60 hover:text-white transition-colors"
    >
      {/* The star field is the panel's background, so the panel is forced dark
          in BOTH themes — a white-on-light field is invisible, and this is the
          one surface on the site that is explicitly "space", matching /game.
          Tokens are re-scoped rather than hardcoded so the panel still tracks
          the palette. */}
      <div
        className="relative isolate rounded-2xl border border-heading/15"
        data-theme="dark"
        data-play-for-discount
      >
        <div className="absolute inset-0 bg-bg" aria-hidden="true" />
        <PanelStarfield className="z-0" />

        {/* Readability scrim: the copy sits over a moving field, so it needs a
            floor under it that the stars cannot lift. */}
        <div
          className="absolute inset-0 z-0 bg-linear-to-br from-bg/55 via-bg/35 to-bg/65"
          aria-hidden="true"
        />

        <div className="relative z-10 space-y-4 p-8 pr-14 md:p-10 md:pr-16">
          {eyebrow && (
            <p className="eyebrow-text text-accent">{eyebrow}</p>
          )}

          {/* `whitespace-pre-line` so the intentional line break in the
              siteData heading survives without markup in the config. */}
          <h2 className="whitespace-pre-line text-3xl font-bold leading-tight text-heading md:text-4xl">
            {heading}
          </h2>

          {description && (
            <p id={descriptionId} className="text-base text-text md:text-lg">
              {description}
            </p>
          )}

          {/* The SAME pairing the hero uses: `primary` with the arrow icon for
              the main action, `underline` for the quieter one. Not
              `primary`+`secondary` — two pill outlines side by side read as
              equal weight and gave the secondary action more presence than the
              primary, which is backwards for a promo.

              `items-start` (not `items-center`/`items-stretch`): the primary is
              a pill that must hug its label, and stretching it is what forced
              "Play for a discount" to wrap onto two lines. */}
          <div className="flex flex-col items-start gap-4 pt-2 sm:flex-row sm:items-center sm:gap-6">
            {/* animated={false}: the variants' scroll-reveal wrapper starts at
                opacity:0 and clears only when its IntersectionObserver fires.
                Inside a position:fixed modal it never does, leaving the button
                invisible and unclickable — the same opt-out the cookie banner
                and CookiePreferencesModal use. */}
            <Button
              variant="primary"
              href={href}
              rightIcon="lu:arrow-up-right"
              animated={false}
              onClick={handleClose}
              buttonWrapperClasses="w-auto!"
              className="whitespace-nowrap"
            >
              {buttonText}
            </Button>

            {secondaryButtonText && secondaryHref && (
              <Button
                variant="underline"
                href={secondaryHref}
                animated={false}
                onClick={handleClose}
                className="self-center! whitespace-nowrap"
                {...(secondaryExternal
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {secondaryButtonText}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
