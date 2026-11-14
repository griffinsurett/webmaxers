// src/game/tilt.ts
/**
 * Device-orientation steering for phones and tablets.
 *
 * On touch the craft is flown by TILTING the device — the Doodle Jump model —
 * which frees the finger to do nothing but fire. Dragging to steer meant the
 * aiming finger and the firing finger were the same finger.
 *
 * ── The four things that make tilt controls feel broken ───────────────────
 * Each is handled explicitly below, because getting any of them wrong produces
 * a control scheme that "works" but is unpleasant in a way that is hard to
 * diagnose:
 *
 *  1. THE AXIS SWAPS. In portrait, side-to-side tilt is `gamma`. Rotate to
 *     landscape and the same physical motion is reported as `beta`, with a sign
 *     that depends on WHICH way it was rotated. Reading a fixed property means
 *     the controls invert when the player turns the phone.
 *  2. REST IS NOT ZERO. Nobody holds a phone flat. Treating 0° as neutral means
 *     the craft drifts constantly. The rest angle is captured on start and can
 *     be re-captured.
 *  3. THE SIGNAL IS NOISY. Raw accelerometer output jitters by a degree or two
 *     at rest, which reads as a twitching craft. It is smoothed, and a dead zone
 *     ignores small deflections entirely.
 *  4. PERMISSION CAN BE DENIED. iOS 13+ requires an explicit grant from inside a
 *     user gesture. If it is denied — or the device has no sensor — this module
 *     reports unavailable and the caller falls back to drag steering.
 */

export interface TiltConfig {
  /** Degrees of tilt for full speed. Past ~30° the screen is too oblique. */
  range: number;
  /** Degrees around rest that produce no movement. */
  deadZone: number;
  /** Smoothing time constant, seconds. */
  tau: number;
}

export const TILT_DEFAULTS: TiltConfig = {
  /**
   * 14, not 26. At 26 a comfortable wrist tilt of ~10 degrees produced only 30%
   * of full speed — 5.6s to cross the field — so the craft felt heavy and
   * unresponsive, and reaching full speed meant tilting the screen far enough
   * to be hard to read. At 14 the same 10 degrees gives ~67%, and full speed
   * arrives at a tilt you can hold while still looking at the screen.
   */
  range: 14,
  /**
   * 2, not 3. The dead zone only has to swallow sensor noise (a degree or two
   * at rest); any larger and it eats the small corrections that aiming is
   * actually made of.
   */
  deadZone: 2,
  /**
   * 0.05, not 0.08. Smoothing is what stops the craft twitching, but every
   * millisecond of it is also input lag. 50ms still removes the jitter while
   * feeling immediate.
   */
  tau: 0.05,
};

/**
 * Readings averaged to establish neutral. At the ~60Hz these events fire, this
 * is roughly a third of a second — long enough for a hand to settle, short
 * enough that the player never notices a delay before the controls respond.
 */
const SETTLE_SAMPLES = 20;

export class TiltInput {
  private cfg: TiltConfig;
  private raw = 0;
  /** Smoothed, dead-zoned, normalised to -1..1. */
  private value = 0;
  private rest: number | null = null;
  /** Readings collected while establishing neutral. See the handler. */
  private settle: number[] = [];
  private active = false;
  private handler: ((e: DeviceOrientationEvent) => void) | null = null;

  constructor(cfg: Partial<TiltConfig> = {}) {
    this.cfg = { ...TILT_DEFAULTS, ...cfg };
  }

  /** True once orientation events are actually arriving. */
  get available(): boolean {
    return this.active;
  }

  /**
   * Ask for permission (iOS) and start listening.
   *
   * MUST be called from inside a user gesture on iOS 13+, or the permission
   * prompt never appears. Returns false if unavailable for any reason — the
   * caller then keeps drag steering.
   */
  async start(): Promise<boolean> {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      return false;
    }

    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (typeof DOE.requestPermission === "function") {
      try {
        const state = await DOE.requestPermission();
        if (state !== "granted") return false;
      } catch {
        // Thrown when not called from a gesture. Treat as unavailable.
        return false;
      }
    }

    this.handler = (e: DeviceOrientationEvent) => {
      const angle = this.sideAngle(e);
      if (angle === null) return;
      this.raw = angle;
      this.active = true;

      // Neutral is captured from a SETTLED hold, not from the first event.
      //
      // The first reading arrives while the player is still lowering the phone
      // from whatever angle they tapped at, so adopting it as neutral bakes in
      // an offset — the craft then drifts steadily in one direction and the
      // player has to hold an awkward angle to counteract it. That is the
      // single most common way tilt controls feel broken.
      //
      // Instead the first `SETTLE_SAMPLES` readings are averaged, which both
      // waits for the hand to stop moving and cancels sensor noise.
      if (this.rest === null) {
        this.settle.push(angle);
        if (this.settle.length >= SETTLE_SAMPLES) {
          this.rest =
            this.settle.reduce((n, v) => n + v, 0) / this.settle.length;
          this.settle.length = 0;
        }
      }
    };

    window.addEventListener("deviceorientation", this.handler, true);

    // Some browsers register the listener but never fire it (no sensor, or a
    // desktop). Give it a moment and report honestly.
    await new Promise((r) => setTimeout(r, 350));
    return this.active;
  }

  stop() {
    if (this.handler) {
      window.removeEventListener("deviceorientation", this.handler, true);
      this.handler = null;
    }
    this.active = false;
    this.rest = null;
    this.settle.length = 0;
    this.value = 0;
  }

  /** Re-capture the current angle as neutral. */
  recalibrate() {
    this.rest = null;
    this.settle.length = 0;
    this.value = 0;
  }

  /**
   * Pick the axis that corresponds to side-to-side tilt for the CURRENT screen
   * orientation, and normalise its sign so positive is always "tilt right".
   */
  private sideAngle(e: DeviceOrientationEvent): number | null {
    const gamma = e.gamma;
    const beta = e.beta;
    if (gamma === null || beta === null) return null;

    // `screen.orientation.angle` is 0 in portrait, 90/270 in landscape.
    const angle =
      typeof screen !== "undefined" && screen.orientation
        ? screen.orientation.angle
        : 0;

    switch (angle) {
      case 90:
        return beta;
      case 270:
      case -90:
        return -beta;
      default:
        return gamma;
    }
  }

  /**
   * Advance the smoother and return steering in -1..1.
   * Positive = tilt right = move the craft "forward" along its control axis.
   */
  update(dt: number): number {
    if (!this.active || this.rest === null) return 0;

    const offset = this.raw - this.rest;
    const sign = Math.sign(offset);
    const mag = Math.abs(offset);

    // Dead zone, then remap so the zone's edge is 0 rather than a step.
    const beyond = Math.max(0, mag - this.cfg.deadZone);
    const span = Math.max(this.cfg.range - this.cfg.deadZone, 1);
    const target = sign * Math.min(beyond / span, 1);

    // Frame-rate-independent smoothing, same form as everywhere else here.
    const k = 1 - Math.exp(-dt / this.cfg.tau);
    this.value += (target - this.value) * k;
    return this.value;
  }
}
