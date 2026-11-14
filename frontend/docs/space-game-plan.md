# Space Game — Build Plan

**Status:** planning only. Nothing implemented. No reward/discount mechanic in
scope yet — this covers the game itself and how it is built.

**Concept:** a green alien armada of flying saucers is threatening the business.
The player flies a human craft through space, moving up and down, shooting
saucers and dodging their fire. Told as a light, witty cartoon story with a
rocket-blastoff loader.

**Home:** its own page at `/game`. The homepage gets, at most, a small teaser
card that links to it — the homepage's critical path stays untouched.

---

## 1. Which arcade game to model — and the commercial-use question

### The model: Defender (Williams, 1980) + a Gradius-style scroll

The described feel — craft moves **vertically** while space scrolls
**horizontally**, waves of enemies to shoot, incoming fire to dodge — is
essentially **Defender**, with the side-scrolling structure of **Gradius**
(Konami, 1985). That lineage is the right one to copy:

| Element | Taken from | Why |
|---|---|---|
| Vertical player movement, horizontal scroll | Defender | Exactly the requested control scheme |
| Wave/formation enemy spawning | Galaxian | Readable difficulty curve, easy to author |
| Enemy fire the player must dodge | Galaxian / Gradius | Turns it from a shooting gallery into a game |
| Power-ups on wave clear | Gradius | Gives progression without extra systems |

### What is and is not safe to reuse commercially

**Safe — game mechanics are not protectable.** Rules, controls, physics,
scoring, wave patterns and level structure are ideas, not expression. There is a
long commercial history of shooters reimplementing exactly these mechanics.
Reimplementing Defender's control scheme from scratch is fine.

**Not safe — the expression:**

- **Sprite art.** Do not trace or recreate any original sprites. All art here is
  original: our own green saucers, our own player craft.
- **Names.** Never ship "Defender", "Galaxian", "Gradius", "Space Invaders", or
  any recognisable title. Internally describe it as "a Defender-style
  horizontal shooter".
- **Sound and music.** No sampled arcade audio. Synthesise our own with
  WebAudio.
- **Distinctive characters.** Generic flying saucers are fine. Specific
  copyrighted creature designs are not.

**Specifically avoid Space Invaders as the reference.** Taito actively licenses
and enforces that design, and its pixel-crab alien is both iconic and defended.
Flying saucers are generic prior art going back to 1950s serials;
crabs-in-descending-formation are not. This is why the concept's own "flying
saucers" framing is the safer instinct.

**Also worth noting:** "old arcade game" does not mean public domain. The 1980
games are still in copyright and many are actively relicensed. What protects
this project is that we are copying *mechanics* and drawing *our own*
everything else — not that the originals are old.

---

## 2. Architecture

### 2.1 Do not build the game loop in React

The instinct to make it "a big React island" should be resisted for the game
itself. The game is a `<canvas>` driven by a requestAnimationFrame loop. React's
reconciler contributes nothing to that and costs:

- ~188 KB for `react-core` (the exact bundle this codebase just removed from the
  homepage critical path)
- per-frame overhead and GC pressure in a loop that must hit 60 fps
- an awkward fit: game state changes every frame, which is the one thing React's
  render model is worst at

The game is **vanilla TypeScript** writing to a canvas. React is only worth
using for the surrounding shell (menus, HUD, story panels) — and even there it
is optional, since Astro renders that markup for free.

### 2.2 Load on CLICK, not on visible

`client:visible` would ship the whole game bundle to every visitor who scrolls
past it, most of whom never play. The game loads on an explicit interaction:

```
 poster art + "Play" button        ← 0 KB of game code
            ↓  click
 rocket-blastoff loader            ← covers the real bundle fetch
            ↓
 game canvas + loop
```

The repo already has a `client:click` directive
(`src/integrations/client-directives/click.ts`) that takes a `selector`, so the
Play button can trigger hydration directly. This also gives the blastoff loader
an honest job: it covers actual load time instead of being decorative delay.

### 2.3 File layout

```
src/pages/game.astro                 the /game route
src/components/SpaceGame/
  SpaceGame.astro                    poster + Play button + client:click island
  GameMount.tsx                      thin island: canvas el + start/stop lifecycle
  engine/
    state.ts                         ONE state object; reset() = new game
    loop.ts                          fixed-timestep accumulator + rAF
    input.ts                         keyboard, touch, pointer → intent flags
    entities.ts                      player, saucer, bullet, particle types
    waves.ts                         spawn tables, difficulty curve
    collision.ts                     circle/AABB tests
    render.ts                        all drawing; the only file touching ctx
    audio.ts                         WebAudio blips, muted by default
  story/
    beats.ts                         the invasion script as data
  art/                               original sprites / vector draw functions
```

`render.ts` being the only module that touches the canvas context matters: it
keeps update logic testable in isolation and makes it obvious that update never
draws and draw never mutates.

### 2.4 Reuse what already exists

- **`StarfieldCanvas.tsx`** already implements a twinkling canvas starfield with
  shooting stars, run-gated and motion-aware. It is the scrolling backdrop —
  extract the star-drawing into the game's `render.ts` rather than writing a
  second one.
- **`useMotionPreference`** must gate the game the same way the rest of the site
  is gated. See §5.
- **The `client:click` directive** already exists; no new directive needed.

---

## 3. Engine invariants

These are non-negotiable, and they come from bugs already fought in this
codebase's 3D hero logo. See `docs/hero-logo-3d-spec.md` §3 for the full
post-mortem — the same three mistakes are the ones a game loop invites.

### 3.1 Fixed timestep, clamped, with an accumulator

