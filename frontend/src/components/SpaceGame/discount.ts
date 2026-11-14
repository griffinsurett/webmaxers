// src/components/SpaceGame/discount.ts
/**
 * The discount offer, in ONE place.
 *
 * These strings appear in four separate surfaces — the game's own title screen,
 * the claim form's terms, the on-page thank-you, and the Formspree auto-reply —
 * and a discount whose terms differ between where it was advertised and where
 * it was claimed is a real problem, not a cosmetic one. So they are defined
 * here and imported, never retyped.
 *
 * The percentage is also passed into the game so its title screen can say what
 * the player is actually competing for (MountOptions.rewardLabel) — the game
 * itself still knows nothing about forms or terms.
 */

/** The headline number. Changing it here changes every surface. */
export const DISCOUNT_PERCENT = 15;

/** Short label for the game's title screen and buttons. */
export const DISCOUNT_LABEL = `${DISCOUNT_PERCENT}% OFF`;

/**
 * The full terms. Deliberately explicit about the two limits people would
 * otherwise assume the other way: it is setup-cost only, and it is one per
 * person.
 */
export const DISCOUNT_TERMS: string[] = [
  `${DISCOUNT_PERCENT}% off the final price of your website setup cost.`,
  "Applies to the one-time setup cost only. It does not affect ongoing maintenance, hosting, or any future purchases.",
  "One discount per person. Winning again does not stack or earn an additional discount.",
  "Redeemed against your project quote — mention it when we speak.",
];

/** One-line summary, for places too small for the full list. */
export const DISCOUNT_SUMMARY =
  `${DISCOUNT_PERCENT}% off your website setup cost — one-time setup only, ` +
  `not maintenance or future purchases, and one per person.`;


/**
 * localStorage key recording that this browser has already claimed.
 *
 * Namespaced and versioned: bumping the suffix is how a future campaign
 * re-opens the offer to people who claimed under the old one, without having to
 * reach into anyone's storage.
 */
export const CLAIM_STORAGE_KEY = "webmaxxers:game-discount-claimed:v1";

/** What we remember about a claim. Deliberately minimal — no contact details. */
export interface StoredClaim {
  /** ISO timestamp of the claim. */
  at: string;
  /** The winning score, so the confirmation can restate it. */
  score: number;
  /** The percentage claimed, in case the offer changes later. */
  percent: number;
}

/** Shape guard for the stored value — anything else is treated as absent. */
export function isStoredClaim(v: unknown): v is StoredClaim {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.at === "string" &&
    typeof c.score === "number" &&
    typeof c.percent === "number"
  );
}
