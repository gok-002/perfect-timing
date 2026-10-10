import { STORAGE } from '../config.js';
import { DEFAULT_THEME_ID } from './cosmetics.js';

const nonNegInt = (v, fallback = 0) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback);
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
const strArray = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

export function createDefaultSave() {
  return {
    version: STORAGE.VERSION,
    bestScore: 0,
    bestPerfectStreak: 0,
    stars: 0, // lifetime stars from missions (never spent; unlocks are thresholds)
    totals: { runs: 0, placements: 0, perfects: 0 },
    settings: { sound: true, haptics: true, screenShake: true, theme: DEFAULT_THEME_ID },
    missions: { active: [], completed: [] },
    purchases: { removeAds: false, products: [] },
  };
}

/** Accepts anything (corrupt JSON, old versions, tampered values) and returns a valid save. */
export function sanitizeSave(raw) {
  const d = createDefaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const s = raw.settings || {};
  const t = raw.totals || {};
  const m = raw.missions || {};
  const p = raw.purchases || {};
  return {
    version: STORAGE.VERSION,
    bestScore: nonNegInt(raw.bestScore),
    bestPerfectStreak: nonNegInt(raw.bestPerfectStreak),
    stars: nonNegInt(raw.stars),
    totals: { runs: nonNegInt(t.runs), placements: nonNegInt(t.placements), perfects: nonNegInt(t.perfects) },
    settings: {
      sound: bool(s.sound, d.settings.sound),
      haptics: bool(s.haptics, d.settings.haptics),
      screenShake: bool(s.screenShake, d.settings.screenShake),
      theme: typeof s.theme === 'string' ? s.theme : d.settings.theme,
    },
    missions: { active: strArray(m.active), completed: strArray(m.completed) },
    purchases: { removeAds: bool(p.removeAds, false), products: strArray(p.products) },
  };
}

export function createMemoryBackend() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

/** localStorage when usable (private mode / disabled storage throws), memory otherwise. */
export function detectBackend() {
  try {
    const ls = globalThis.localStorage;
    const probe = '__pt_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { backend: ls, persistent: true };
  } catch {
    return { backend: createMemoryBackend(), persistent: false };
  }
}

export class SaveStore {
  constructor(backend, key = STORAGE.KEY) {
    if (backend) {
      this.backend = backend;
      this.persistent = true;
    } else {
      const detected = detectBackend();
      this.backend = detected.backend;
      this.persistent = detected.persistent;
    }
    this.key = key;
    this.data = this.load();
  }

  load() {
    try {
      const raw = this.backend.getItem(this.key);
      return sanitizeSave(raw ? JSON.parse(raw) : null);
    } catch (err) {
      console.warn('[SaveStore] could not read save, starting fresh', err);
      return createDefaultSave();
    }
  }

  save() {
    try {
      this.backend.setItem(this.key, JSON.stringify(this.data));
      return true;
    } catch (err) {
      console.warn('[SaveStore] could not write save', err);
      return false;
    }
  }

  update(mutator) {
    mutator(this.data);
    this.data = sanitizeSave(this.data);
    return this.save();
  }

  /**
   * Records a finished run. `placements`/`perfects` are the amounts not yet
   * recorded (a continued run reports only its new part); `countRun` is false
   * for that second report so one run is never counted twice.
   * Returns { isNewBest }.
   */
  recordRun(stats, { countRun = true } = {}) {
    let isNewBest = false;
    this.update((d) => {
      const score = nonNegInt(stats.score);
      isNewBest = score > d.bestScore;
      d.bestScore = Math.max(d.bestScore, score);
      d.bestPerfectStreak = Math.max(d.bestPerfectStreak, nonNegInt(stats.maxPerfectStreak));
      if (countRun) d.totals.runs += 1;
      d.totals.placements += nonNegInt(stats.placements);
      d.totals.perfects += nonNegInt(stats.perfects);
    });
    return { isNewBest };
  }

  reset() {
    this.data = createDefaultSave();
    return this.save();
  }
}
