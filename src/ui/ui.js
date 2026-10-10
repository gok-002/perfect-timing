import { SCORING } from '../config.js';
import { THEMES, isThemeUnlocked } from '../systems/cosmetics.js';

const $ = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`UI element #${id} missing`);
  return el;
};

const fmt = (n) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0).toLocaleString('en-US');
const GRADE_LABEL = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS' };
const MAX_POPUPS = 3;

/**
 * DOM layer: screens, HUD, popups, toasts. Owns no game rules; it only renders
 * what it is given and reports user intent through the `actions` callbacks.
 */
export class UI {
  constructor(actions) {
    this.actions = actions;
    this.app = $('app');
    this.screens = {
      menu: $('screen-menu'),
      paused: $('screen-pause'),
      over: $('screen-over'),
      settings: $('screen-settings'),
      missions: $('screen-missions'),
    };
    this.el = {
      score: $('hud-score'), best: $('hud-best'), mult: $('hud-mult'), comboFill: $('combo-fill'), streak: $('hud-streak'),
      popups: $('popup-layer'), toasts: $('toast-layer'),
      menuBest: $('menu-best'), menuStars: $('menu-stars'), sound: $('btn-sound'),
      overNewBest: $('over-newbest'), overScore: $('over-score'), overBest: $('over-best'), overPStreak: $('over-pstreak'),
      overBlocks: $('over-blocks'), overMissions: $('over-missions'), btnContinue: $('btn-continue'), btnAgain: $('btn-again'),
      setSound: $('set-sound'), setHaptics: $('set-haptics'), setShake: $('set-shake'), themeList: $('theme-list'), btnReset: $('btn-reset'),
      missionList: $('mission-list'), missionsStars: $('missions-stars'),
    };
    this.overlayReturn = 'menu';
    this.bind();
  }

