// src/game/tuning.ts
/**
 * ── The world, and why vertical numbers are SCALED ─────────────────────────
 *
 * The world is always `WORLD.width` wide, and its HEIGHT varies with the
 * device's aspect ratio. That is what lets the game fill a portrait phone
 * without letterboxing to a strip, while a saucer still crosses the same
 * horizontal distance on every device — so approach timing, the thing the
 * whole difficulty curve is built on, never changes.
 *
 * The catch: a taller world is not automatically playable. At 2800px tall, a
 * craft moving 420 px/s takes 6.7s to cross top-to-bottom, while a saucer
 * reaches it in 7-10s — so it could not get out of the way. Every VERTICAL
 * quantity therefore scales by `vScale()` = worldHeight / 720, which holds the
 * top-to-bottom crossing time constant at ~1.7s regardless of shape.
 *
 * Rule of thumb when adding a number here: if it is a Y position, a vertical
 * speed, or a vertical amplitude, it must pass through `vScale()`. Horizontal
 * and time-based values are absolute.
 */
export const WORLD = {
  /** Always this wide. Saucer approach distance, and therefore timing. */
  width: 1280,
  /** The reference height every vertical quantity is expressed against. */
  refHeight: 720,
  /**
   * Clamp on the derived height. The floor stops a very wide screen from
   * squashing the field to a letterbox slot; the ceiling stops a very tall one
   * from producing a world so long that the HUD and the action drift apart.
   *
   * The floor is 560, not 620, because a 21.6:9 phone in landscape (844x390 —
   * an ordinary iPhone) wants 591. At 620 it was clamped, and the canvas had to
   * letterbox 39px of width to compensate. 560 covers real handsets while still
   * refusing anything genuinely slot-shaped.
   */
  minHeight: 560,
  maxHeight: 2800,
} as const;

/** Height of the current world. Set once at boot, read everywhere. */
let worldHeight: number = WORLD.refHeight;

/**
 * True when the canvas is rotated a quarter turn (portrait phones).
 *
 * The GAME is unaffected — it is still a horizontal shooter and every entity
 * behaves identically. Only the HUD cares, because text rotated 90° is
 * unreadable and has to be counter-rotated and re-anchored.
 */
let rotated = false;

export function setRotated(v: boolean) {
  rotated = v;
}

export function isRotated(): boolean {
  return rotated;
}

export function setWorldHeight(h: number) {
  worldHeight = Math.round(
    Math.min(WORLD.maxHeight, Math.max(WORLD.minHeight, h)),
  );
}

export function getWorldHeight(): number {
  return worldHeight;
}

/** Multiplier for every vertical quantity. 1 at the reference height. */
export function vScale(): number {
  return worldHeight / WORLD.refHeight;
}

/**
 * Multiplier for the HUD — its text, icons and margins.
 *
 * The HUD is positioned in world units, so a taller world renders it smaller on
 * screen: on a 4:3 tablet the world is 1280x960, and 18px text drawn into a
 * 960-tall world displayed 768px high lands at ~14px. Legible, but meaner than
 * intended, and it gets worse the taller the world goes.
 *
 * Square-rooted rather than linear. A linear correction would keep the HUD at a
 * constant physical size, which sounds right and is not: on a tall narrow world
 * the HUD would swallow a playfield that has less width to spare. The sqrt
 * splits the difference — the HUD grows, just more slowly than the world does.
 *
 * Deliberately NOT applied to sprites. Sprite dimensions are collision
 * dimensions, so scaling them would resize every hitbox and change the game's
 * difficulty per device — which is exactly what deriving the world height was
 * designed to avoid.
 */
export function hudScale(): number {
  return Math.sqrt(vScale());
}

/**
 * EVERY gameplay number lives here. One file, so balancing is editing data
 * rather than hunting through scenes — and so a change can be reasoned about
 * against its neighbours instead of in isolation.
 *
 * All speeds are px/SECOND and all distances px, at the fixed 1280x720 backing
 * size the Scale manager renders to. Because the canvas is FIT-scaled, these
 * numbers mean the same thing at every viewport size.
 */

