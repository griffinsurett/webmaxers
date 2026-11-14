// src/components/PlayForDiscountPopup/PlayForDiscountPopup.tsx
/**
 * "Play for a discount" popup — a timed modal inviting visitors to /game.
 *
 * Port of the i75 `SpecialCampaignPopup` pattern: every string, the timing and
 * the frequency rule arrive as PROPS — resolved by PlayForDiscountPopupHost
 * from the active entry in the `promos` content collection (copy) plus
 * `popupData` in siteData.ts (site-wide timing defaults). Nothing about the
 * offer is decided here, and this component never reads content itself.
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
      // Blur the page a little. That is all this does.
      //
      // No tint: the point is that the site stays visible behind the modal,
      // just softened so the panel is what your eye lands on. A full-screen
      // starfield layer was tried here and was flatly wrong — it PAINTED OVER
      // the page instead of letting it show through. Do not add a covering
      // layer to this overlay.
      overlayClass="backdrop-blur-[3px]"
      // DO NOT LOCK BODY SCROLL. This is what was "hiding the page".
      //
      // Modal's default scroll lock sets `overflow: hidden` on <html>/<body>.
      // The homepage hero is CurtainReveal's top panel — `position: sticky;
      // bottom: 0` sitting after a 100svh travel spacer — and **sticky only
      // holds while the page can scroll**. Locking overflow dropped the hero to
      // its static position exactly one viewport DOWN (measured:
      // `.home-top` top = 900 with the modal open, 0 with it closed), so the
      // page behind the transparent overlay was genuinely empty.
      //
      // Nothing to do with scrim colour or blur — three attempts at re-tinting
      // the overlay could never have fixed a layout shift. Leaving the page
      // scrollable keeps the curtain pinned and the hero on screen.
      allowScroll
      className="w-full max-w-2xl mx-4"
      closeButtonClass="absolute top-4 right-4 z-30 text-white/60 hover:text-white transition-colors"
    >
      {/* Forced dark in BOTH site themes: this is the one surface that is
          explicitly "space", matching /game. `data-theme` re-scopes the tokens
          rather than hardcoding colours, so it still tracks the palette. */}
      <div className="relative" data-theme="dark" data-play-for-discount>
        {/* THE PANEL — OPAQUE. `bg-bg`, not `bg-bg/88`.
            The game's win overlay uses 88% because it floats over a live game
            canvas and wants the stars showing through. Over the real site that
            just means the hero headline reads straight through the card. The
            panel's own starfield is the texture here; the page behind it should
            not show at all. No backdrop-blur either — nothing behind to blur. */}
        <div className="relative space-y-4 overflow-hidden rounded-[1.25rem] border border-heading/12 bg-bg p-8 pr-14 shadow-[0_24px_60px_rgba(0,0,0,0.55)] md:p-10 md:pr-16">
          {/* STARS — INSIDE THE PANEL ONLY, never over the page.
              `overflow-hidden` + `rounded-[1.25rem]` on the parent clip the
              canvas to the card, and PanelStarfield sizes itself from its own
              element (ResizeObserver), so it fills exactly this box.

              An earlier version portalled a FULL-SCREEN field to <body> to get
              stars around the card as well. That painted over the whole site
              and had to be ripped out. The field belongs in the panel; the page
              behind gets nothing but the overlay's blur. */}
          <PanelStarfield className="z-0" density={2200} />

          {eyebrow && (
            <p className="relative z-10 eyebrow-text text-accent">{eyebrow}</p>
          )}

          {/* `whitespace-pre-line` so the intentional line break in the
              siteData heading survives without markup in the config. */}
          <h2 className="relative z-10 whitespace-pre-line text-3xl font-bold leading-tight text-heading md:text-4xl">
            {heading}
          </h2>

          {description && (
            <p id={descriptionId} className="relative z-10 text-base text-text md:text-lg">
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
          <div className="relative z-10 flex flex-col items-start gap-4 pt-2 sm:flex-row sm:items-center sm:gap-6">
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
                variant="secondary"
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
