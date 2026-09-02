// src/game/scenes/PlayScene.ts
/**
 * The game. Player movement, shooting both ways, saucer waves, lives, score.
 *
 * ── Structure ──────────────────────────────────────────────────────────────
 * This scene deliberately owns almost no rules. It wires together:
 *   tuning.ts    every gameplay number
 *   waves.ts     the difficulty curve, as functions of elapsed time
 *   entities/*   how a saucer moves, how a bullet flies, what overlaps what
 * so balancing means editing data, and behaviour can be reasoned about without
 * a running scene.
 *
 * ── Invariants (HANDOFF §4) ────────────────────────────────────────────────
 * • Everything moves by `speed * dt`, and `dt` comes from Phaser's clamped
 *   delta. Nothing advances per-frame.
 * • Oscillations (weave, invulnerability blink) are `sin` of an age — time
 *   inside a bounded function, never accumulated into a position.
 * • Bullets and saucers are pooled; nothing is allocated mid-run.
 * • All run state is created in `create()`, so restarting the scene is a
 *   genuinely fresh run with nothing inherited.
 */
import Phaser from "phaser";
import { getPalette } from "../palette";
import { TEX } from "./BootScene";
import { createStarfield, updateStarfield, type Star } from "./starfield";
import { reportPhase } from "./phase";
import type { GameAudio } from "../audio";
import { TiltInput } from "../tilt";
import {
  PLAYER, SHOT, SAUCERS, SCORING, BOX, GRENADE, SHIELD, vScale, isRotated,
  hudScale,
  type ItemKind,
} from "../tuning";

/**
 * Vertical inset for the HUD. The readouts were at y=20, which the host page
 * clipped behind browser chrome when the canvas ran to the top of the viewport.
 * 44 keeps them clear of that without eating playfield.
 */
/**
 * ONE margin for the whole HUD, used on all four edges.
 *
 * The top bar previously sat at 44 while the bottom controls sat at 30, and the
 * clock had its own -6 nudge on top of that — so the two bars were neither
 * level with each other nor symmetrical against the frame. A single value means
 * top and bottom are mirror images by construction and cannot drift apart.
 *
 * 30 rather than the old 44: with the game filling the viewport there is no
 * browser chrome to clear, and 44 pushed the bar far enough down that it read as
 * floating inside the playfield rather than framing it.
 */
const HUD_MARGIN = 30;

/**
 * How far past the left edge a saucer travels before it counts as escaped.
 * Small — just enough that it is fully off-screen when the penalty lands, so
 * the player sees it leave rather than vanish mid-flight.
 */
const SAUCER_ESCAPE_X = 30;
import { Pool } from "../entities/pool";
import {
  fireBullet,
  killBullet,
  updateBullet,
  type Bullet,
} from "../entities/bullet";
import {
  spawnSaucer,
  despawnSaucer,
  updateSaucer,
  type Saucer,
} from "../entities/saucer";
import { circlesOverlap } from "../entities/collide";
import { spawnBox, despawnBox, updateBox, type Box } from "../entities/box";
import {
  throwGrenade, clearGrenade, updateGrenade, type Grenade,
} from "../entities/grenade";
import { spawnInterval, fireScale, maxAlive, pickKind } from "../waves";