export const PLAYER = {
  /** Vertical fly speed. 420 felt right in the step-2 playtest. */
  speed: 420,
  /** Horizontal position as a fraction of width — the world scrolls past. */
  x: 0.2,
  /** Vertical clearance kept from the top/bottom edges. */
  margin: 28,
  /** Sprite scale (texture is drawn at 40px). */
  scale: 1.8,
  /** Collision radius — deliberately smaller than the sprite. See note below. */
  hitRadius: 13,

  lives: 3,
  /** Seconds of invulnerability after being hit, so a respawn is survivable. */
  invulnSeconds: 1.6,
  /** Blink rate while invulnerable, Hz. */
  invulnBlinkHz: 8,

  /** Seconds between shots while the fire key is held. */
  fireCooldown: 0.14,

  /**
   * HEAT — the reason holding the trigger is no longer a strategy.
   *
   * Before this, fire was 5.6 shots/s forever, which put ~10 bullets
   * permanently in flight and covered the whole lane with zero aiming. A run
   * could be won in 26s without ever choosing a target. Tripling the score
   * target would not have fixed that: the same strategy would simply have taken
   * 3x as long.
   *
   * Each shot adds `heatPerShot`; heat bleeds off at `coolPerSecond` whenever
   * the trigger is up. Reaching 1.0 forces a full lockout for
   * `overheatSeconds` — the gun will not fire at all until it clears.
   *
   * Tuned so that:
   *   • a 7-shot burst is free (7 x 0.14 = 0.98, just under the limit)
   *   • HOLDING the trigger overheats in 1.43s — the wall is gone
   *   • full recovery from a lockout takes 3.3s of not firing, so overheating
   *     genuinely costs a stretch of the run
   *   • a disciplined player who bursts and releases never overheats at all
   *
   * So the skill is trigger discipline, and the trigger still feels good — which
   * removing rapid fire entirely would have cost.
   */
  heatPerShot: 0.14,
  coolPerSecond: 0.3,
  overheatSeconds: 1.5,

  /**
   * Points lost per shot that hits nothing (retired at the right edge).
   *
   * Small on purpose. It exists so spraying is *economically* bad as well as
   * mechanically limited, not to punish ordinary misses — at 15 a point a
   * careless player bleeds a few hundred over a run, which is felt but not
   * run-ending.
   */
  missPenalty: 15,
} as const;

export const SHOT = {
  playerSpeed: 780,
  alienSpeed: 300,
  /** Collision radius for both sides' shots. */
  hitRadius: 5,
  /** Pool sizes. Fixed arrays; never allocate mid-run (HANDOFF §4). */
  playerPool: 40,
  alienPool: 60,
} as const;

/**
 * Saucer types. `weight` is relative spawn likelihood within a wave that
 * includes the type; waves.ts decides which types are in play.
 *
 * `pattern` names the movement behaviour implemented in entities/saucer.ts:
 *   straight — constant leftward drift, no vertical change
 *   weave    — leftward drift plus a bounded vertical sine
 *   diver    — leftward drift, easing its Y toward the player's Y
 */
export const SAUCERS = {
  /**
   * The baseline saucer: drifts in fast and shoots. It used to be a harmless
   * "teaching" enemy that never fired, which suited discrete waves — it does
   * not suit a continuous assault where everything should feel like a threat.
   */
  scout: {
    pattern: "drift",
    speed: 140,
    hp: 1,
    scale: 1.1,
    hitRadius: 16,
    points: 100,
    /** Points LOST if this one reaches the left edge. See SCORING below. */
    escapePenalty: 150,
    /** Shots per second. */
    fireRate: 0.3,
    /** Vertical sine amplitude (px) and frequency (Hz) — weave/drift only. */
    weaveAmp: 34,
    weaveHz: 0.28,
    /** Gentle vertical pull toward the player (px/s). */
    trackSpeed: 26,
  },
  weaver: {
    pattern: "weave",
    speed: 115,
    hp: 1,
    scale: 1.2,
    hitRadius: 17,
    points: 150,
    escapePenalty: 225,
    fireRate: 0.5,
    weaveAmp: 90,
    weaveHz: 0.5,
    /** Weavers drift toward the player too, just slowly. */
    trackSpeed: 30,
  },
  diver: {
    pattern: "diver",
    speed: 175,
    /**
     * ONE HIT KILLS, for every kind. A saucer that soaks two shots reads as
     * unresponsive in a game this fast — the player cannot see an HP bar, so the
     * first hit just looks like a miss. Difficulty comes from how many arrive
     * and how hard they shoot (see waves.ts), never from bullet sponges.
     */
    hp: 1,
    scale: 1.15,
    hitRadius: 16,
    points: 250,
    escapePenalty: 375,
    fireRate: 0.6,
    weaveAmp: 0,
    weaveHz: 0,
    /** How hard it chases the player's Y (px/s of vertical correction). */
    trackSpeed: 150,
  },
} as const;

export type SaucerKind = keyof typeof SAUCERS;

/**
 * NOTE ON HIT RADII — these are all smaller than the drawn sprites, on purpose.
 * A shooter feels unfair when a shot that visually missed still kills you, and
 * generous player hitboxes are a genre convention going back to the arcades.
 * The player's box is the most forgiving of all (13 vs a ~72px-wide sprite).
 */

/**
 * SCORING — how a run is won and lost.
 *
 * Two independent failure modes, which is what makes the game a game rather
 * than a survival timer:
 *
 *   1. LIVES — being shot or rammed. Runs out → dead.
 *   2. SCORE — a saucer that reaches the left edge has "got through" and costs
 *      points. Let too many through and the target recedes faster than it can
 *      be earned.
 *
 * The penalty is deliberately MORE than the kill reward (150 vs 100, 225 vs 150,
 * 375 vs 250). That inversion is the whole reason accuracy is the dominant
 * skill: at the old ~72% ratio, "kill one, leak one" was still net POSITIVE
 * (+40), so spraying wildly climbed just fine and aiming was optional.
 *
 * It is not as punishing as it sounds, because the score FLOORS at 0 (below) —
 * a bad patch stalls progress rather than digging a hole the player cannot climb
 * out of, which is what would make the target expert-only.
 *
 * The score floor is 0: escapes stall progress rather than digging a hole a
 * player can never climb out of.
 */
