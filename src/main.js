import { GameSession, STATES } from './core/session.js';
import { MissionBook } from './core/missions.js';
import { SaveStore } from './systems/storage.js';
import { AudioManager } from './systems/audio.js';
import { Haptics } from './systems/haptics.js';
import { AdService } from './systems/monetization.js';
import { getTheme, isThemeUnlocked, DEFAULT_THEME_ID } from './systems/cosmetics.js';
import { Effects } from './render/effects.js';
import { Renderer } from './render/renderer.js';
import { UI } from './ui/ui.js';

// ---- Services --------------------------------------------------------------
const save = new SaveStore();
let missions = new MissionBook(save.data.missions);
const audio = new AudioManager({ enabled: save.data.settings.sound });
const haptics = new Haptics({ enabled: save.data.settings.haptics });
// No ad SDK is configured, so no provider is passed and "continue" stays hidden.
// See docs/MONETIZATION.md to plug in a real rewarded-ad provider.
const ads = new AdService(null);

const canvas = document.getElementById('game');
const effects = new Effects();
const renderer = new Renderer(canvas, effects);

// ---- Per-run bookkeeping -------------------------------------------------
let totalsAtRunStart = { ...save.data.totals };
let bestAtRunStart = save.data.bestScore;
let completedThisRun = [];
let recorded = { placements: 0, perfects: 0, counted: false };
let lastMultiplier = 1;
let continueBusy = false;

const session = new GameSession({ onEvent: handleGameEvent });

const ui = new UI({
  click: () => {
    audio.unlock();
    audio.play('click');
  },
  play: startRun,
  pause: pauseGame,
  resume: resumeGame,
  menu: goToMenu,
  continueRun: tryContinue,
  toggleSound: () => setSetting('sound', !save.data.settings.sound),
  setSetting,
  resetProgress,
  overlayOpened: (name) => {
    if (name === 'settings') ui.renderSettings(save.data.settings, save.data.stars, save.data.purchases.products);
    if (name === 'missions') ui.renderMissions(missions.view({}, save.data.totals), save.data.stars);
  },
});

// ---- Game events ---------------------------------------------------------
function handleGameEvent(type, p) {
  switch (type) {
    case 'start':
      lastMultiplier = 1;
      ui.updateHud(session.stats, save.data.bestScore);
      break;
    case 'stop':
      audio.play('stop');
      haptics.pulse('stop');
      break;
    case 'land': {
      renderer.onLand(p);
      audio.play(p.grade, { streak: p.perfectStreak });
      haptics.pulse(p.grade);
      ui.popGrade(p.grade, p.points);
      ui.updateHud(p.stats, save.data.bestScore, { bump: true });
      if (p.multiplier > lastMultiplier) ui.multiplierUp();
      lastMultiplier = p.multiplier;
      checkMissions(p.stats);
      break;
    }
    case 'comboBreak':
      ui.comboBroken();
      audio.play('comboBreak');
      break;
    case 'miss':
      renderer.onMiss(p, session.round.motion.direction, session.round.motion.currentSpeed);
      audio.play('miss');
      haptics.pulse('miss');
      ui.popGrade('miss', 0);
      break;
    case 'gameOver':
      onGameOver(p);
      break;
    case 'continue':
      lastMultiplier = 1;
      ui.updateHud(session.stats, save.data.bestScore);
      break;
    default:
      break;
  }
}

function checkMissions(stats) {
  const done = missions.check(stats, totalsAtRunStart);
  if (done.length === 0) return;
  const stars = done.reduce((sum, m) => sum + m.reward, 0);
  save.update((d) => {
    d.stars += stars;
    d.missions = missions.serialize();
  });
  completedThisRun.push(...done);
  audio.play('mission');
  for (const m of done) ui.toast(`Mission complete · <b>★ ${m.reward}</b>`);
}

/** Persists the part of the current run that has not been saved yet. */
function recordRunProgress(stats) {
  save.recordRun(
    { ...stats, placements: stats.placements - recorded.placements, perfects: stats.perfects - recorded.perfects },
    { countRun: !recorded.counted },
  );
  recorded = { placements: stats.placements, perfects: stats.perfects, counted: true };
  save.update((d) => {
    d.missions = missions.serialize();
  });
}

function onGameOver({ stats, canContinue }) {
  recordRunProgress(stats);
  ui.showGameOver({
    stats,
    best: save.data.bestScore,
    bestPerfectStreak: save.data.bestPerfectStreak,
    isNewBest: stats.score > bestAtRunStart,
    completedMissions: completedThisRun,
    canContinue: canContinue && ads.isRewardedAvailable(),
  });
  ui.updateMenu({ best: save.data.bestScore, stars: save.data.stars, sound: save.data.settings.sound });
}

