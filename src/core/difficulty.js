import { DIFFICULTY, WORLD } from '../config.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Picks a movement pattern unlocked at `level` using a weighted roll. */
export function pickPattern(level, rng = Math.random, tuning = DIFFICULTY) {
  const pool = tuning.PATTERNS.filter((p) => level >= p.fromLevel);
  const total = pool.reduce((sum, p) => sum + p.weight, 0);
  let roll = clamp(rng(), 0, 0.999999) * total;
  for (const p of pool) {
    roll -= p.weight;
    if (roll < 0) return p.id;
  }
  return pool[pool.length - 1].id;
}

/** Deterministic size/speed curve for a level (= successful placements so far). */
export function getDifficulty(level, relief = 0, tuning = DIFFICULTY) {
  const lv = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
  const safeRelief = clamp(Number.isFinite(relief) ? relief : 0, 0, tuning.MAX_RELIEF);
  const speed = Math.min(tuning.MAX_SPEED, tuning.BASE_SPEED + lv * tuning.SPEED_PER_LEVEL);
  const shrunkTarget = Math.max(tuning.MIN_TARGET_WIDTH, tuning.BASE_TARGET_WIDTH - lv * tuning.TARGET_SHRINK_PER_LEVEL);
  const targetWidth = Math.min(tuning.BASE_TARGET_WIDTH, shrunkTarget + safeRelief);
  const blockWidth = Math.max(tuning.MIN_BLOCK_WIDTH, tuning.BASE_BLOCK_WIDTH - lv * tuning.BLOCK_SHRINK_PER_LEVEL);
  return { level: lv, speed, targetWidth, blockWidth };
}

/** Builds everything needed for one round. */
export function createRoundPlan(level, relief, rng = Math.random, world = WORLD, tuning = DIFFICULTY) {
  const d = getDifficulty(level, relief, tuning);
  const pattern = pickPattern(d.level, rng, tuning);
  const minTargetX = world.SIDE_MARGIN + d.targetWidth / 2;
  const maxTargetX = world.WIDTH - world.SIDE_MARGIN - d.targetWidth / 2;
  const targetX = minTargetX + clamp(rng(), 0, 1) * (maxTargetX - minTargetX);
  // Start on the far side of the target so the player always gets a full approach.
  const startSide = targetX < world.WIDTH / 2 ? 'right' : 'left';
  return {
    ...d,
    pattern,
    targetX,
    startSide,
    minX: world.SIDE_MARGIN + d.blockWidth / 2,
    maxX: world.WIDTH - world.SIDE_MARGIN - d.blockWidth / 2,
  };
}

/** Relief bookkeeping after a placement: perfects widen upcoming targets, goods reset. */
export function nextRelief(currentRelief, grade, tuning = DIFFICULTY) {
  if (grade === 'perfect') return Math.min(tuning.MAX_RELIEF, currentRelief + tuning.PERFECT_RELIEF);
  if (grade === 'good') return 0;
  return currentRelief;
}
