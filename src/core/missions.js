/**
 * Missions are optional side goals that never interrupt the core loop.
 * scope 'run'   -> best value reached inside a single run
 * scope 'total' -> lifetime counter (totals at run start + this run)
 * Three missions are active at once; completed ones are swapped out after the run.
 */
export const MISSIONS = Object.freeze([
  { id: 'land10', text: 'Land 10 blocks in one run', metric: 'placements', scope: 'run', target: 10, reward: 1 },
  { id: 'perfect5', text: 'Hit 5 Perfects', metric: 'perfects', scope: 'total', target: 5, reward: 1 },
  { id: 'pstreak3', text: '3 Perfects in a row', metric: 'maxPerfectStreak', scope: 'run', target: 3, reward: 2 },
  { id: 'score500', text: 'Score 500 in one run', metric: 'score', scope: 'run', target: 500, reward: 2 },
  { id: 'combo8', text: 'Build an 8 combo', metric: 'maxCombo', scope: 'run', target: 8, reward: 2 },
  { id: 'land25', text: 'Land 25 blocks in one run', metric: 'placements', scope: 'run', target: 25, reward: 3 },
  { id: 'perfect25', text: 'Hit 25 Perfects', metric: 'perfects', scope: 'total', target: 25, reward: 3 },
  { id: 'score1500', text: 'Score 1,500 in one run', metric: 'score', scope: 'run', target: 1500, reward: 3 },
  { id: 'pstreak5', text: '5 Perfects in a row', metric: 'maxPerfectStreak', scope: 'run', target: 5, reward: 4 },
  { id: 'land50', text: 'Land 50 blocks in one run', metric: 'placements', scope: 'run', target: 50, reward: 5 },
  { id: 'score4000', text: 'Score 4,000 in one run', metric: 'score', scope: 'run', target: 4000, reward: 5 },
].map(Object.freeze));

export const ACTIVE_MISSION_COUNT = 3;

const byId = new Map(MISSIONS.map((m) => [m.id, m]));
export const getMission = (id) => byId.get(id) || null;

const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

export class MissionBook {
  constructor(saved = {}, pool = MISSIONS) {
    this.pool = pool;
    const known = (ids) => (Array.isArray(ids) ? ids.filter((id) => pool.some((m) => m.id === id)) : []);
    this.completed = new Set(known(saved.completed));
    this.active = [...new Set(known(saved.active))].slice(0, ACTIVE_MISSION_COUNT);
    this.fill();
  }

  /** Tops the active list up with the next unfinished missions from the pool. */
  fill() {
    for (const m of this.pool) {
      if (this.active.length >= ACTIVE_MISSION_COUNT) break;
      if (!this.completed.has(m.id) && !this.active.includes(m.id)) this.active.push(m.id);
    }
  }

  progressOf(mission, runStats = {}, totalsAtStart = {}) {
    const value = mission.scope === 'total' ? num(totalsAtStart[mission.metric]) + num(runStats[mission.metric]) : num(runStats[mission.metric]);
    return Math.min(mission.target, value);
  }

  /** Marks newly finished missions as completed. Returns those missions (with rewards). */
  check(runStats, totalsAtStart) {
    const newlyDone = [];
    for (const id of this.active) {
      const m = this.pool.find((p) => p.id === id);
      if (!m || this.completed.has(id)) continue;
      if (this.progressOf(m, runStats, totalsAtStart) >= m.target) {
        this.completed.add(id);
        newlyDone.push(m);
      }
    }
    return newlyDone;
  }

  /** Called between runs: retire completed missions and draw new ones. */
  rotate() {
    this.active = this.active.filter((id) => !this.completed.has(id));
    this.fill();
  }

  view(runStats = {}, totalsAtStart = {}) {
    return this.active.map((id) => {
      const m = this.pool.find((p) => p.id === id);
      return { ...m, progress: this.progressOf(m, runStats, totalsAtStart), done: this.completed.has(id) };
    });
  }

  serialize() {
    return { active: [...this.active], completed: [...this.completed] };
  }
}
