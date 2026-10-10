/**
 * Central tuning file. Every gameplay number lives here so balancing
 * never requires touching game logic.
 * World units: the playfield is WORLD.WIDTH units wide regardless of the
 * device resolution; the renderer scales units to pixels.
 */

export const WORLD = Object.freeze({
  WIDTH: 1000,
  BLOCK_HEIGHT: 80,
  SIDE_MARGIN: 40,
});

export const TIMING = Object.freeze({
  READY_DELAY: 0.45, // seconds before the first block starts moving (taps ignored)
  DROP_DURATION: 0.16, // block falls from the lane into the target row
  MISS_DURATION: 0.85, // falling animation before the game-over screen
  MAX_FRAME_DT: 0.05, // clamp so a long frame / background resume never teleports the block
});

/**
 * Accuracy grading. A grade's tolerance (max centre offset in world units) is
 *   max(ratio * maxOffset, minWindowMs/1000 * blockSpeed)
 * where maxOffset = (targetWidth + blockWidth) / 2 (the offset at which the
 * two shapes stop touching). The time-based floor keeps late, fast rounds fair.
 */
export const ACCURACY = Object.freeze({
  PERFECT: Object.freeze({ ratio: 0.07, minWindowMs: 28 }),
  GREAT: Object.freeze({ ratio: 0.24, minWindowMs: 70 }),
  // Anything with a real overlap is at least GOOD. Overlaps thinner than this
  // fraction of the narrower shape count as a MISS (no "touching edge" saves).
  MIN_VALID_OVERLAP_RATIO: 0.04,
});

export const SCORING = Object.freeze({
  BASE_POINTS: Object.freeze({ perfect: 40, great: 20, good: 10 }),
  PERFECT_STREAK_BONUS: 10, // extra points per consecutive perfect after the first
  PERFECT_STREAK_BONUS_CAP: 60,
  COMBO_STEP: 4, // every N consecutive great-or-better placements...
  MULTIPLIER_STEP: 0.5, // ...adds this much to the multiplier
  MAX_MULTIPLIER: 3,
});

export const DIFFICULTY = Object.freeze({
  BASE_SPEED: 360, // world units / second
  SPEED_PER_LEVEL: 16,
  MAX_SPEED: 920,
  BASE_TARGET_WIDTH: 300,
  TARGET_SHRINK_PER_LEVEL: 6,
  MIN_TARGET_WIDTH: 120,
  BASE_BLOCK_WIDTH: 230,
  BLOCK_SHRINK_PER_LEVEL: 3,
  MIN_BLOCK_WIDTH: 130,
  // A PERFECT widens the next targets a little (mastery reward); a GOOD clears it.
  PERFECT_RELIEF: 14,
  MAX_RELIEF: 60,
  // Movement patterns unlock by level. Weights are relative.
  PATTERNS: Object.freeze([
    Object.freeze({ id: 'linear', fromLevel: 0, weight: 3 }),
    Object.freeze({ id: 'sine', fromLevel: 6, weight: 2 }),
    Object.freeze({ id: 'pulse', fromLevel: 14, weight: 2 }),
  ]),
  SINE_SPEED_FACTOR: 0.8, // sine peaks at ~1.57x average speed, so tone it down
  PULSE_AMPLITUDE: 0.4, // pulse speed oscillates +/- 40%
  PULSE_FREQUENCY: 0.9, // Hz
});

export const RUN = Object.freeze({
  MAX_CONTINUES: 1, // "continue once" (only offered when a rewarded-ad provider is really available)
});

export const STORAGE = Object.freeze({
  KEY: 'perfect-timing.save',
  VERSION: 1,
});