  bind() {
    const a = this.actions;
    const on = (id, fn) => $(id).addEventListener('click', (e) => {
      e.stopPropagation();
      a.click?.();
      fn(e);
    });
    on('btn-play', () => a.play());
    on('btn-again', () => a.play());
    on('btn-restart', () => a.play());
    on('btn-pause', () => a.pause());
    on('btn-resume', () => a.resume());
    on('btn-pause-menu', () => a.menu());
    on('btn-over-menu', () => a.menu());
    on('btn-continue', () => a.continueRun());
    on('btn-sound', () => a.toggleSound());
    on('btn-settings', () => this.openOverlay('settings'));
    on('btn-missions', () => this.openOverlay('missions'));
    on('btn-settings-close', () => this.closeOverlay());
    on('btn-missions-close', () => this.closeOverlay());
    on('btn-reset', () => this.handleReset());

    this.el.setSound.addEventListener('change', (e) => a.setSetting('sound', e.target.checked));
    this.el.setHaptics.addEventListener('change', (e) => a.setSetting('haptics', e.target.checked));
    this.el.setShake.addEventListener('change', (e) => a.setSetting('screenShake', e.target.checked));
    this.el.themeList.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-theme]');
      if (chip && !chip.disabled) {
        e.stopPropagation();
        a.setSetting('theme', chip.dataset.theme);
      }
    });
  }

  get screen() {
    return this.app.dataset.screen;
  }

  show(name) {
    this.app.dataset.screen = name;
    for (const [key, el] of Object.entries(this.screens)) el.classList.toggle('active', key === name);
    if (name !== 'playing') this.el.popups.replaceChildren();
    if (name === 'over') requestAnimationFrame(() => this.el.btnAgain.focus({ preventScroll: true }));
  }

  openOverlay(name) {
    this.overlayReturn = this.screen;
    this.actions.overlayOpened?.(name);
    this.show(name);
  }

  closeOverlay() {
    this.resetConfirm();
    this.show(this.overlayReturn || 'menu');
  }

  handleReset() {
    const btn = this.el.btnReset;
    if (!btn.classList.contains('confirm')) {
      btn.classList.add('confirm');
      btn.textContent = 'TAP AGAIN TO CONFIRM';
      clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => this.resetConfirm(), 3000);
      return;
    }
    this.resetConfirm();
    this.actions.resetProgress();
  }

  resetConfirm() {
    clearTimeout(this.resetTimer);
    this.el.btnReset.classList.remove('confirm');
    this.el.btnReset.textContent = 'RESET PROGRESS';
  }

  // ---- HUD ---------------------------------------------------------------
  updateHud(stats, best, { bump = false } = {}) {
    this.el.score.textContent = fmt(stats.score);
    this.el.best.textContent = fmt(Math.max(best, stats.score));
    const mult = stats.multiplier;
    this.el.mult.textContent = `×${mult % 1 ? mult.toFixed(1) : mult}`;
    this.el.mult.classList.toggle('hot', mult > 1);
    const atMax = mult >= SCORING.MAX_MULTIPLIER;
    const progress = atMax ? 1 : (stats.combo % SCORING.COMBO_STEP) / SCORING.COMBO_STEP;
    this.el.comboFill.style.width = `${Math.round(progress * 100)}%`;
    this.el.streak.textContent = stats.perfectStreak >= 2 ? `${stats.perfectStreak}× PERFECT` : '';
    if (bump) restartAnimation(this.el.score, 'bump');
  }

  multiplierUp() {
    restartAnimation(this.el.mult, 'bump');
  }

  comboBroken() {
    restartAnimation(this.el.mult, 'broken');
    this.popup('combo lost', '', 'small');
  }

  popGrade(grade, points) {
    this.popup(GRADE_LABEL[grade] || '', points > 0 ? `+${fmt(points)}` : '', grade);
  }

  popup(title, sub, cls) {
    while (this.el.popups.childElementCount >= MAX_POPUPS) this.el.popups.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = `popup ${cls}`;
    const t = document.createElement('span');
    t.className = 'popup-grade';
    t.textContent = title;
    el.append(t);
    if (sub) {
      const s = document.createElement('span');
      s.className = 'popup-points';
      s.textContent = sub;
      el.append(s);
    }
    el.addEventListener('animationend', () => el.remove(), { once: true });
    this.el.popups.append(el);
  }

  toast(html) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = html; // only ever called with static, trusted mission text
    el.addEventListener('animationend', () => el.remove(), { once: true });
    this.el.toasts.append(el);
  }

  // ---- Menu / game over -------------------------------------------------
  updateMenu({ best, stars, sound }) {
    this.el.menuBest.textContent = fmt(best);
    this.el.menuStars.textContent = fmt(stars);
    this.el.sound.setAttribute('aria-pressed', String(sound));
  }

  showGameOver({ stats, best, bestPerfectStreak, isNewBest, completedMissions, canContinue }) {
    this.el.overScore.textContent = fmt(stats.score);
    this.el.overBest.textContent = fmt(best);
    this.el.overPStreak.textContent = fmt(stats.maxPerfectStreak);
    this.el.overPStreak.title = `Best ever: ${fmt(bestPerfectStreak)}`;
    this.el.overBlocks.textContent = fmt(stats.placements);
    this.el.overNewBest.classList.toggle('show', isNewBest);
    this.el.overMissions.replaceChildren(...completedMissions.map((m) => {
      const li = document.createElement('li');
      li.textContent = `★ ${m.text}  +${m.reward}`;
      return li;
    }));
    this.el.btnContinue.hidden = !canContinue;
    this.show('over');
  }

  // ---- Settings / missions ---------------------------------------------
  renderSettings(settings, stars, ownedProducts) {
    this.el.setSound.checked = settings.sound;
    this.el.setHaptics.checked = settings.haptics;
    this.el.setShake.checked = settings.screenShake;
    this.el.themeList.replaceChildren(...THEMES.map((theme) => {
      const unlocked = isThemeUnlocked(theme, stars, ownedProducts);
      const chip = document.createElement('button');
      chip.className = `theme-chip${settings.theme === theme.id ? ' selected' : ''}`;
      chip.dataset.theme = theme.id;
      chip.disabled = !unlocked;
      chip.setAttribute('aria-pressed', String(settings.theme === theme.id));
      const sw = document.createElement('span');
      sw.className = 'theme-swatch';
      sw.style.background = `linear-gradient(135deg, ${theme.colors.block} 0 50%, ${theme.colors.target} 50% 100%)`;
      const label = document.createElement('span');
      label.textContent = theme.name;
      const sub = document.createElement('small');
      sub.textContent = unlocked ? (settings.theme === theme.id ? 'Selected' : 'Unlocked') : `★ ${theme.requiredStars} to unlock`;
      label.append(sub);
      chip.append(sw, label);
      return chip;
    }));
  }

  renderMissions(missions, stars) {
    this.el.missionsStars.textContent = fmt(stars);
    if (missions.length === 0) {
      const li = document.createElement('li');
      li.className = 'mission done';
      li.textContent = 'All missions complete. You have mastered the timing.';
      this.el.missionList.replaceChildren(li);
      return;
    }
    this.el.missionList.replaceChildren(...missions.map((m) => {
      const li = document.createElement('li');
      li.className = `mission${m.done ? ' done' : ''}`;
      const top = document.createElement('div');
      top.className = 'mission-top';
      const name = document.createElement('span');
      name.textContent = m.done ? `✓ ${m.text}` : m.text;
      const reward = document.createElement('span');
      reward.className = 'mission-reward';
      reward.textContent = `★ ${m.reward}`;
      top.append(name, reward);
      const bar = document.createElement('div');
      bar.className = 'mission-bar';
      const fill = document.createElement('div');
      fill.style.width = `${Math.round((m.progress / m.target) * 100)}%`;
      bar.append(fill);
      bar.hidden = m.scope === 'run' && !m.done; // single-run goals have no carried progress
      const prog = document.createElement('div');
      prog.className = 'mission-progress';
      if (m.done) prog.textContent = 'Complete';
      else if (m.scope === 'run') prog.textContent = 'Within a single run';
      else prog.textContent = `${fmt(m.progress)} / ${fmt(m.target)}`;
      li.append(top, bar, prog);
      return li;
    }));
  }

  applyThemeColors(colors) {
    const root = document.documentElement.style;
    root.setProperty('--accent', colors.accent);
    root.setProperty('--accent2', colors.accent2);
    root.setProperty('--perfect', colors.perfect);
    root.setProperty('--miss', colors.miss);
    root.setProperty('--bg', colors.bgTop);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.bgTop);
  }
}

function restartAnimation(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // force reflow so the animation replays
  el.classList.add(cls);
}