// ---- Flow ------------------------------------------------------------------
function startRun() {
  audio.unlock();
  if (session.isActive) recordRunProgress(session.stats); // restarting mid-run still counts
  missions.rotate();
  save.update((d) => {
    d.missions = missions.serialize();
  });
  totalsAtRunStart = { ...save.data.totals };
  bestAtRunStart = save.data.bestScore;
  completedThisRun = [];
  recorded = { placements: 0, perfects: 0, counted: false };
  document.activeElement?.blur?.();
  renderer.resetRun();
  session.start();
  ui.show('playing');
}

function pauseGame() {
  if (session.pause()) ui.show('paused');
}

function resumeGame() {
  if (session.resume()) {
    resetClock();
    ui.show('playing');
  }
}

function goToMenu() {
  if (session.isActive) recordRunProgress(session.stats);
  session.abandon();
  renderer.resetRun();
  ui.updateMenu({ best: save.data.bestScore, stars: save.data.stars, sound: save.data.settings.sound });
  ui.show('menu');
}

async function tryContinue() {
  if (continueBusy || !session.canContinue()) return;
  continueBusy = true;
  try {
    const { rewarded } = await ads.showRewarded();
    if (rewarded && session.continueRun()) {
      renderer.missAnim = null;
      ui.show('playing');
    }
  } finally {
    continueBusy = false;
  }
}

// ---- Settings ----------------------------------------------------------------
function applyTheme() {
  let theme = getTheme(save.data.settings.theme);
  if (!isThemeUnlocked(theme, save.data.stars, save.data.purchases.products)) theme = getTheme(DEFAULT_THEME_ID);
  renderer.setTheme(theme);
  ui.applyThemeColors(theme.colors);
}

function applySettings() {
  const s = save.data.settings;
  audio.setEnabled(s.sound);
  haptics.setEnabled(s.haptics);
  effects.shakeEnabled = s.screenShake;
  applyTheme();
  ui.updateMenu({ best: save.data.bestScore, stars: save.data.stars, sound: s.sound });
}

function setSetting(key, value) {
  save.update((d) => {
    d.settings[key] = value;
  });
  applySettings();
  if (key === 'sound' && value) {
    audio.unlock();
    audio.play('click');
  }
  if (ui.screen === 'settings') ui.renderSettings(save.data.settings, save.data.stars, save.data.purchases.products);
}

function resetProgress() {
  save.reset();
  missions = new MissionBook(save.data.missions);
  save.update((d) => {
    d.missions = missions.serialize();
  });
  applySettings();
  ui.renderSettings(save.data.settings, save.data.stars, save.data.purchases.products);
  ui.toast('Progress reset');
}

// ---- Input -------------------------------------------------------------------
const app = document.getElementById('app');

app.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (ui.screen !== 'playing') return;
  if (e.button > 0) return; // primary button / touch only
  if (e.target.closest('button')) return; // HUD pause button handles itself
  e.preventDefault();
  session.tap(); // state machine ignores extra taps, so rapid / multi-finger taps are safe
}, { passive: false });

window.addEventListener('keydown', (e) => {
  const playing = ui.screen === 'playing';
  if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') && playing) {
    e.preventDefault();
    if (!e.repeat) {
      audio.unlock();
      session.tap();
    }
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (playing) pauseGame();
    else if (ui.screen === 'paused') resumeGame();
  }
});

// Block the context menu / double-tap zoom gestures on the play area.
app.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

// ---- Lifecycle ---------------------------------------------------------------
function autoPause() {
  if (ui.screen === 'playing') pauseGame();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    autoPause();
    audio.suspend();
  } else {
    audio.resume();
    resetClock();
  }
});
window.addEventListener('blur', autoPause);
window.addEventListener('pagehide', autoPause);

const logo = document.querySelector('.logo');
let menuTopLimit = 0;
const resize = () => {
  renderer.resize();
  menuTopLimit = logo.getBoundingClientRect().bottom - app.getBoundingClientRect().top;
};
if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize', resize);
logo.addEventListener('animationend', resize); // re-measure once the intro slide settles
window.addEventListener('orientationchange', resize);

// ---- Main loop -----------------------------------------------------------------
let lastTime = performance.now();
function resetClock() {
  lastTime = performance.now();
}

function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  try {
    if (session.state === STATES.IDLE) {
      renderer.renderAmbient(dt, menuTopLimit);
    } else {
      session.update(dt);
      renderer.render(session, dt);
    }
  } catch (err) {
    console.error('[PerfectTiming] frame error', err); // keep the loop alive
  }
  requestAnimationFrame(frame);
}

// ---- Boot ----------------------------------------------------------------------
save.update((d) => {
  d.missions = missions.serialize();
});
applySettings();
resize();
ui.show('menu');
requestAnimationFrame(frame);

if (new URLSearchParams(location.search).has('debug')) {
  window.__PT = { session, save, missions: () => missions, renderer };
}
