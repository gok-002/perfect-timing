/**
 * All sounds are synthesised with the Web Audio API, so the game ships with
 * no audio files. Every call is a no-op when audio is unsupported, locked or muted.
 */
const MASTER_VOLUME = 0.22;

export class AudioManager {
  constructor({ enabled = true } = {}) {
    this.enabled = enabled;
    this.ctx = null;
    this.master = null;
    this.supported = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
  }

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock() {
    if (!this.supported) return;
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = MASTER_VOLUME;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch (err) {
      console.warn('[Audio] unavailable', err);
      this.supported = false;
    }
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  get ready() {
    return this.enabled && this.supported && this.ctx && this.ctx.state === 'running';
  }

  tone({ freq, endFreq = freq, type = 'sine', duration = 0.12, volume = 1, delay = 0, attack = 0.005 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  play(name, { streak = 0 } = {}) {
    if (!this.ready) return;
    try {
      switch (name) {
        case 'stop':
          this.tone({ freq: 520, endFreq: 380, type: 'triangle', duration: 0.07, volume: 0.6 });
          break;
        case 'good':
          this.tone({ freq: 330, type: 'sine', duration: 0.14, volume: 0.5 });
          break;
        case 'great':
          this.tone({ freq: 440, type: 'sine', duration: 0.12, volume: 0.55 });
          this.tone({ freq: 660, type: 'sine', duration: 0.16, volume: 0.4, delay: 0.05 });
          break;
        case 'perfect': {
          // Rising chime; pitch climbs with the perfect streak (capped) for a sense of momentum.
          const base = 660 * Math.pow(2, Math.min(streak - 1, 7) / 12);
          [1, 1.25, 1.5, 2].forEach((ratio, i) =>
            this.tone({ freq: base * ratio, type: 'sine', duration: 0.22, volume: 0.42, delay: i * 0.045 }));
          this.tone({ freq: base * 4, type: 'triangle', duration: 0.3, volume: 0.08, delay: 0.12 });
          break;
        }
        case 'comboBreak':
          this.tone({ freq: 300, endFreq: 220, type: 'triangle', duration: 0.16, volume: 0.35, delay: 0.08 });
          break;
        case 'miss':
          this.tone({ freq: 240, endFreq: 70, type: 'sawtooth', duration: 0.5, volume: 0.22 });
          this.tone({ freq: 120, endFreq: 50, type: 'sine', duration: 0.55, volume: 0.5 });
          break;
        case 'mission':
          [784, 988, 1175].forEach((f, i) => this.tone({ freq: f, type: 'triangle', duration: 0.14, volume: 0.3, delay: i * 0.07 }));
          break;
        case 'click':
          this.tone({ freq: 880, type: 'sine', duration: 0.05, volume: 0.25 });
          break;
        default:
          break;
      }
    } catch (err) {
      console.warn('[Audio] play failed', name, err);
    }
  }
}
