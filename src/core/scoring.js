import { SCORING } from '../config.js';
import { GRADES } from './geometry.js';

const safeInt = (n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export function multiplierForCombo(combo, rules = SCORING) {
  const steps = Math.floor(safeInt(combo) / rules.COMBO_STEP);
  return Math.min(rules.MAX_MULTIPLIER, 1 + steps * rules.MULTIPLIER_STEP);
}

export function perfectBonusFor(perfectStreak, rules = SCORING) {
  return Math.min(rules.PERFECT_STREAK_BONUS_CAP, Math.max(0, safeInt(perfectStreak) - 1) * rules.PERFECT_STREAK_BONUS);
}

/**
 * Single source of truth for score, combo (consecutive great-or-better),
 * multiplier and perfect streak. GOOD keeps the run alive but breaks the combo.
 */
export class ScoreKeeper {
  constructor(rules = SCORING) {
    this.rules = rules;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.perfectStreak = 0;
    this.maxCombo = 0;
    this.maxPerfectStreak = 0;
    this.counts = { perfect: 0, great: 0, good: 0 };
  }

  get multiplier() {
    return multiplierForCombo(this.combo, this.rules);
  }

  /** Resets streaks without touching the score (used by "continue"). */
  breakStreaks() {
    this.combo = 0;
    this.perfectStreak = 0;
  }

  register(grade) {
    if (!Object.prototype.hasOwnProperty.call(this.rules.BASE_POINTS, grade)) {
      return { points: 0, multiplier: this.multiplier, combo: this.combo, perfectStreak: this.perfectStreak, perfectBonus: 0, comboBroken: false };
    }
    const hadCombo = this.combo;
    let perfectBonus = 0;

    if (grade === GRADES.GOOD) {
      this.combo = 0;
      this.perfectStreak = 0;
    } else {
      this.combo += 1;
      if (grade === GRADES.PERFECT) {
        this.perfectStreak += 1;
        perfectBonus = perfectBonusFor(this.perfectStreak, this.rules);
      } else {
        this.perfectStreak = 0;
      }
    }

    const multiplier = this.multiplier;
    const points = safeInt(Math.round((this.rules.BASE_POINTS[grade] + perfectBonus) * multiplier));
    this.score = safeInt(this.score + points);
    this.counts[grade] += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.maxPerfectStreak = Math.max(this.maxPerfectStreak, this.perfectStreak);

    return {
      points,
      multiplier,
      combo: this.combo,
      perfectStreak: this.perfectStreak,
      perfectBonus,
      comboBroken: grade === GRADES.GOOD && hadCombo > 0,
    };
  }
}
