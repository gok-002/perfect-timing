import { DIFFICULTY } from '../config.js';

/** Shapes map normalised travel t in [0,1] to position in [0,1]; slope is d(pos)/dt. */
const SHAPES = {
  linear: { pos: (t) => t, slope: () => 1 },
  sine: { pos: (t) => (1 - Math.cos(Math.PI * t)) / 2, slope: (t) => (Math.PI / 2) * Math.sin(Math.PI * t) },
  pulse: { pos: (t) => t, slope: () => 1 },
};

/**
 * Deterministic ping-pong motion between minX and maxX.
 * phase in [0,2): 0->1 travels left->right, 1->2 travels right->left.
 */
export class BlockMotion {
  constructor({ minX, maxX, speed, pattern = 'linear', startSide = 'left', tuning = DIFFICULTY }) {
    if (!(maxX > minX)) throw new RangeError('BlockMotion: maxX must be greater than minX');
    if (!(speed > 0) || !Number.isFinite(speed)) throw new RangeError('BlockMotion: speed must be positive');
    this.minX = minX;
    this.maxX = maxX;
    this.span = maxX - minX;
    this.pattern = SHAPES[pattern] ? pattern : 'linear';
    this.shape = SHAPES[this.pattern];
    this.baseSpeed = this.pattern === 'sine' ? speed * tuning.SINE_SPEED_FACTOR : speed;
    this.tuning = tuning;
    this.phase = startSide === 'right' ? 1 : 0;
    this.time = 0;
  }

  /** Multiplier applied to the phase rate (only the pulse pattern oscillates). */
  rateMultiplier() {
    if (this.pattern !== 'pulse') return 1;
    const { PULSE_AMPLITUDE, PULSE_FREQUENCY } = this.tuning;
    return 1 + PULSE_AMPLITUDE * Math.sin(2 * Math.PI * PULSE_FREQUENCY * this.time);
  }

  update(dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    this.phase = (this.phase + (this.baseSpeed / this.span) * this.rateMultiplier() * dt) % 2;
    this.time += dt;
  }

  get travel() {
    return this.phase <= 1 ? this.phase : 2 - this.phase;
  }

  get direction() {
    return this.phase < 1 ? 1 : -1;
  }

  get x() {
    return this.minX + this.span * this.shape.pos(this.travel);
  }

  /** Instantaneous speed in world units / second (feeds the fair timing windows). */
  get currentSpeed() {
    return this.baseSpeed * this.rateMultiplier() * this.shape.slope(this.travel);
  }
}
