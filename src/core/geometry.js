import { ACCURACY } from '../config.js';

export const GRADES = Object.freeze({
  PERFECT: 'perfect',
  GREAT: 'great',
  GOOD: 'good',
  MISS: 'miss',
});

const isPositiveFinite = (n) => Number.isFinite(n) && n > 0;

/** Horizontal overlap (world units) of two centred segments. Never negative. */
export function overlapWidth(aCenter, aWidth, bCenter, bWidth) {
  const left = Math.max(aCenter - aWidth / 2, bCenter - bWidth / 2);
  const right = Math.min(aCenter + aWidth / 2, bCenter + bWidth / 2);
  return Math.max(0, right - left);
}

/** Max centre offset (world units) that still earns a grade rule. */
export function toleranceFor(gradeRule, maxOffset, speed) {
  const byRatio = gradeRule.ratio * maxOffset;
  const byTime = (gradeRule.minWindowMs / 1000) * Math.max(0, Number.isFinite(speed) ? speed : 0);
  return Math.min(maxOffset, Math.max(byRatio, byTime));
}

/**
 * Grades a placement purely from geometry (no randomness).
 * @returns {{grade:string, offset:number, overlap:number, overlapRatio:number, accuracy:number}}
 */
export function evaluatePlacement({ blockX, blockWidth, targetX, targetWidth, speed = 0 }, rules = ACCURACY) {
  if (!Number.isFinite(blockX) || !Number.isFinite(targetX)) {
    throw new RangeError('evaluatePlacement: positions must be finite numbers');
  }
  if (!isPositiveFinite(blockWidth) || !isPositiveFinite(targetWidth)) {
    throw new RangeError('evaluatePlacement: widths must be positive finite numbers');
  }

  const offset = Math.abs(blockX - targetX);
  const maxOffset = (blockWidth + targetWidth) / 2;
  const overlap = overlapWidth(blockX, blockWidth, targetX, targetWidth);
  const overlapRatio = overlap / Math.min(blockWidth, targetWidth);
  const accuracy = Math.min(1, Math.max(0, 1 - offset / maxOffset));

  let grade;
  if (overlap <= 0 || overlapRatio < rules.MIN_VALID_OVERLAP_RATIO) {
    grade = GRADES.MISS;
  } else if (offset <= toleranceFor(rules.PERFECT, maxOffset, speed)) {
    grade = GRADES.PERFECT;
  } else if (offset <= toleranceFor(rules.GREAT, maxOffset, speed)) {
    grade = GRADES.GREAT;
  } else {
    grade = GRADES.GOOD;
  }

  return { grade, offset, overlap, overlapRatio, accuracy };
}
