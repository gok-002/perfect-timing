/**
 * Light vibration feedback via the Vibration API. Unsupported platforms
 * (notably iOS Safari) silently do nothing.
 */
const PATTERNS = Object.freeze({
  stop: 8,
  good: 10,
  great: 14,
  perfect: [12, 30, 18],
  miss: [30, 40, 60],
});

export class Haptics {
  constructor({ enabled = true } = {}) {
    this.enabled = enabled;
    this.supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  pulse(name) {
    if (!this.enabled || !this.supported) return;
    // Browsers reject vibration before the first user gesture (and log an error).
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try {
      navigator.vibrate(PATTERNS[name] ?? 10);
    } catch {
      this.supported = false;
    }
  }
}
