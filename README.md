# PERFECT TIMING

A minimalist, one-tap mobile arcade game played in portrait. Stop the sliding block at the right
moment to land it on the target. *Easy to learn, hard to master.*

**Play it:** https://gok-002.github.io/perfect-timing/

- **Tech:** HTML5 Canvas and plain JavaScript (ES modules). No dependencies, no build step.
- **Platform:** Mobile browsers (portrait). It can be added to the home screen as a PWA. On desktop it runs inside a portrait frame.
- **Why this stack:** It runs instantly on any phone, deploys as static files, and can later be wrapped
  into an Android/iOS app with Capacitor if needed.

## Running locally

```bash
npm start
```

Then open `http://localhost:5173`. To test from a phone on the same Wi-Fi:

```bash
HOST=0.0.0.0 npm start
```

Then open `http://<your-computer-ip>:5173` on the phone. In Windows PowerShell: `$env:HOST="0.0.0.0"; npm start`.

> ES modules do not load over `file://`. Always open the game through a server.

## Tests

```bash
npm test
```

Uses Node's built-in test runner (`node:test`). The 44 tests cover: overlap calculation and grading,
score/multiplier/streaks, the difficulty curve and movement patterns, the game state machine (double taps,
a single game over, pause/resume, restart, continue), missions, the save system (repairing corrupt data,
storage failures), and the absence of an ad/store provider.

## How to play

- Tap the screen (**Space/Enter** on desktop) and the block drops.
- The better the block is centred on the target frame (the pink dashed area), the better the grade:
  **PERFECT** (between the yellow markers) › **GREAT** › **GOOD** › **MISS** (no valid overlap, which ends the run).
- Consecutive GREAT or better hits build a combo. Every 4 combo adds +0.5 to the multiplier (up to ×3). A GOOD breaks the combo.
- Consecutive PERFECTs give bonus points and slightly widen the next targets, rewarding mastery.
- **Esc / P** pauses. The game also pauses automatically when the app goes to the background.

## Project structure

```
index.html              Screens (menu, HUD, pause, game over, settings, missions)
styles.css              All UI styling, safe areas, animations
manifest.webmanifest    PWA manifest (portrait, fullscreen)
server.js               Zero-dependency local static server
assets/icon.svg         App icon
src/
  config.js             ALL balance constants (thresholds, points, difficulty, timings)
  main.js               Wiring layer: loop, input, lifecycle, saving, missions
  core/                 Pure game logic (no DOM, fully testable)
    geometry.js           Overlap and Perfect/Great/Good/Miss grading
    motion.js             Block movement patterns (linear, sine, pulse)
    difficulty.js         Difficulty curve, round plan, target placement
    scoring.js            Central score / combo / multiplier / perfect streak
    session.js            Game state machine (ready → moving → dropping/falling → over)
    missions.js           Mission pool and progress
  systems/
    storage.js            Persistent save (localStorage, validation, in-memory fallback)
    audio.js              Sounds synthesised with Web Audio (no audio files)
    haptics.js            Vibration (silently disabled on unsupported devices)
    cosmetics.js          Theme registry and unlock rules
    monetization.js       Ad/store integration points (no provider, so disabled)
  render/
    renderer.js           Canvas drawing: tower, target, block, camera, menu backdrop
    effects.js            Pooled particle, ring, shake and flash effects
  ui/ui.js              DOM screens, HUD, popups and toasts
tests/                  Automated tests (node:test)
docs/MONETIZATION.md    Ad and purchase integration notes
```

## Balancing

Every number lives in `src/config.js`:

| Constant | Meaning | Default |
|---|---|---|
| `ACCURACY.PERFECT` | Perfect tolerance: `max(ratio × maxOffset, minWindowMs × speed)` | 7% / 28 ms |
| `ACCURACY.GREAT` | Great tolerance | 24% / 70 ms |
| `ACCURACY.MIN_VALID_OVERLAP_RATIO` | Overlaps thinner than this count as a MISS | 4% |
| `DIFFICULTY.*` | Speed 360 → 920, target 300 → 120, block 230 → 130 units | |
| `DIFFICULTY.PATTERNS` | `sine` unlocks at level 6, `pulse` at level 14 | |
| `SCORING.*` | Good 10 / Great 20 / Perfect 40, streak bonus, multiplier | |

Grading is purely geometric. The time-based floor keeps the Perfect window at least ±28 ms even as the
game speeds up, so late game stays fair. The yellow markers inside the target show the Perfect window,
and the notch in the middle of the block is the point the player lines up.

## Safeguards

- **No double scoring:** Only the `moving` state accepts a tap. Multi-finger or rapid taps are ignored.
- **Single game over:** `finish()` is guarded, so `gameOver` fires once per run.
- **Frame time clamp:** `dt` is capped at 50 ms and NaN/negative values are ignored, so the block never teleports after returning from the background.
- **Score safety:** All scores are finite, non-negative integers. Invalid input throws a `RangeError` instead of producing NaN.
- **Save safety:** Corrupt or tampered saves are repaired. If localStorage is unavailable (private mode), the session continues in memory.
- **Error isolation:** An error in a listener (UI/audio) cannot corrupt the state machine, and an error in one frame does not stop the loop.

## Progression and cosmetics

- Missions: 3 active missions at a time from a pool of 11. Completed ones are replaced when the run ends.
- Stars unlock themes: Neon Night (0), Ember (3), Mint Dusk (8), Monochrome (15).
- To add a theme, add an object to the `THEMES` array in `src/systems/cosmetics.js`.

## Deployment

The game is hosted on GitHub Pages from the root of the `main` branch. Pushing to `main` updates the live
site within about a minute.

## Packaging as a mobile app (optional)

Because the project is a web app, it can be wrapped with Capacitor:

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
```

Then run `npx cap init` and `npx cap add android` (`webDir` = the project root or a copied `www/` folder).
These steps have **not been done or tested** in this version.