```ts
const STEP = 1 / 60;              // simulate at a fixed 60 Hz
let acc = 0;
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);   // clamp: tab-switch guard
  last = now;
  acc += dt;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  render(acc / STEP);             // interpolation factor for smooth draw
}
```

Never `x += speed` per frame. That makes velocity a function of frame rate: the
game runs at double speed on a 120 Hz display and slows on a dropped frame. The
clamp stops a backgrounded tab from teleporting everything on return.

### 3.2 Time only inside bounded functions

Anything that oscillates — hovering saucers, pulsing shields, drifting
formations — uses `sin`/`cos` of time. A bare `time * rate` fed to a position or
an angle grows without bound. In the 3D logo this produced shards spinning 206
times after 15 minutes on the page.

### 3.3 One state object

```ts
interface GameState {
  phase: 'title' | 'story' | 'playing' | 'paused' | 'dead' | 'won';
  tick: number;
  player: Player;
  saucers: Saucer[];
  bullets: Bullet[];
  particles: Particle[];
  wave: number;
  score: number;
  lives: number;
}
```

Pause is `phase = 'paused'`. Restart is `state = createState()`. No state hidden
in closures or module scope, or restart leaks the previous run.

### 3.4 Object pooling for bullets and particles

Bullets and explosion particles are created and destroyed constantly.
Allocating per shot causes GC pauses that read as stutter. Pre-allocate fixed
arrays with an `active` flag and reuse slots.

---

## 4. Gameplay design

### 4.1 Controls

| Input | Action |
|---|---|
| ↑ / ↓, W / S | move craft up and down |
| Space / click / tap | fire |
| Touch drag | move (position follows finger) |
| Esc / P | pause |

The craft's horizontal position is fixed at roughly 20% from the left edge; the
world scrolls past it. Vertical movement is velocity-based with light
acceleration and damping so it feels like a craft rather than a cursor.

### 4.2 Enemies

| Type | Behaviour | Introduced |
|---|---|---|
| **Scout** | Straight line, no fire | Wave 1 |
| **Weaver** | Sine-wave vertical path, occasional shot | Wave 2 |
| **Diver** | Tracks the player's Y, charges | Wave 3 |
| **Carrier** | Slow, high HP, releases two Scouts on death | Wave 5 |
| **Mothership** | Boss: multi-phase fire pattern | Wave 8 |

All are green flying saucers, visually distinguished by size, hull detail and
glow colour — original art throughout.

### 4.3 Difficulty curve

Eight waves plus a boss, aiming at a 3–5 minute run. Per wave, scale: saucer
count, speed, fire rate, and how many enemy types are mixed. Author these as a
**table in `waves.ts`**, not as code branches — tuning should be data editing.

### 4.4 The story

Told in short beats between waves — a few lines over the starfield, skippable.
Voice: witty, self-aware, mildly absurd, in the site's own tone. Content lives
in `story/beats.ts` as data.

Rough arc: saucers appear over the office → they are jamming the website →
they are stealing the page-speed scores → mothership arrives → victory.

The "win" state is reached but rewards nothing yet. When a reward is added
later it hooks the `phase === 'won'` transition — a single, clearly marked
place.

---

## 5. Accessibility and performance

Non-negotiable, and consistent with how the rest of the site behaves.

- **Reduced motion.** Read `readMotionPreference()`. Under reduced motion the
  game is not auto-started or auto-animated. Offer it as an explicit opt-in
  ("Motion-heavy game — play anyway?") rather than silently running a shooter
  at someone who asked for less motion.
- **Keyboard playable.** Full play with arrows + space, no pointer required.
- **Pause on blur.** `visibilitychange` and window blur both pause. A game loop
  must never run in a backgrounded tab.
- **Zero cost when not played.** No game code in the initial bundle — the poster
  is a static image and the Play button is plain markup.
- **Cap the render.** `devicePixelRatio` clamped to 2, as `StarfieldCanvas`
  already does.
- **Mobile.** Touch controls are first-class, but consider gating the boss wave's
  denser patterns on small screens where the craft is a larger share of the
  playfield.

---

## 6. Build order

Each step ends somewhere playable or visibly working, so it can be judged
before the next begins.

1. **Skeleton** — `/game` route, poster, Play button, `client:click` hydration,
   empty canvas that resizes correctly. Confirm 0 KB of game JS before click.
2. **Loop + player** — fixed-timestep loop, starfield backdrop, craft that moves
   up and down. Verify frame-rate independence by throttling.
3. **Shooting** — pooled bullets, one Scout type, collision, score.
4. **Enemy variety** — the remaining saucer types, enemy fire, player lives.
5. **Waves** — the `waves.ts` table, difficulty curve, wave transitions.
6. **Boss** — mothership with phases.
7. **Story + loader** — blastoff loader, story beats, title and game-over
   screens.
8. **Polish** — audio, particles, screen shake, high score in `localStorage`.

Steps 1–3 are the risky part: if the loop and input feel wrong, everything after
inherits it. Worth stopping to actually play after step 2.

---

## 7. Open questions

- **Art direction.** "Old-fashioned cartoon" suggests hand-drawn, chunky, high
  contrast. Vector-drawn on canvas (fast, scales, no asset loading) or sprite
  sheets (richer, more characterful, needs a spritesheet loader)? This changes
  `art/` significantly.
- **Run length.** 3–5 minutes assumed. A 60-second arcade run is a different
  design from a 10-minute campaign.
- **Difficulty.** Should winning be likely (marketing toy) or genuinely hard
  (bragging rights)? Directly sets the wave tuning.
- **Scope of the story.** Full cutscene beats between every wave, or just an
  intro and an outro?