export class PlayScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private stars: Star[] = [];

  private playerShots!: Pool<Bullet>;
  private alienShots!: Pool<Bullet>;
  private saucers!: Pool<Saucer>;
  /** Seconds until the next saucer is released. */
  private spawnIn = 0;
  private boxes!: Pool<Box>;
  /** Seconds until the next mystery box. */
  private boxIn = 0;
  /** Inventory. Items are held until the player spends them. */
  private held: Record<ItemKind, number> = { grenade: 0, shield: 0 };
  /** Seconds of shield remaining; 0 = inactive. */
  private shieldFor = 0;
  /**
   * Kill combo. Raises the score multiplier; a single escape resets it.
   * Tracked as a COUNT so the multiplier is always derived, never accumulated.
   */
  private combo = 0;
  /** 0 → 1. Reaching 1 forces a lockout. */
  private heat = 0;
  /** Seconds of forced lockout remaining; 0 = gun available. */
  private overheatFor = 0;
  /**
   * True while the trigger must be RELEASED before it will fire again.
   *
   * Set on overheat. Without it, a player holding the trigger through a lockout
   * resumes firing the instant it clears — so overheating cost them 1.5s and no
   * attention, and "hold forever" was still viable in bursts. Requiring a fresh
   * press makes the lockout something the player has to actively recover from.
   */
  private fireLatched = false;
  private shieldRing?: Phaser.GameObjects.Arc;
  /** The one in-flight grenade. Only one may be airborne at a time. */
  private grenade!: Grenade;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyFire!: Phaser.Input.Keyboard.Key;
  private pointerY: number | null = null;
  private pointerFiring = false;

  // Run state.
  private lives = PLAYER.lives;
  private score = 0;
  private fireCooldown = 0;
  private invuln = 0;
  private elapsed = 0;
  /** Seconds left on the clock. Reaching 0 ends the run. */
  private timeLeft: number = SCORING.timeLimit;
  private paused = false;
  private over = false;

  // HUD.
  private hudLives!: Phaser.GameObjects.Text;
  private hudScore!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private grenadeIcon!: Phaser.GameObjects.Image;
  private grenadeCount!: Phaser.GameObjects.Text;
  private shieldIcon!: Phaser.GameObjects.Image;
  private shieldCount!: Phaser.GameObjects.Text;
  private hudHint!: Phaser.GameObjects.Text;
  private hudClock!: Phaser.GameObjects.Text;
  private pauseBtn!: Phaser.GameObjects.Text;
  private soundBtn!: Phaser.GameObjects.Image;
  private heatBar!: Phaser.GameObjects.Rectangle;
  private heatLabel!: Phaser.GameObjects.Text;
  /** Cached palette strings for the floating score popups. */
  private dangerCss = "#f87171";
  private playerCss = "#5e76f6";
  private headingCss = "#fafafa";
  private heatBarColor = 0x5e76f6;
  private audio!: GameAudio;
  private tilt = new TiltInput();
  /** True on coarse-pointer devices — decides the whole input scheme. */
  private isTouch = false;

  /**
   * Stable references for the game-level focus listeners registered in
   * create(). Arrow-function FIELDS, not methods and not inline closures: the
   * handler passed to `off()` must be the same object that was passed to
   * `on()`, which an inline closure can never be.
   */
  private readonly onBlur = () => this.scene.pause();
  private readonly onFocus = () => this.scene.resume();

  constructor() {
    super("Play");
  }

  create() {
    const { width, height } = this.scale;
    const p = getPalette(this.game.canvas.parentElement as HTMLElement);

    // Reset every piece of run state here — the scene may be restarted.
    this.lives = PLAYER.lives;
    this.score = 0;
    this.fireCooldown = 0;
    this.invuln = 0;
    this.elapsed = 0;
    this.timeLeft = SCORING.timeLimit;
    this.over = false;
    this.paused = false;
    this.pointerY = null;
    this.pointerFiring = false;

    // ── The rest of the run state ─────────────────────────────────────────
    // These were previously missing here, so a RESTART inherited the last run's
    // combo, heat, lockout and inventory — a fresh run could begin already
    // holding a x1.6 multiplier and a full grenade stack.
    //
    // EVERY field that changes during a run must be reset in create(), because
    // `scene.restart()` re-runs create() and nothing else. Initialising at
    // declaration is not enough: that runs once per page load, not per run.
    this.combo = 0;
    this.heat = 0;
    this.overheatFor = 0;
    this.fireLatched = false;
    this.shieldFor = 0;
    this.held = { grenade: 0, shield: 0 };
    this.boxIn = BOX.interval * 0.6;
    this.spawnIn = 1.2;
    this.shieldRing?.destroy();
    this.shieldRing = undefined;

    this.dangerCss = p.css.danger;
    this.playerCss = p.css.player;
    this.headingCss = p.css.heading;
    this.heatBarColor = p.int.player;
    this.audio = this.registry.get("audio") as GameAudio;
    this.isTouch =
      typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

    // Tilt steering, touch only. Permission was already requested from the
    // launch tap (TitleScene) — this just picks up the running stream. If it is
    // unavailable, `available` stays false and drag steering below takes over.
    if (this.isTouch) void this.tilt.start();

    this.cameras.main.setBackgroundColor(p.int.bg);
    this.stars = createStarfield(this);

    this.player = this.add
      .image(width * PLAYER.x, height / 2, TEX.player)
      .setScale(PLAYER.scale);

    // ── Pools ─────────────────────────────────────────────────────────────
    this.playerShots = new Pool<Bullet>(SHOT.playerPool, () => ({
      img: this.add.image(0, 0, TEX.shot).setVisible(false).setActive(false),
      active: false,
      vx: 0,
    }));
    this.alienShots = new Pool<Bullet>(SHOT.alienPool, () => ({
      img: this.add.image(0, 0, TEX.shot).setVisible(false).setActive(false),
      active: false,
      vx: 0,
    }));
    this.saucers = new Pool<Saucer>(24, () => ({
      img: this.add.image(0, 0, TEX.saucer).setVisible(false).setActive(false),
      kind: "scout",
      active: false,
      hp: 1,
      baseY: 0,
      age: 0,
      phase: 0,
      fireIn: Infinity,
    }));

    this.boxes = new Pool<Box>(BOX.poolSize, () => ({
      img: this.add.image(0, 0, TEX.box).setVisible(false).setActive(false),
      active: false,
      item: "grenade",
      baseY: 0,
      age: 0,
      phase: 0,
    }));

    this.grenade = {
      img: this.add
        .image(0, 0, TEX.grenadeIcon)
        .setVisible(false)
        .setActive(false)
        .setDepth(12),
      active: false,
      vx: 0,
      vy: 0,
      fuse: 0,
    };


    // ── Input ─────────────────────────────────────────────────────────────
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey("W");
    this.keyS = kb.addKey("S");
    this.keyFire = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    // Space would otherwise also scroll the host page.
    kb.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);

    // ── Pointer steering, with UI excluded ────────────────────────────────
    // `currentlyOver` is Phaser's list of interactive objects under the pointer.
    // If it is non-empty the press landed on a HUD control (sound, pause, item
    // icons), and must NOT also steer or fire.
    //
    // The buttons' own `stopPropagation()` is not enough on its own: it only
    // stops `pointerup`, but this scene-level `pointerdown` has already run by
    // then. That is what made tapping SOUND yank the craft to the bottom of the
    // screen — the button sits at y≈690, and steering follows the press.
    const onUi = (ptr: Phaser.Input.Pointer) =>
      this.input.hitTestPointer(ptr).length > 0;

    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (onUi(ptr)) return;
      this.pointerFiring = true;
      // On touch the pointer ONLY fires — tilting the device steers. Dragging to
      // steer meant the aiming finger and the firing finger were the same
      // finger, so you could not do both. On desktop a click still steers,
      // since there is no tilt there.
      if (!this.isTouch || !this.tilt.available) this.pointerY = ptr.worldY;
    });
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (this.isTouch && this.tilt.available) return;
      // Only steer while an active drag is in progress — a drag that STARTED on
      // the playfield. `pointerFiring` is the flag for that, so a press that
      // began on a button can never turn into steering by moving off it.
      if (ptr.isDown && this.pointerFiring) this.pointerY = ptr.worldY;
    });
    this.input.on("pointerup", () => {
      this.pointerY = null;
      this.pointerFiring = false;
    });

    // ── Pause ─────────────────────────────────────────────────────────────
    // ESC and P both toggle. Handled with our own flag rather than
    // scene.pause(): a paused Phaser scene stops receiving input, so it cannot
    // hear the keypress that would unpause it.
    kb.on("keydown-ESC", () => this.togglePause());
    kb.on("keydown-P", () => this.togglePause());
    kb.on("keydown-M", () => this.toggleSound());
    // R restarts, but ONLY while paused — a mis-hit during play would throw away
    // a run in progress, which is never what the player meant.
    kb.on("keydown-R", () => {
      if (this.paused) this.restartRun();
    });

    // ── Items ─────────────────────────────────────────────────────────────
    // Manually fired, so a pickup is never wasted by bad timing. Q and E sit
    // next to the movement keys without competing with them.
    // Q is the grenade in play and QUIT while paused. Safe to overload: the two
    // states are mutually exclusive, and a paused player pressing Q cannot have
    // meant "throw a grenade" at a frozen screen.
    kb.on("keydown-Q", () => {
      if (this.paused) this.quitToTitle();
      else this.useGrenade();
    });
    kb.on("keydown-E", () => this.useShield());

    // The HUD is laid out against the frame the PLAYER sees, which is the
    // canvas turned on its side in portrait. Everything else in this scene uses
    // world coordinates; the HUD is the one subsystem that must not.
    const hud = this.hudFrame();
    this.buildHud(hud.w, hud.h, p.css.heading, p.css.text);

    // A game loop must never run in a backgrounded tab (HANDOFF §5).
    //
    // These go on `game.events`, which OUTLIVES the scene — unlike `this.events`,
    // Phaser does not clean them up on shutdown. They are therefore stored and
    // removed explicitly in shutdown(); without that, every replay added another
    // pair (create() re-runs on restart and on each Title → Play), so after N
    // runs a single blur fired N pause() calls and leaked N closures.
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur);
    this.game.events.on(Phaser.Core.Events.FOCUS, this.onFocus);

    // Phaser does NOT call a bare `shutdown()` method — only init/preload/
    // create/update are invoked by name. The teardown has to be bound to the
    // scene's SHUTDOWN event or it silently never runs, which is exactly how
    // the sensor listener and the two handlers above were leaking per replay.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);

    reportPhase(this, "playing");
  }

  /**
   * Make the HUD read upright on a portrait phone.
   *
   * On portrait the whole CANVAS is rotated a quarter turn by CSS (see
   * game.css) so this horizontal shooter fills a vertical screen. That rotation
   * is indiscriminate: it lays the score, clock and buttons on their sides
   * along with the starfield, which is fine for a spaceship and useless for
   * text.
   *
   * This wraps the HUD in a container rotated the opposite way, cancelling the
   * CSS turn so the text reads normally. The container sits at the world centre
   * because rotation happens about a container's own origin — anywhere else and
   * the HUD swings off screen.
   *
   * IMPORTANT: this only corrects the ANGLE. It does not re-anchor anything.
   * Callers must lay the HUD out against the frame the player will actually
   * see, which `hudFrame()` reports, rather than against the world's own
   * 1280x620. Getting that wrong is invisible in landscape and puts the score
   * in the middle of the screen in portrait.
   *
   * Landscape is byte-for-byte unchanged: the helper returns immediately.
   */
  private uprightHud(objs: Phaser.GameObjects.GameObject[]): void {
    if (!isRotated()) return;

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Children hold coordinates in the HUD frame, whose origin is the top-left
    // of what the player sees. Convert to container-local space, which is
    // measured from the centre. A container re-parents without adjusting for
    // its own position, so this must happen BEFORE the objects are added or the
    // offset is applied twice.
    // Y is mirrored on the way in. The container rotates +90 to cancel the CSS
    // -90, which lands the glyphs upright but maps the frame's top edge to the
    // screen's bottom.
    //
    // Mirroring Y, not X. Both would restore the layout's orientation, but a
    // mirror moves an object's POSITION without changing its ORIGIN: a
    // right-aligned score mirrored across X keeps extending rightwards from a
    // point now near the left edge, so the two bars end up reversed and
    // clipped. The vertical axis has no such problem, because every HUD row is
    // centred on its baseline rather than aligned to an edge.
    //
    // Callers compensate for the row swap by authoring the bars in the order
    // they should NOT appear — see `buildHud`.
    const { w, h } = this.hudFrame();
    for (const o of objs) {
      const t = o as unknown as { x?: number; y?: number };
      if (typeof t.x !== "number" || typeof t.y !== "number") continue;
      t.x -= w / 2;
      t.y = h / 2 - t.y;
    }

    this.add
      .container(cx, cy, objs)
      .setRotation(isRotated() ? Math.PI / 2 : 0)
      .setDepth(70);
  }

  /**
   * The frame the HUD should be laid out against, in pixels.
   *
   * In landscape this is simply the canvas. In portrait the canvas is rotated a
   * quarter turn, so the dimensions swap: the HUD gets a tall narrow frame even
   * though the game world underneath is still a wide short one.
   *
   * Every HUD position is expressed against this rather than `this.scale`, so
   * the same layout code serves both orientations.
   */
  private hudFrame(): { w: number; h: number } {
    const w = this.scale.width;
    const h = this.scale.height;
    return isRotated() ? { w: h, h: w } : { w, h };
  }

  private buildHud(
    width: number,
    height: number,
    headingCss: string,
    textCss: string,
  ) {
    /**
     * Map a Y coordinate to the row it should END UP in.
     *
     * `uprightHud` mirrors the HUD vertically to undo the portrait canvas
     * rotation, which also swaps the top and bottom bars. Pre-swapping here
     * means both orientations can share one layout: positions are authored once,
     * against the top edge, and land on the correct row either way.
     *
     * Identity in landscape.
     */
    const row = (y: number) => (isRotated() ? height - y : y);
    const style = {
      fontFamily: "system-ui, sans-serif",
      fontSize: "18px",
      color: headingCss,
    };
    this.hudScore = this.add
      .text(HUD_MARGIN, row(HUD_MARGIN), "", style)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    this.hudLives = this.add
      .text(width - HUD_MARGIN, row(HUD_MARGIN), "", style)
      .setOrigin(1, 0.5)
      .setScrollFactor(0);

    // The clock, centre-top. Deliberately the most prominent HUD element after
    // the score: the whole tension of the run is "can I get there in time", and
    // a timer the player has to hunt for cannot create that.
    this.hudClock = this.add
      .text(width / 2, row(HUD_MARGIN), "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "30px",
        fontStyle: "bold",
        color: headingCss,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.banner = this.add
      .text(width / 2, height * 0.38, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "34px",
        fontStyle: "bold",
        color: textCss,
        align: "center",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // ── Inventory, top-left under the score ───────────────────────────────
    // Icons plus a count, rather than text: the player needs to read this at a
    // glance mid-fight. Hidden entirely at zero so an empty inventory is not
    // visual noise.
    const iconStyle = {
      fontFamily: "system-ui, sans-serif",
      fontSize: "16px",
      color: headingCss,
    };

    // ── The inventory icons ARE the touch buttons ─────────────────────────
    // Q and E do not exist on a phone. Rather than adding a second set of
    // on-screen controls, the icons that already show what you are holding
    // double as the way to use it — one thing to look at, not two.
    //
    // Each gets a generous invisible Zone rather than relying on the ~22px
    // sprite: that is far under the ~44px minimum comfortable tap target, and a
    // missed tap during a fight is worse than no button at all.
    this.grenadeIcon = this.add
      .image(HUD_MARGIN + 8, row(HUD_MARGIN + 56), TEX.grenadeIcon)
      .setScrollFactor(0)
      .setVisible(false);

    const grenadeHit = this.add
      .zone(HUD_MARGIN + 8, row(HUD_MARGIN + 52), 68, 68)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(61)
      .setInteractive({ useHandCursor: true });
    grenadeHit.on(
      "pointerup",
      (
        _p: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        // Without this the tap also registers as "fire" via the scene-wide
        // pointer handler, so using an item would shoot at the same time.
        event.stopPropagation();
        this.useGrenade();
      },
    );
    this.grenadeCount = this.add
      .text(HUD_MARGIN + 24, row(HUD_MARGIN + 48), "", iconStyle)
      .setScrollFactor(0)
      .setVisible(false);

    this.shieldIcon = this.add
      .image(HUD_MARGIN + 72, row(HUD_MARGIN + 56), TEX.shieldIcon)
      .setScrollFactor(0)
      .setVisible(false);

    const shieldHit = this.add
      .zone(HUD_MARGIN + 72, row(HUD_MARGIN + 52), 68, 68)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(61)
      .setInteractive({ useHandCursor: true });
    shieldHit.on(
      "pointerup",
      (
        _p: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        this.useShield();
      },
    );
    this.shieldCount = this.add
      .text(HUD_MARGIN + 88, row(HUD_MARGIN + 48), "", iconStyle)
      .setScrollFactor(0)
      .setVisible(false);

    this.hudHint = this.add
      .text(HUD_MARGIN, row(HUD_MARGIN + 78), "tap or Q / E to use", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: textCss,
      })
      .setScrollFactor(0)
      .setAlpha(0.5)
      .setVisible(false);

    // ── Heat bar ──────────────────────────────────────────────────────────
    // A mechanic the player cannot see is a mechanic they cannot manage — the
    // bar IS the feature. Sits directly under the score so it is in the same
    // glance as everything else on the left.
    const HEAT_W = 132;
    // The track. Never mutated, but it still needs a reference so it can join
    // the portrait rotation group with the rest of the HUD.
    const heatTrack = this.add
      .rectangle(HUD_MARGIN, row(HUD_MARGIN + 22), HEAT_W, 8, 0xffffff, 0.14)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.heatBar = this.add
      .rectangle(HUD_MARGIN, row(HUD_MARGIN + 22), 0, 8, 0x000000)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.heatLabel = this.add
      .text(HUD_MARGIN + HEAT_W + 8, row(HUD_MARGIN + 18), "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: textCss,
      })
      .setScrollFactor(0);

    // Pause sits BOTTOM-right rather than top: it was crowding LIVES, and on a
    // phone held in landscape the bottom corners are where thumbs already rest.
    // Its glyph doubles as the state indicator, so label and state cannot
    // disagree. Positioned by the packer below, not here.
    const PAUSE_SIZE = 34;

    // ── Bottom-right control cluster ──────────────────────────────────────
    // Laid out like a flex row: one baseline, one gap, items packed
    // right-to-left from a single anchor. Each element's real measured width
    // advances the cursor, so nothing carries a hand-computed offset and the
    // cluster cannot drift when a label changes length (SOUND ON vs SOUND OFF
    // are different widths — that alone broke the old fixed positions).
    //
    // Vertically every item is centred on ONE baseline, mirroring the top bar's
    // margin exactly, so the two bars are symmetrical against the frame.
    // The bottom row sits at HUD_MARGIN *plus* a lift.
    //
    // Measured: the pause glyph's Text box is 36px tall but the visible bars
    // occupy only ~24px of it, sitting toward the box's bottom. Centring the
    // BOX on `height - HUD_MARGIN` therefore leaves the visible mark just 12px
    // from the canvas edge, which reads as clipped even though nothing is
    // actually cut off. The top bar has no such problem because its text is
    // small and fills its box.
    //
    // Lifting restores the visual symmetry the raw numbers already claimed to
    // have. Tuned by measuring the rendered bounds, not by eye: at 26 the pause
    // box spans 646-682 against the top bar's 20-40, so the visible glyphs sit
    // ~38px from their respective edges.
    const BOTTOM_LIFT = 26;
    const barY = row(height - HUD_MARGIN - BOTTOM_LIFT);
    const BAR_GAP = 22;
    let cursorX = width - HUD_MARGIN;

    /**
     * Place an item's right edge at the cursor, then advance leftwards.
     *
     * Vertical centring uses the object's own measured height rather than
     * origin 0.5, because a Text object's BOX is not its glyph. The pause
     * glyph is a 40px-tall box (fontBoundingBox 33 + 7) containing only 24px of
     * visible mark, so centring the box on the baseline pushed the bars ~9px
     * low and clipped them at the canvas edge. Positioning by the box TOP and
     * subtracting half its height puts the visible glyph where it belongs.
     */
    const packRight = (
      obj: Phaser.GameObjects.Text | Phaser.GameObjects.Image,
      hitW: number,
    ) => {
      obj
        .setOrigin(1, 0)
        .setPosition(cursorX, barY - obj.height / 2)
        .setScrollFactor(0)
        .setDepth(60);
      // Centred origin, and square-ish. In portrait these zones live inside a
      // rotated container, and Phaser hit-tests a rotated Zone against its
      // UNROTATED local rect — so a wide-and-short target becomes tall-and-
      // narrow, and taps that visually land on the glyph miss it. A centred,
      // roughly square zone is the same target either way, and 60px clears the
      // ~44px minimum for touch.
      const hit = Math.max(hitW, 60);
      const zone = this.add
        .zone(cursorX - hitW / 2, barY, hit, hit)
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(61)
        .setInteractive({ useHandCursor: true });
      cursorX -= Math.max(obj.width, hitW) + BAR_GAP;
      return zone;
    };

    // PAUSE — rightmost, since it is the control reached most often.
    this.pauseBtn = this.add.text(0, 0, "❙❙", {
      fontFamily: "system-ui, sans-serif",
      fontSize: `${PAUSE_SIZE}px`,
      color: textCss,
    });
    const pauseHit = packRight(this.pauseBtn, 56);

    // SOUND — to its left. An icon rather than a text label: it is a universally
    // understood control, and "SOUND OFF"/"SOUND ON" were different widths,
    // which shifted the whole cluster every time it was toggled.
    this.soundBtn = this.add
      .image(0, 0, this.audio.isMuted ? TEX.soundOff : TEX.soundOn)
      .setScale(1.15)
      .setTint(this.audio.isMuted ? 0xf87171 : this.heatBarColor);
    const soundHit = packRight(this.soundBtn, 56);

    soundHit.on(
      "pointerup",
      (
        _p: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        this.toggleSound();
      },
    );

    pauseHit.on("pointerover", () => this.pauseBtn.setColor(headingCss));
    pauseHit.on("pointerout", () => this.pauseBtn.setColor(textCss));
    // `pointerup`, not `pointerdown`: pointerdown is also the fire input, so
    // tapping the button would otherwise shoot at the same time.
    pauseHit.on(
      "pointerup",
      (
        _p: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        this.audio.uiClick();
        this.togglePause();
      },
    );

    // ── Pause overlay ─────────────────────────────────────────────────────
    // Built as explicit children so RESUME and RESTART are separate targets.
    //
    // The dim panel is still tappable-to-resume (on touch a small glyph is a
    // poor target, and a paused screen that ignores taps reads as frozen), but
    // the restart button sits ABOVE it in the container's child order and stops
    // propagation — otherwise the panel underneath would swallow the tap and
    // resume instead of restarting.
    const cx = width / 2;
    const cy = height / 2;

    const dim = this.add
      .rectangle(cx, cy, width, height, 0x000000, 0.78)
      .setInteractive()
      .on("pointerup", () => this.togglePause());

    const pausedLabel = this.add
      .text(cx, cy - 58, "PAUSED", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "56px",
        fontStyle: "bold",
        color: headingCss,
      })
      .setOrigin(0.5);

    const resumeHint = this.add
      .text(cx, cy + 4, "Tap anywhere to resume", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: textCss,
      })
      .setOrigin(0.5);

    // RESTART and QUIT, side by side. Both are bordered pills rather than plain
    // text: they are consequential actions on a screen whose main gesture is
    // "tap anywhere to resume", so they have to look like things you aim at on
    // purpose. Both stop propagation — otherwise the dim panel underneath
    // swallows the tap and merely resumes.
    //
    // Colour separates them by consequence: RESTART is destructive (red, it
    // throws away the current run), QUIT is merely navigation (neutral).
    const BTN_W = 190;
    const BTN_H = 52;
    const GAP = 18;
    const btnY = cy + 76;
    const leftX = cx - (BTN_W + GAP) / 2;
    const rightX = cx + (BTN_W + GAP) / 2;

    const pill = (
      x: number,
      label: string,
      colorCss: string,
      colorInt: number,
      onPress: () => void,
    ) => {
      const bg = this.add
        .rectangle(x, btnY, BTN_W, BTN_H, 0x000000, 0)
        .setStrokeStyle(2, colorInt, 0.9)
        .setInteractive({ useHandCursor: true });

      const text = this.add
        .text(x, btnY, label, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "20px",
          fontStyle: "bold",
          color: colorCss,
        })
        .setOrigin(0.5)
        .setLetterSpacing(2);

      bg.on("pointerover", () => bg.setFillStyle(colorInt, 0.16));
      bg.on("pointerout", () => bg.setFillStyle(0x000000, 0));
      bg.on(
        "pointerup",
        (
          _p: Phaser.Input.Pointer,
          _x: number,
          _y: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          event.stopPropagation();
          onPress();
        },
      );

      return [bg, text] as const;
    };

    const [restartBg, restartLabel] = pill(
      leftX,
      "RESTART",
      "#f87171",
      0xf87171,
      () => this.restartRun(),
    );
    const [quitBg, quitLabel] = pill(
      rightX,
      "QUIT",
      textCss,
      0xffffff,
      () => this.quitToTitle(),
    );

    const keyHint = this.add
      .text(cx, cy + 128, "ESC / P resume  •  R restart  •  Q quit  •  M sound", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: textCss,
      })
      .setOrigin(0.5)
      .setAlpha(0.55);

    this.pauseOverlay = this.add
      .container(0, 0, [
        dim,
        pausedLabel,
        resumeHint,
        restartBg,
        restartLabel,
        quitBg,
        quitLabel,
        keyHint,
      ])
      .setDepth(50)
      .setVisible(false);

    // On a portrait phone the canvas is rotated a quarter turn, which would
    // lay all of this text on its side. Counter-rotate both clusters so they
    // read upright. No-op in landscape.
    //
    // The pause overlay is rotated as a single child rather than having its
    // members re-listed: it is already a container, and nesting preserves the
    // `setVisible(false)` toggle that drives it.
    // Enlarge the HUD's CONTENTS on a world taller than the 720 reference,
    // without moving anything. Scaling the whole HUD as one container was tried
    // and pushes the corners off-screen: the margins scale outward too, so on a
    // 4:3 tablet the score landed at x = -64. Scaling each object about its own
    // origin grows the glyphs and icons in place, which is the part that was
    // actually too small.
    const k = hudScale();
    if (Math.abs(k - 1) > 0.01) {
      for (const o of [
        this.hudScore,
        this.hudClock,
        this.hudLives,
        this.grenadeIcon,
        this.grenadeCount,
        this.shieldIcon,
        this.shieldCount,
        this.hudHint,
        this.heatLabel,
        this.pauseBtn,
        this.soundBtn,
      ]) {
        o.setScale(o.scaleX * k, o.scaleY * k);
      }
    }

    this.uprightHud(
      [
        this.hudScore,
        this.hudLives,
        this.hudClock,
        this.banner,
        this.grenadeIcon,
        grenadeHit,
        this.grenadeCount,
        this.shieldIcon,
        shieldHit,
        this.shieldCount,
        this.hudHint,
        heatTrack,
        this.heatBar,
        this.heatLabel,
        this.pauseBtn,
        pauseHit,
        this.soundBtn,
        soundHit,
      ],
    );
    this.uprightHud([this.pauseOverlay]);

    this.syncHud();
  }

  /**
   * Render the clock. Turns red and pulses inside the warning window — the
   * player needs to feel the deadline arriving, not read it.
   */
  /** Current score multiplier. Derived from `combo`, capped by tuning. */
  private get multiplier(): number {
    return Math.min(1 + this.combo * SCORING.comboStep, SCORING.comboMax);
  }

  /**
   * Render the heat bar. Three states, each visually distinct so the player can
   * read them peripherally: cool (accent), hot (amber, >70%), locked (red).
   */
  private syncHeat() {
    const locked = this.overheatFor > 0 || this.fireLatched;
    const frac = Phaser.Math.Clamp(this.heat, 0, 1);
    const full = 132;

    this.heatBar.width = full * frac;
    this.heatBar.setFillStyle(
      locked ? 0xf87171 : frac > 0.7 ? 0xfacc15 : this.heatBarColor,
    );

    this.heatLabel.setText(
      this.overheatFor > 0
        ? "OVERHEATED"
        : this.fireLatched
          ? "RELEASE"
          : frac > 0.7
            ? "HOT"
            : "",
    );
    this.heatLabel.setColor(locked ? this.dangerCss : "#facc15");
  }

  private syncClock() {
    const t = Math.max(0, this.timeLeft);
    this.hudClock.setText(t.toFixed(1));

    if (t <= SCORING.timeWarnAt) {
      this.hudClock.setColor(this.dangerCss);
      // Bounded sine of the remaining time (HANDOFF §4) — pulses faster as it
      // runs down, and stops exactly when the clock does.
      const wave = 0.5 + 0.5 * Math.sin(t * 6 * Math.PI);
      this.hudClock.setScale(1 + wave * 0.12);
    } else {
      this.hudClock.setColor(this.headingCss);
      this.hudClock.setScale(1);
    }
  }

  /**
   * Release everything that outlives the scene. Bound to the SHUTDOWN event in
   * create() — see the note there about why a plain method would never run.
   *
   * An arrow-function field for the same reason as onBlur/onFocus: `off()` must
   * be handed the identical reference that `on()` received.
   */
  private readonly onShutdown = () => {
    this.tilt.stop();
    // Registered on `game.events`, which outlives the scene, so Phaser will
    // not remove these for us.
    this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur);
    this.game.events.off(Phaser.Core.Events.FOCUS, this.onFocus);
  };

  /** Abandon the run and return to the title screen. */
  private quitToTitle() {
    this.paused = false;
    this.over = true; // stop update() touching anything mid-teardown
    this.scene.start("Title");
  }

  /**
   * Abandon this run and start a fresh one.
   *
   * `scene.restart()` re-runs create(), which resets every field there — score,
   * lives, heat, combo, inventory, pools and the clock. That is why all run
   * state is initialised in create() rather than at declaration (HANDOFF §4.3):
   * restart is "make a new run", not "undo the last one".
   */
  private restartRun() {
    this.paused = false;
    this.over = true; // stop update() touching anything mid-teardown
    this.scene.restart();
  }

  /** Flip mute and update the glyph. */
  private toggleSound() {
    const muted = this.audio.toggleMuted();
    this.soundBtn.setTexture(muted ? TEX.soundOff : TEX.soundOn);
    this.soundBtn.setTint(muted ? 0xf87171 : this.heatBarColor);
    // Play a click on UNMUTE so the player immediately hears that it worked —
    // silence is an ambiguous confirmation.
    if (!muted) this.audio.uiClick();
  }

  private togglePause() {
    if (this.over) return;
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    // ❙❙ = "pause available", ▶ = "resume" — the glyph always shows the action
    // the button will take, not the current state.
    this.pauseBtn.setText(this.paused ? "▶" : "❙❙");
  }

  private syncHud() {
    // Progress toward the win target rather than a bare number — the player
    // needs to know what the score is FOR, and how close they are.
    const mult = this.multiplier;
    this.hudScore.setText(
      mult > 1
        ? `${this.score.toString().padStart(5, "0")} / ${SCORING.winTarget}   x${mult.toFixed(1)}`
        : `${this.score.toString().padStart(5, "0")} / ${SCORING.winTarget}`,
    );
    // Warm the score readout as the multiplier climbs, so a hot streak is
    // visible in peripheral vision rather than needing to be read.
    this.hudScore.setColor(mult >= 2 ? this.playerCss : this.headingCss);
    this.hudLives.setText(`LIVES  ${"▲".repeat(Math.max(0, this.lives))}`);

    const g = this.held.grenade;
    const sh = this.held.shield;
    this.grenadeIcon.setVisible(g > 0);
    this.grenadeCount.setVisible(g > 0).setText(`x${g}`);
    this.shieldIcon.setVisible(sh > 0);
    this.shieldCount.setVisible(sh > 0).setText(`x${sh}`);
    this.hudHint.setVisible(g > 0 || sh > 0);
  }

  /** Flash a short message (wave label, "hit", etc.). */
  private flashBanner(text: string, holdMs = 1200) {
    this.banner.setText(text).setAlpha(1);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({
      targets: this.banner,
      alpha: 0,
      delay: holdMs,
      duration: 400,
    });
  }

  update(_time: number, delta: number) {
    if (this.over || this.paused) return;

    const dt = delta / 1000;
    const { width, height } = this.scale;
    const p = getPalette(this.game.canvas.parentElement as HTMLElement);
    this.elapsed += dt;

    // ── Clock ─────────────────────────────────────────────────────────────
    // Ticked before anything else so a run cannot score on the frame after time
    // is already up.
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.syncClock();
      this.finish(false);
      return;
    }
    this.syncClock();

    updateStarfield(this, this.stars, dt);
    this.updatePlayer(dt, height);
    this.updateFiring(dt, p.int.shot);
    this.updateWaves(dt, width, height, p.int.alien, p.int.danger);
    this.updateBoxes(dt, width, height);
    this.updateGrenadeFlight(dt, width, height);
    this.updateBullets(dt, width);
    this.updateShield(dt);
    this.resolveCollisions(p);
  }

  // ── Player ──────────────────────────────────────────────────────────────

  private updatePlayer(dt: number, height: number) {
    const up = this.cursors.up.isDown || this.keyW.isDown;
    const down = this.cursors.down.isDown || this.keyS.isDown;

    // Vertical speed scales with the world's height, so the time to cross
    // top-to-bottom is the same on every device (see tuning.ts). Without this a
    // portrait phone's 2800px-tall world would take 6.7s to cross and dodging
    // would be impossible.
    const speed = PLAYER.speed * vScale();
    const margin = PLAYER.margin * vScale();

    let vy = 0;
    const tilt = this.isTouch ? this.tilt.update(dt) : 0;

    if (up && !down) vy = -speed;
    else if (down && !up) vy = speed;
    else if (this.tilt.available) {
      // Tilt sets a VELOCITY, not a position — holding a tilt keeps moving,
      // which is what makes it feel like flying rather than dragging a cursor.
      //
      // No `Math.abs(tilt) > 0` guard. That looked harmless and was the single
      // worst thing about the touch controls: holding the phone LEVEL returns
      // exactly 0, the branch fell through to the pointer case, and the craft
      // snapped toward wherever the player last tapped. Since tapping is how you
      // fire, every shot yanked the craft. Once tilt is available it owns
      // steering outright, and a zero reading means "hold still".
      vy = tilt * speed;
    } else if (this.pointerY !== null) {
      const diff = this.pointerY - this.player.y;
      vy = Math.abs(diff) < 4 * vScale()
        ? 0
        : Phaser.Math.Clamp(diff * 8, -speed, speed);
    }

    this.player.y = Phaser.Math.Clamp(
      this.player.y + vy * dt,
      margin,
      height - margin,
    );

    // Bank into travel — bounded function of current velocity.
    this.player.setAngle((vy / speed) * 12);

    // Invulnerability: blink is sin of the remaining time, so it is bounded and
    // ends exactly when the timer does.
    if (this.invuln > 0) {
      this.invuln -= dt;
      const blink = Math.sin(this.invuln * PLAYER.invulnBlinkHz * Math.PI * 2);
      this.player.setAlpha(blink > 0 ? 1 : 0.25);
      if (this.invuln <= 0) this.player.setAlpha(1);
    }
  }

  private updateFiring(dt: number, tint: number) {
    this.fireCooldown -= dt;
    const wantsFire = this.keyFire.isDown || this.pointerFiring;

    // ── Lockout ───────────────────────────────────────────────────────────
    // While overheated the gun is dead. Heat still bleeds off, so the lockout
    // and the cooling run together rather than stacking.
    if (this.overheatFor > 0) {
      this.overheatFor -= dt;
      this.heat = Math.max(0, this.heat - PLAYER.coolPerSecond * dt);
      if (this.overheatFor <= 0) {
        this.overheatFor = 0;
        this.heat = 0;
        // Only announce readiness once the trigger is actually free — telling a
        // player "READY" while their held trigger is still locked out is a lie.
        this.flashBanner(wantsFire ? "RELEASE TO RESET" : "READY", 500);
      }
      this.syncHeat();
      return;
    }

    // Cool whenever the trigger is up. This is what makes bursting free and
    // holding expensive — the whole mechanic is in these two branches.
    if (!wantsFire) {
      // Releasing clears the latch: the next press is a fresh trigger pull.
      this.fireLatched = false;
      this.heat = Math.max(0, this.heat - PLAYER.coolPerSecond * dt);
      this.syncHeat();
      return;
    }

    // Held through an overheat: the gun stays dead until the trigger is let go.
    if (this.fireLatched) {
      this.syncHeat();
      return;
    }

    if (this.fireCooldown > 0) return;

    const b = this.playerShots.get();
    if (!b) return; // pool exhausted: drop the shot, never grow
    fireBullet(b, this.player.x + 34, this.player.y, true, tint);
    this.audio.shoot();
    this.fireCooldown = PLAYER.fireCooldown;

    this.heat += PLAYER.heatPerShot;
    if (this.heat >= 1) {
      this.heat = 1;
      this.overheatFor = PLAYER.overheatSeconds;
      // Require a fresh press once the lockout clears — see `fireLatched`.
      this.fireLatched = true;
      this.audio.overheat();
      this.flashBanner("OVERHEATED", 800);
      this.cameras.main.shake(120, 0.004);
    }
    this.syncHeat();
  }

  // ── Waves ───────────────────────────────────────────────────────────────

  private updateWaves(
    dt: number,
    width: number,
    height: number,
    alienTint: number,
    dangerTint: number,
  ) {
    // ── Continuous escalation ─────────────────────────────────────────────
    // No waves and no breaks: saucers arrive on a timer whose interval tightens
    // with elapsed time, capped by how many may be alive at once so the screen
    // stays readable. See waves.ts.
    const alive = this.saucers.activeCount;
    this.spawnIn -= dt;

    if (this.spawnIn <= 0 && alive < maxAlive(this.elapsed)) {
      const s = this.saucers.get();
      if (s) {
        const kind = pickKind(this.elapsed);
        const y = Phaser.Math.Between(
          Math.round((PLAYER.margin + 30) * vScale()),
          Math.round(height - (PLAYER.margin + 30) * vScale()),
        );
        spawnSaucer(s, kind, width + 40, y, alienTint);
      }
      this.spawnIn = spawnInterval(this.elapsed);
    }

    const scale = fireScale(this.elapsed);

    this.saucers.forEachActive((s) => {
      const wantsFire = updateSaucer(s, dt, this.player.y, scale);

      if (wantsFire) {
        const b = this.alienShots.get();
        if (b) {
          fireBullet(b, s.img.x - 22, s.img.y, false, dangerTint);
          this.audio.enemyShoot();
        }
      }

      // ── Escape: it reached the left edge ──────────────────────────────
      // This is the game's second failure mode. A saucer that gets past costs
      // points, which is what stops the player from simply dodging everything
      // and waiting out the clock — every saucer must actually be dealt with.
      //
      // Note the threshold is the LEFT EDGE, not just past the craft: the flight
      // between the two is the player's last chance to turn and take the shot,
      // and removing it early would make near-misses feel stolen.
      if (s.img.x < -SAUCER_ESCAPE_X) {
        this.escape(s);
      }
    });
  }

  // ── Mystery boxes ───────────────────────────────────────────────────────

  private updateBoxes(dt: number, width: number, height: number) {
    this.boxIn -= dt;

    if (this.boxIn <= 0 && this.boxes.activeCount < BOX.maxAlive) {
      const b = this.boxes.get();
      if (b) {
        // The roll happens HERE, at spawn — so a box's contents are fixed from
        // the moment it appears rather than decided on touch.
        const item: ItemKind = Math.random() < 0.5 ? "grenade" : "shield";
        const y = Phaser.Math.Between(
          Math.round((PLAYER.margin + 50) * vScale()),
          Math.round(height - (PLAYER.margin + 50) * vScale()),
        );
        spawnBox(b, width + 40, y, item);
      }
      // ±40% jitter so boxes never feel metronomic.
      this.boxIn = BOX.interval * (0.6 + Math.random() * 0.8);
    }

    this.boxes.forEachActive((b) => {
      updateBox(b, dt);
      // Missed boxes cost nothing — they are a bonus, not an obligation.
      if (b.img.x < -40) despawnBox(b);
    });
  }

  private collectBox(b: Box) {
    const max = b.item === "grenade" ? GRENADE.maxHeld : SHIELD.maxHeld;
    const atCap = this.held[b.item] >= max;

    if (!atCap) this.held[b.item] += 1;

    despawnBox(b);
    this.audio.pickup();
    this.syncHud();

    this.floatText(
      b.img.x,
      b.img.y,
      atCap
        ? "MAX"
        : b.item === "grenade"
          ? "GRENADE!"
          : "SHIELD!",
      atCap ? this.dangerCss : this.playerCss,
    );
  }

  // ── Items ───────────────────────────────────────────────────────────────

  /**
   * Grenade: destroys every saucer within GRENADE.radius of the craft, scoring
   * each as a normal kill. Answers the "screen has become crowded" problem.
   */
  /**
   * Throw a grenade. It arcs out ahead of the craft and detonates on contact
   * with a saucer, on leaving the screen, or when its fuse expires.
   *
   * Refuses while one is already airborne — otherwise a player could dump their
   * whole inventory in a frame, which is the panic-button behaviour this replaced.
   */
  private useGrenade() {
    if (this.paused || this.over || this.held.grenade <= 0) return;
    if (this.grenade.active) return;

    this.held.grenade -= 1;
    this.syncHud();

    const p = getPalette(this.game.canvas.parentElement as HTMLElement);
    throwGrenade(
      this.grenade,
      this.player.x + 30,
      this.player.y,
      p.int.danger,
    );
  }

  private updateGrenadeFlight(dt: number, width: number, height: number) {
    const g = this.grenade;
    if (!g.active) return;

    const fuseOut = updateGrenade(g, dt);

    // Contact with a saucer detonates early — that is the skill shot.
    let hit = false;
    this.saucers.forEachActive((s) => {
      if (hit) return;
      const def = SAUCERS[s.kind];
      if (
        circlesOverlap(g.img.x, g.img.y, 12, s.img.x, s.img.y, def.hitRadius)
      ) {
        hit = true;
      }
    });

    const offscreen =
      g.img.x > width + 40 || g.img.y < -40 || g.img.y > height + 40;

    if (hit || fuseOut || offscreen) {
      this.detonate(g.img.x, g.img.y);
      clearGrenade(g);
    }
  }

  /** The blast: everything within GRENADE.radius of the impact point. */
  private detonate(x: number, y: number) {
    const p = getPalette(this.game.canvas.parentElement as HTMLElement);

    const ring = this.add
      .circle(x, y, 10, p.int.danger, 0.25)
      .setStrokeStyle(3, p.int.danger, 0.9)
      .setDepth(20);
    this.tweens.add({
      targets: ring,
      radius: GRENADE.radius,
      alpha: 0,
      duration: GRENADE.flashSeconds * 1000,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });

    let killed = 0;
    this.saucers.forEachActive((s) => {
      const dx = s.img.x - x;
      const dy = s.img.y - y;
      if (dx * dx + dy * dy <= GRENADE.radius * GRENADE.radius) {
        this.combo += 1;
        this.score += Math.round(
          SAUCERS[s.kind].points * GRENADE.scoreScale * this.multiplier,
        );
        this.burst(s.img.x, s.img.y, p.int.alien);
        despawnSaucer(s);
        killed++;
      }
    });

    // Clear alien fire in the blast too — a grenade that removes the saucers but
    // leaves their last volley in flight reads as broken.
    this.alienShots.forEachActive((b) => {
      const dx = b.img.x - x;
      const dy = b.img.y - y;
      if (dx * dx + dy * dy <= GRENADE.radius * GRENADE.radius) killBullet(b);
    });

    this.cameras.main.shake(200, 0.009);
    this.audio.grenade();
    this.syncHud();
    this.flashBanner(killed > 0 ? `${killed} DESTROYED` : "MISSED", 650);

    if (this.score >= SCORING.winTarget) this.finish(true);
  }

  /**
   * Shield: temporary invulnerability. Answers the "screen has become
   * unsurvivable" problem. Stacks by REFRESHING rather than adding, so holding
   * two shields is insurance, not a 12-second window.
   */
  private useShield() {
    if (this.paused || this.over || this.held.shield <= 0) return;
    if (this.shieldFor > 0) return; // already up — do not waste it
    this.held.shield -= 1;
    this.shieldFor = SHIELD.seconds;
    this.audio.shield();
    this.syncHud();
    this.flashBanner("SHIELD UP", 700);
  }

  private updateShield(dt: number) {
    if (this.shieldFor <= 0) {
      this.shieldRing?.destroy();
      this.shieldRing = undefined;
      return;
    }

    this.shieldFor -= dt;
    const p = getPalette(this.game.canvas.parentElement as HTMLElement);

    if (!this.shieldRing) {
      this.shieldRing = this.add
        .circle(0, 0, SHIELD.radius)
        .setStrokeStyle(2.5, p.int.player, 0.9)
        .setDepth(15);
    }

    this.shieldRing.setPosition(this.player.x, this.player.y);

    // Pulse, and blink faster once it is about to lapse — the warning has to be
    // unmistakable or the shield expiring feels like a bug. Bounded sine of the
    // remaining time (HANDOFF §4).
    const expiring = this.shieldFor <= SHIELD.warnAt;
    const hz = expiring ? SHIELD.pulseHz * 3 : SHIELD.pulseHz;
    const wave = 0.5 + 0.5 * Math.sin(this.shieldFor * hz * Math.PI * 2);
    this.shieldRing.setAlpha(expiring ? 0.25 + 0.75 * wave : 0.55 + 0.45 * wave);

    if (this.shieldFor <= 0) {
      this.shieldRing.destroy();
      this.shieldRing = undefined;
      this.flashBanner("SHIELD DOWN", 600);
    }
  }

  private updateBullets(dt: number, width: number) {
    this.playerShots.forEachActive((b) => {
      updateBullet(b, dt);
      // Off the right edge = it hit nothing. Small cost so spraying is
      // economically bad too, not merely heat-limited.
      if (b.img.x > width + 20) {
        killBullet(b);
        if (this.score > SCORING.floor) {
          this.score = Math.max(SCORING.floor, this.score - PLAYER.missPenalty);
          this.syncHud();
        }
      }
    });
    this.alienShots.forEachActive((b) => {
      updateBullet(b, dt);
      if (b.img.x < -20) killBullet(b);
    });
  }

  // ── Collisions ──────────────────────────────────────────────────────────

  private resolveCollisions(p: ReturnType<typeof getPalette>) {
    // Player shots vs saucers.
    this.playerShots.forEachActive((b) => {
      this.saucers.forEachActive((s) => {
        if (!b.active || !s.active) return;
        const def = SAUCERS[s.kind];
        if (
          circlesOverlap(
            b.img.x, b.img.y, SHOT.hitRadius,
            s.img.x, s.img.y, def.hitRadius,
          )
        ) {
          killBullet(b);
          s.hp -= 1;
          if (s.hp <= 0) {
            this.combo += 1;
            const mult = this.multiplier;
            const gained = Math.round(def.points * mult);
            this.score += gained;
            this.syncHud();
            // Show the multiplier on the popup once it is actually doing
            // something, so the player can see WHY a kill was worth more.
            this.floatText(
              s.img.x,
              s.img.y,
              mult > 1 ? `+${gained}  x${mult.toFixed(1)}` : `+${gained}`,
              this.playerCss,
            );
            this.burst(s.img.x, s.img.y, p.int.alien);
            this.audio.explode();
            despawnSaucer(s);
            // Winning is a SCORE threshold, so it can only ever be reached here.
            if (this.score >= SCORING.winTarget) this.finish(true);
          } else {
            // Damaged but alive: flash white so the hit registers.
            s.img.setTint(0xffffff);
            this.time.delayedCall(70, () => s.active && s.img.setTint(p.int.alien));
          }
        }
      });
    });

    // Player vs boxes. Checked before the damage tests so a box collected on the
    // same frame as a hit still counts.
    this.boxes.forEachActive((b) => {
      if (
        circlesOverlap(
          b.img.x, b.img.y, BOX.hitRadius,
          this.player.x, this.player.y, PLAYER.hitRadius,
        )
      ) {
        this.collectBox(b);
      }
    });

    // The shield makes the player immune exactly as respawn invulnerability
    // does — one check covers both so they can never disagree.
    if (this.invuln > 0 || this.shieldFor > 0) return;

    // Alien shots vs player.
    this.alienShots.forEachActive((b) => {
      if (
        circlesOverlap(
          b.img.x, b.img.y, SHOT.hitRadius,
          this.player.x, this.player.y, PLAYER.hitRadius,
        )
      ) {
        killBullet(b);
        this.hitPlayer(p);
      }
    });

    // Saucers ramming the player.
    this.saucers.forEachActive((s) => {
      if (this.invuln > 0 || this.shieldFor > 0) return;
      const def = SAUCERS[s.kind];
      if (
        circlesOverlap(
          s.img.x, s.img.y, def.hitRadius,
          this.player.x, this.player.y, PLAYER.hitRadius,
        )
      ) {
        this.burst(s.img.x, s.img.y, p.int.alien);
        despawnSaucer(s);
        this.hitPlayer(p);
      }
    });
  }

  private hitPlayer(p: ReturnType<typeof getPalette>) {
    this.lives -= 1;
    this.syncHud();
    this.burst(this.player.x, this.player.y, p.int.player);
    this.audio.playerHit();
    this.cameras.main.shake(180, 0.008);

    if (this.lives <= 0) {
      this.finish(false);
      return;
    }

    this.invuln = PLAYER.invulnSeconds;
    this.flashBanner(`${this.lives} LEFT`, 600);
  }

  /**
   * A saucer reached the left edge. Deduct its penalty, tell the player clearly,
   * and retire it.
   */
  private escape(s: Saucer) {
    const def = SAUCERS[s.kind];
    const penalty = def.escapePenalty;

    // Floor at 0: escapes should stall progress, not dig an unrecoverable hole.
    const before = this.score;
    this.score = Math.max(SCORING.floor, this.score - penalty);
    const lost = before - this.score;

    despawnSaucer(s);
    this.syncHud();

    // Only shout about it if points were actually lost — at a score of 0 the
    // message would be a lie.
    // The reset is the real cost of a leak — often worth more than the points.
    const brokeStreak = this.combo >= 3;
    this.combo = 0;
    this.syncHud();

    if (lost > 0) {
      this.floatText(
        this.player.x + 40,
        s.img.y,
        `-${lost}`,
        this.dangerCss,
      );
      this.flashBanner(
        brokeStreak ? "COMBO LOST" : "SAUCER GOT THROUGH",
        700,
      );
      // A brief red pulse at the left edge: the direction the threat leaked.
      this.leakFlash();
    }
  }

  /** Rising, fading number at a world position — the standard score feedback. */
  private floatText(x: number, y: number, text: string, colorCss: string) {
    const t = this.add
      .text(x, y, text, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: colorCss,
      })
      .setOrigin(0.5)
      .setDepth(40);

    this.tweens.add({
      targets: t,
      y: y - 46,
      alpha: 0,
      duration: 850,
      ease: "Cubic.easeOut",
      onComplete: () => t.destroy(),
    });
  }

  /** Red wash down the left edge — shows WHERE the leak happened. */
  private leakFlash() {
    const g = this.add
      .rectangle(0, this.scale.height / 2, 10, this.scale.height, 0xff0000, 0.5)
      .setOrigin(0, 0.5)
      .setDepth(30);
    this.tweens.add({
      targets: g,
      alpha: 0,
      width: 60,
      duration: 380,
      onComplete: () => g.destroy(),
    });
  }

  /** A small expanding ring — cheap stand-in for a particle explosion. */
  private burst(x: number, y: number, tint: number) {
    const ring = this.add.circle(x, y, 6, tint, 0.9);
    this.tweens.add({
      targets: ring,
      radius: 34,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy(),
    });
  }

  private finish(won: boolean) {
    if (this.over) return;
    this.over = true;
    if (won) this.audio.win();
    else this.audio.lose();
    reportPhase(this, won ? "won" : "dead");
    this.scene.start("GameOver", {
      won,
      score: this.score,
      timeLeft: Math.max(0, this.timeLeft),
      wave: Math.floor(this.elapsed / 15) + 1, // "wave" now = survival milestones
      durationMs: Math.round(this.elapsed * 1000),
    });
  }
}
