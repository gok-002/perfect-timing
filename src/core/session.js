import { TIMING, WORLD, RUN } from '../config.js';
import { evaluatePlacement, GRADES } from './geometry.js';
import { BlockMotion } from './motion.js';
import { createRoundPlan, nextRelief } from './difficulty.js';
import { ScoreKeeper } from './scoring.js';

export const STATES = Object.freeze({
  IDLE: 'idle', // not started
  READY: 'ready', // round shown, block not moving yet, taps ignored
  MOVING: 'moving', // only state that accepts a tap
  DROPPING: 'dropping', // successful stop, block falling into the target row
  FALLING: 'falling', // missed, block falling off the tower
  OVER: 'over',
});

/**
 * Pure game-loop model: no DOM, no timers, no audio. The host calls update(dt)
 * every frame and tap() on input; everything observable is reported through
 * onEvent(type, payload). Deterministic when given a seeded rng.
 */
export class GameSession {
  constructor({ rng = Math.random, onEvent = () => {}, timing = TIMING, world = WORLD, run = RUN } = {}) {
    this.rng = rng;
    this.onEvent = onEvent;
    this.timing = timing;
    this.world = world;
    this.runRules = run;
    this.scoreKeeper = new ScoreKeeper();
    this.state = STATES.IDLE;
    this.paused = false;
    this.placed = [];
    this.round = null;
    this.pending = null;
  }

  emit(type, payload = {}) {
    try {
      this.onEvent(type, payload);
    } catch (err) {
      // A broken listener (UI/audio) must never corrupt the game state.
      console.error(`[GameSession] listener failed for "${type}"`, err);
    }
  }

  start() {
    this.scoreKeeper.reset();
    this.level = 0;
    this.relief = 0;
    this.placed = [];
    this.pending = null;
    this.continuesUsed = 0;
    this.paused = false;
    this.buildRound();
    this.setState(STATES.READY);
    this.emit('start', { round: this.round });
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  buildRound() {
    const plan = createRoundPlan(this.level, this.relief, this.rng, this.world);
    this.round = {
      ...plan,
      row: this.placed.length,
      motion: new BlockMotion({ minX: plan.minX, maxX: plan.maxX, speed: plan.speed, pattern: plan.pattern, startSide: plan.startSide }),
    };
  }

  get isActive() {
    return this.state !== STATES.IDLE && this.state !== STATES.OVER;
  }

  update(rawDt) {
    if (this.paused || !this.isActive) return;
    const dt = Number.isFinite(rawDt) ? Math.min(this.timing.MAX_FRAME_DT, Math.max(0, rawDt)) : 0;
    this.stateTime += dt;

    switch (this.state) {
      case STATES.READY:
        if (this.stateTime >= this.timing.READY_DELAY) this.setState(STATES.MOVING);
        break;
      case STATES.MOVING:
        this.round.motion.update(dt);
        break;
      case STATES.DROPPING:
        if (this.stateTime >= this.timing.DROP_DURATION) this.land();
        break;
      case STATES.FALLING:
        if (this.stateTime >= this.timing.MISS_DURATION) this.finish();
        break;
      default:
        break;
    }
  }

  /** Returns true only if the tap was consumed. Extra/rapid taps are ignored. */
  tap() {
    if (this.paused || this.state !== STATES.MOVING) return false;
    const { motion, blockWidth, targetX, targetWidth } = this.round;
    const x = motion.x;
    const result = evaluatePlacement({ blockX: x, blockWidth, targetX, targetWidth, speed: motion.currentSpeed });
    this.pending = { x, width: blockWidth, row: this.round.row, result };

    if (result.grade === GRADES.MISS) {
      this.setState(STATES.FALLING);
      this.emit('stop', { ...this.pending });
      this.emit('miss', { ...this.pending });
    } else {
      this.setState(STATES.DROPPING);
      this.emit('stop', { ...this.pending });
    }
    return true;
  }

  land() {
    const { x, width, row, result } = this.pending;
    const reg = this.scoreKeeper.register(result.grade);
    const block = { x, width, row, grade: result.grade };
    this.placed.push(block);
    this.level += 1;
    this.relief = nextRelief(this.relief, result.grade);
    this.pending = null;
    this.emit('land', { ...reg, grade: result.grade, accuracy: result.accuracy, block, score: this.scoreKeeper.score, stats: this.stats });
    if (reg.comboBroken) this.emit('comboBreak', {});
    this.buildRound();
    this.setState(STATES.MOVING);
    this.emit('round', { round: this.round });
  }

  finish() {
    if (this.state === STATES.OVER) return; // game over fires exactly once
    this.setState(STATES.OVER);
    this.emit('gameOver', { stats: this.stats, canContinue: this.canContinue() });
  }

  canContinue() {
    return this.state === STATES.OVER && this.continuesUsed < this.runRules.MAX_CONTINUES;
  }

  /** Revives a finished run on the same level (hook for a rewarded ad). */
  continueRun() {
    if (!this.canContinue()) return false;
    this.continuesUsed += 1;
    this.scoreKeeper.breakStreaks();
    this.relief = 0;
    this.pending = null;
    this.paused = false;
    this.buildRound();
    this.setState(STATES.READY);
    this.emit('continue', { round: this.round });
    return true;
  }

  pause() {
    if (!this.isActive || this.paused) return false;
    this.paused = true;
    this.emit('pause');
    return true;
  }

  resume() {
    if (!this.paused) return false;
    this.paused = false;
    this.emit('resume');
    return true;
  }

  abandon() {
    this.paused = false;
    this.setState(STATES.IDLE);
  }

  get stats() {
    const sk = this.scoreKeeper;
    return {
      score: sk.score,
      placements: this.placed.length,
      perfects: sk.counts.perfect,
      greats: sk.counts.great,
      goods: sk.counts.good,
      combo: sk.combo,
      multiplier: sk.multiplier,
      perfectStreak: sk.perfectStreak,
      maxCombo: sk.maxCombo,
      maxPerfectStreak: sk.maxPerfectStreak,
      level: this.level,
    };
  }
}
