// src/components/SpaceGame/DiscountClaim.tsx
/**
 * The win reward: a claim form, then the full terms and a way onward.
 *
 * Shown over the game's own GameOver screen when `onWin` fires. Two states:
 *
 *   1. FORM — name, email, phone. Submits to Formspree, which notifies us that
 *      this person won and is claiming, and sends them an auto-reply.
 *   2. THANK YOU — the full discount terms again (so the answer to "what did I
 *      actually win?" is on screen, not only in an email that may be delayed or
 *      filtered), plus a link home and a replay button.
 *
 * ── Why the terms appear three times ───────────────────────────────────────
 * On the form, on the thank-you, and in the auto-reply. They all read from
 * `discount.ts`, so they cannot disagree — which matters, because a discount
 * whose terms differ between where it was advertised and where it was claimed
 * is a dispute waiting to happen.
 *
 * ── The game does not know this exists ─────────────────────────────────────
 * It arrives entirely through `onWin`, the single hook the boundary exposes.
 * Nothing under `game/` imports this file (PORTING.md §6.1).
 */
import { useState } from "react";
import FormWrapper from "@/components/Form/FormWrapper";
import type { FieldConfig } from "@/components/Form/fields";
import type { GameResult } from "./types";
import {
  DISCOUNT_LABEL,
  DISCOUNT_PERCENT,
  DISCOUNT_SUMMARY,
  DISCOUNT_TERMS,
  type StoredClaim,
} from "./discount";

const FORMSPREE_ENDPOINT = import.meta.env.PUBLIC_FORMSPREE_WINNER_ID
  ? `https://formspree.io/f/${import.meta.env.PUBLIC_FORMSPREE_WINNER_ID}`
  : undefined;

const fields: FieldConfig[] = [
  { name: "firstName", label: "First Name", type: "text", required: true, minLength: 2, autoComplete: "given-name", colSpan: 1 },
  { name: "lastName", label: "Last Name", type: "text", required: true, minLength: 2, autoComplete: "family-name", colSpan: 1 },
  { name: "email", label: "Email Address", type: "email", required: true, autoComplete: "email", colSpan: 2 },
  {
    name: "phone",
    label: "Phone Number",
    type: "tel",
    required: true,
    autoComplete: "tel",
    pattern: "[0-9]{10,}",
    hint: "At least 10 digits, numbers only.",
    errorMessage: "Enter a phone number with at least 10 digits.",
    colSpan: 2,
  },
];

export interface DiscountClaimProps {
  result: GameResult;
  /**
   * A previous claim from localStorage, or null. When set, the form is not
   * offered again — the terms promise one discount per person.
   */
  alreadyClaimed: StoredClaim | null;
  /** Called once the form submits successfully, so the claim can be recorded. */
  onClaimed: () => void;
  /** Dismiss the reward and go back to the game. */
  onPlayAgain: () => void;
}

/**
 * The pre-game terms, shown on the /game page beneath the canvas so a player
 * knows what they are competing for BEFORE they spend 90 seconds on it. Same
 * constants as the claim and the auto-reply, so the three cannot disagree.
 */