export const SCORING = {
  /**
   * Points needed to win — the discount threshold.
   *
   * Kept at 10000 while the POINT STRUCTURE was made harder instead. Raising the
   * target on the old maths would only have made an easy game longer: escapes
   * used to cost ~72% of a kill, so "kill one, leak one" was still net POSITIVE
   * (+40) and spraying wildly climbed just fine. Accuracy was optional, which is
   * the actual reason it felt easy.
   *
   * Two changes fix that, both below: escapes now cost MORE than the kill was
   * worth, and a combo multiplier rewards not leaking. Modelled outcomes for the
   * 90s clock:
   *
   *   70% accuracy → ~99 kills needed  (will not finish)
   *   85% accuracy → ~49 kills         (borderline)
   *   95% accuracy → ~25 kills         (comfortable win)
   *
   * So the skill that decides a run is now accuracy, not endurance.
   */
  winTarget: 10000,

  /**
   * Seconds to reach the target. Lose when it hits zero.
   *
   * 90s against a modelled 58-74s means a good run has ~20-30s of slack and a
   * sloppy one genuinely runs out. Three properties make it addictive rather
   * than merely hard:
   *
   *   • A run is SHORT. 90s means "one more go" costs almost nothing, which is
   *     the single biggest driver of repeat attempts.
   *   • Failure is always legible. You lose because the clock beat you or
   *     because you leaked too many — never because of something invisible.
   *   • The margin is visible. A near-miss at 9,200 is far more motivating than
   *     a vague loss, so the HUD shows both score and clock at all times.
   */
  timeLimit: 90,

  /** Seconds remaining at which the clock turns red and pulses. */
  timeWarnAt: 15,

  /** Score can never go below this. */
  floor: 0,

  /**
   * COMBO — the multiplier that makes accuracy the dominant skill.
   *
   * Every kill raises it; a single escape resets it to 1. That asymmetry is the
   * whole point: a long clean streak is worth far more than the same kills
   * scattered between leaks, so the player is pushed to intercept EVERYTHING
   * rather than farm whatever is convenient.
   *
   * Capped so a perfect run cannot trivialise the target.
   */
  comboStep: 0.15,
  comboMax: 3,
} as const;

/**
 * MYSTERY BOXES — drifting crates that grant one of two items.
 *
 * The item is hidden until collected (that is the "mystery"), so the decision is
 * always "is that box worth breaking formation for?" rather than "do I want a
 * shield right now". Both items are held in inventory and fired manually with a
 * key, so collecting one is never wasted by bad timing.
 *
 * Two items only, deliberately: each has an obvious, distinct answer to "what
 * problem does this solve?" — the grenade for a screen that has become crowded,
 * the shield for a screen that has become unsurvivable. More items would dilute
 * that without adding a decision.
 */
export const BOX = {
  /** Seconds between box spawns. Randomised ±40% so they are not metronomic. */
  interval: 14,
  /** Drift speed, px/s. Slower than any saucer so it is always catchable. */
  speed: 85,
  scale: 1.2,
  hitRadius: 20,
  /** Bob amplitude/frequency — bounded sine, see the saucer note. */
  bobAmp: 18,
  bobHz: 0.6,
  /** Max boxes alive at once. */
  maxAlive: 2,
  poolSize: 4,
} as const;

export const GRENADE = {
  /**
   * THROWN, not detonated in place.
   *
   * The first version cleared a radius around the craft, which had two problems:
   * it was a panic button with no aim (press when crowded, always correct), and
   * the useful radius had to be huge to reach anything, since saucers approach
   * from the right and the player sits at 20% from the left.
   *
   * Now it is a projectile: it arcs out ahead of the craft and detonates on
   * contact or after `fuseSeconds`. That makes it a THROW the player aims — you
   * lead the target, and a badly-timed grenade misses. Same item, real decision.
   */
  /** Launch speed, px/s. Faster than a saucer closes so it can be led. */
  throwSpeed: 460,
  /** Upward launch component, px/s — gives it a visible arc. */
  throwLift: -120,
  /** Downward acceleration, px/s² — brings the arc back down. */
  gravity: 320,
  /** Detonates automatically after this long if it hits nothing. */
  fuseSeconds: 1.15,
  /** Radius of the blast, px. Smaller than the old area-clear: it is aimed now. */
  radius: 190,
  /** Seconds the blast ring stays visible. */
  flashSeconds: 0.45,
  /** Points per saucer destroyed by the blast — same as shooting it. */
  scoreScale: 1,
  /** Max carried. */
  maxHeld: 3,
} as const;

export const SHIELD = {
  /** Seconds of invulnerability. Long enough to cross a crowded screen. */
  seconds: 6,
  /** Ring radius around the craft, px. */
  radius: 34,
  /** Pulse frequency, Hz — bounded sine. */
  pulseHz: 2.2,
  /** Warn the player when this many seconds remain. */
  warnAt: 1.5,
  maxHeld: 3,
} as const;

export type ItemKind = "grenade" | "shield";
