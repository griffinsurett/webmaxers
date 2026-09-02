// src/game/audio.ts
/**
 * All game sound, SYNTHESISED with the Web Audio API at runtime.
 *
 * No audio files, for three reasons:
 *   • zero extra network cost on a page that already ships ~340 KB of Phaser;
 *   • nothing to license — the commercial-use notes (HANDOFF §7) rule out
 *     sampled arcade audio, and synthesising our own sidesteps that entirely;
 *   • the sounds are simple enough (blips, noise bursts, sweeps) that a sample
 *     would be strictly worse than a few oscillator nodes.
 *
 * ── Autoplay policy ────────────────────────────────────────────────────────
 * Browsers refuse to start an AudioContext without a user gesture. Rather than
 * fight that, the context is created lazily on the FIRST call to any play
 * method — which can only happen after the player has pressed something — and
 * `resume()` is attempted each time in case the tab was backgrounded.
 *
 * ── Muting ─────────────────────────────────────────────────────────────────
 * Muting sets the master gain to 0 rather than tearing the context down. That
 * keeps unmuting instant and avoids re-triggering the autoplay dance.
 */

/** Per-sound mix, so relative levels are tuned in one place. */
const LEVEL = {
  shoot: 0.05,
  enemyShoot: 0.035,
  explode: 0.09,
  playerHit: 0.16,
  pickup: 0.12,
  overheat: 0.1,
  grenade: 0.17,
  shield: 0.11,
  uiClick: 0.06,
  win: 0.14,
  lose: 0.14,
} as const;

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted: boolean;
  /** Shared noise buffer — regenerating white noise per shot is wasteful. */
  private noise: AudioBuffer | null = null;

  constructor(muted = true) {
    this.muted = muted;
  }

  /** Create the context on first use; browsers block it before a gesture. */
  private ensure(): boolean {
    if (typeof window === "undefined") return false;

    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return false;

      try {
        this.ctx = new Ctor();
      } catch {
        return false;
      }

      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
    }

    // A context can be suspended by the browser (backgrounded tab, or created
    // before the first gesture landed). Retrying is cheap and idempotent.
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.master !== null;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      // Ramp rather than snap: an instant gain change on a live oscillator
      // produces an audible click.
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.01);
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Stop everything and release the context — called on scene teardown. */
  destroy() {
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
    this.noise = null;
  }

  // ── Primitives ────────────────────────────────────────────────────────────

  /** A pitched blip. `from`/`to` in Hz sweep over `dur` seconds. */
  private tone(
    from: number,
    to: number,
    dur: number,
    level: number,
    type: OscillatorType = "square",
  ) {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur);

    // Short attack, exponential decay — the shape of every arcade blip.
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A filtered noise burst — explosions, impacts. */
  private burst(dur: number, level: number, cutoffFrom: number, cutoffTo: number) {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;

    if (!this.noise) {
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;

    // A downward-sweeping low-pass is what makes noise read as an explosion
    // rather than static.
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoffFrom, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(cutoffTo, 1), t + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ── The game's sounds ─────────────────────────────────────────────────────

  /** Player shot: a short downward chirp. */
  shoot() {
    this.tone(880, 420, 0.07, LEVEL.shoot, "square");
  }

  /** Alien shot: lower and duller, so the two are distinguishable by ear. */
  enemyShoot() {
    this.tone(300, 190, 0.09, LEVEL.enemyShoot, "sawtooth");
  }

  /** Saucer destroyed. */
  explode() {
    this.burst(0.22, LEVEL.explode, 1800, 120);
  }

  /** The player was hit — deliberately the harshest sound in the game. */
  playerHit() {
    this.burst(0.4, LEVEL.playerHit, 900, 60);
    this.tone(220, 60, 0.35, LEVEL.playerHit * 0.6, "sawtooth");
  }

  /** Mystery box collected: a rising two-note flourish. */
  pickup() {
    this.tone(620, 620, 0.07, LEVEL.pickup, "triangle");
    window.setTimeout(() => this.tone(930, 930, 0.1, LEVEL.pickup, "triangle"), 70);
  }

  /** Gun overheated: a descending warning. */
  overheat() {
    this.tone(520, 140, 0.3, LEVEL.overheat, "sawtooth");
  }

  /** Grenade detonation: bigger, longer version of an explosion. */
  grenade() {
    this.burst(0.45, LEVEL.grenade, 2400, 70);
  }

  /** Shield raised: a rising sweep. */
  shield() {
    this.tone(330, 880, 0.28, LEVEL.shield, "triangle");
  }

  /** UI press. */
  uiClick() {
    this.tone(660, 660, 0.05, LEVEL.uiClick, "square");
  }

  /** Victory: a rising arpeggio. */
  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) =>
      window.setTimeout(() => this.tone(f, f, 0.18, LEVEL.win, "triangle"), i * 110),
    );
  }

  /** Defeat: a falling arpeggio — the inverse, so the two are unmistakable. */
  lose() {
    const notes = [440, 349, 262, 196];
    notes.forEach((f, i) =>
      window.setTimeout(() => this.tone(f, f, 0.24, LEVEL.lose, "sawtooth"), i * 140),
    );
  }
}