export function DiscountTerms() {
  return (
    <section className="discount-terms" aria-labelledby="discount-terms-title">
      <h2 id="discount-terms-title" className="discount-terms__title">
        Play for {DISCOUNT_LABEL} your website
      </h2>
      <p className="discount-terms__lead">
        Score {"10,000"} points in 90 seconds and you have earned a discount on
        your build. Here is exactly what that means:
      </p>
      <ul className="discount-terms__list">
        {DISCOUNT_TERMS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}

export default function DiscountClaim({
  result,
  alreadyClaimed,
  onClaimed,
  onPlayAgain,
}: DiscountClaimProps) {
  // Someone who claimed on an earlier visit lands straight on the confirmation.
  const [claimed, setClaimed] = useState(false);
  const showThanks = claimed || alreadyClaimed !== null;

  return (
    <div className="discount-claim">
      <div className="discount-claim__panel">
        {!showThanks ? (
          <>
            <header className="discount-claim__head">
              <p className="discount-claim__eyebrow">You saved the Earth</p>
              <h2 className="discount-claim__title">
                Claim your {DISCOUNT_LABEL}
              </h2>
              <p className="discount-claim__lead">
                Final score {result.score.toLocaleString()} with{" "}
                {result.timeLeft.toFixed(1)}s to spare. Tell us where to send
                it.
              </p>
            </header>

            <FormWrapper
              fields={fields}
              fieldsClassName="grid gap-4 sm:grid-cols-2"
              formspreeEndpoint={FORMSPREE_ENDPOINT}
              formspreeFormName={`Saucer Defender winner — claiming ${DISCOUNT_PERCENT}% off`}
              successMessage="Claim received."
              resetOnSuccess={false}
              // In-page success, NOT a native POST + redirect: the form is an
              // overlay on a running game, and navigating away to a Formspree
              // thank-you page would tear the canvas down and lose the run.
              useNativeFormSubmission={false}
              onSuccess={() => {
                setClaimed(true);
                onClaimed();
              }}
              submitButton={{
                text: `Claim my ${DISCOUNT_LABEL}`,
                className: "w-full",
                disabled: !FORMSPREE_ENDPOINT,
              }}
            >
              {/* Evidence for the lead, so the claim carries its own proof and
                  we can sanity-check it before honouring anything. onWin is
                  client-side and therefore forgeable (PORTING.md §6.2). */}
              <input type="hidden" name="game" value="Saucer Defender" />
              <input type="hidden" name="outcome" value="WON — claiming discount" />
              <input type="hidden" name="discount" value={`${DISCOUNT_PERCENT}% off website setup cost`} />
              <input type="hidden" name="score" value={String(result.score)} />
              <input type="hidden" name="secondsRemaining" value={result.timeLeft.toFixed(1)} />
              <input type="hidden" name="runDurationSeconds" value={(result.durationMs / 1000).toFixed(1)} />
              <input type="hidden" name="wonAt" value={new Date().toISOString()} />
              {/* Formspree uses this as the auto-reply body, so the winner gets
                  the full terms by email as well as on screen. */}
              <input
                type="hidden"
                name="_autoresponse"
                value={autoResponseBody(result)}
              />
              <input
                type="hidden"
                name="_subject"
                value={`Saucer Defender winner — ${DISCOUNT_PERCENT}% off claim`}
              />
            </FormWrapper>

            <p className="discount-claim__fineprint">{DISCOUNT_SUMMARY}</p>
          </>
        ) : (
          <>
            <header className="discount-claim__head">
              <p className="discount-claim__eyebrow">
                {claimed ? "Claim received" : "Already claimed"}
              </p>
              <h2 className="discount-claim__title">
                Your {DISCOUNT_LABEL} is locked in
              </h2>
              {/* Different copy for the two ways of getting here. Telling
                  someone who claimed last week to "check your inbox" points
                  them at an email they have already had. */}
              <p className="discount-claim__lead">
                {claimed ? (
                  <>
                    Check your inbox — we have emailed you the details, and we
                    will be in touch shortly.
                  </>
                ) : (
                  <>
                    You claimed this on {formatClaimDate(alreadyClaimed!.at)}.
                    It is still yours — just mention it when we speak.
                  </>
                )}
              </p>
            </header>

            <div className="discount-claim__terms">
              <h3 className="discount-claim__termsTitle">
                What the discount covers
              </h3>
              <ul>
                {DISCOUNT_TERMS.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>

            <div className="discount-claim__actions">
              <a className="discount-claim__btn discount-claim__btn--primary" href="/">
                Back to homepage
              </a>
              <button
                type="button"
                className="discount-claim__btn discount-claim__btn--ghost"
                onClick={onPlayAgain}
              >
                Play again
              </button>
            </div>

            <p className="discount-claim__fineprint">
              Playing again is just for fun — you have already claimed your
              discount, and winning again does not earn another.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** "3 September 2026" — locale-aware, with a plain fallback if Intl is odd. */
function formatClaimDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "an earlier visit";
  }
}

/**
 * The auto-reply Formspree emails the winner. Plain text, because that is what
 * the `_autoresponse` field sends — and it repeats the same terms the
 * thank-you shows, from the same constants.
 */
function autoResponseBody(result: GameResult): string {
  return [
    `You saved the Earth — and you have earned ${DISCOUNT_LABEL} your website setup cost.`,
    "",
    `Final score: ${result.score.toLocaleString()} with ${result.timeLeft.toFixed(1)}s remaining.`,
    "",
    "WHAT THE DISCOUNT COVERS",
    ...DISCOUNT_TERMS.map((t) => `• ${t}`),
    "",
    "We will be in touch shortly to talk about your project. Just mention this",
    "email when we speak and we will apply the discount to your quote.",
    "",
    "— Webmaxxers",
  ].join("\n");
}
