import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MissionBook, MISSIONS, ACTIVE_MISSION_COUNT } from '../src/core/missions.js';
import { SaveStore, sanitizeSave, createDefaultSave, createMemoryBackend } from '../src/systems/storage.js';
import { THEMES, getTheme, isThemeUnlocked } from '../src/systems/cosmetics.js';
import { AdService, StoreService } from '../src/systems/monetization.js';
import { STORAGE } from '../src/config.js';

// ---- Missions ----
test('mission book keeps exactly three active missions', () => {
  const book = new MissionBook();
  assert.equal(book.active.length, ACTIVE_MISSION_COUNT);
  assert.deepEqual(book.active, MISSIONS.slice(0, 3).map((m) => m.id));
});

test('run-scoped missions complete from run stats; total-scoped add lifetime totals', () => {
  const book = new MissionBook();
  assert.deepEqual(book.check({ placements: 9 }, {}), []);
  const done = book.check({ placements: 10, perfects: 1 }, { perfects: 4 });
  assert.deepEqual(done.map((m) => m.id).sort(), ['land10', 'perfect5']);
  assert.deepEqual(book.check({ placements: 30, perfects: 9 }, { perfects: 4 }), []); // no double reward
});

test('rotate replaces completed missions and survives a save round-trip', () => {
  const book = new MissionBook();
  book.check({ placements: 10 }, {});
  book.rotate();
  assert.ok(!book.active.includes('land10'));
  assert.equal(book.active.length, 3);
  const restored = new MissionBook(JSON.parse(JSON.stringify(book.serialize())));
  assert.deepEqual(restored.active, book.active);
  assert.ok(restored.completed.has('land10'));
});

test('mission book ignores unknown ids and drains gracefully', () => {
  const book = new MissionBook({ active: ['nope', 'land10'], completed: ['ghost'] });
  assert.ok(!book.active.includes('nope'));
  const all = new MissionBook({ completed: MISSIONS.map((m) => m.id) });
  assert.equal(all.active.length, 0);
  assert.deepEqual(all.view(), []);
});

// ---- Storage ----
test('save survives a reload through the backend', () => {
  const backend = createMemoryBackend();
  const a = new SaveStore(backend);
  const { isNewBest } = a.recordRun({ score: 420, maxPerfectStreak: 4, placements: 12, perfects: 5 });
  assert.equal(isNewBest, true);
  a.update((d) => { d.settings.sound = false; });
  const b = new SaveStore(backend);
  assert.equal(b.data.bestScore, 420);
  assert.equal(b.data.bestPerfectStreak, 4);
  assert.equal(b.data.totals.runs, 1);
  assert.equal(b.data.settings.sound, false);
  assert.equal(b.recordRun({ score: 100, maxPerfectStreak: 1, placements: 1, perfects: 0 }).isNewBest, false);
  assert.equal(b.data.bestScore, 420);
});

test('continued run is not counted twice', () => {
  const s = new SaveStore(createMemoryBackend());
  s.recordRun({ score: 50, placements: 3, perfects: 1 });
  s.recordRun({ score: 90, placements: 2, perfects: 1 }, { countRun: false });
  assert.equal(s.data.totals.runs, 1);
  assert.equal(s.data.totals.placements, 5);
  assert.equal(s.data.bestScore, 90);
});

test('corrupt or tampered saves are repaired', () => {
  const backend = createMemoryBackend();
  backend.setItem(STORAGE.KEY, '{not json');
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    assert.deepEqual(new SaveStore(backend).data, createDefaultSave());
  } finally {
    console.warn = origWarn;
  }
  const fixed = sanitizeSave({ bestScore: -5, stars: 'lots', totals: { runs: NaN }, settings: { sound: 'yes' }, missions: { active: [1, 'land10'] } });
  assert.equal(fixed.bestScore, 0);
  assert.equal(fixed.stars, 0);
  assert.equal(fixed.totals.runs, 0);
  assert.equal(fixed.settings.sound, true);
  assert.deepEqual(fixed.missions.active, ['land10']);
});

test('a failing storage backend never throws into the game', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() {} };
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    const s = new SaveStore(broken);
    assert.equal(s.save(), false);
    assert.doesNotThrow(() => s.recordRun({ score: 10 }));
    assert.equal(s.data.bestScore, 10); // still tracked in memory for this session
  } finally {
    console.warn = origWarn;
  }
});

// ---- Cosmetics / monetisation ----
test('themes unlock by lifetime stars and unknown ids fall back to default', () => {
  assert.equal(getTheme('does-not-exist').id, THEMES[0].id);
  assert.ok(isThemeUnlocked(THEMES[0], 0));
  const locked = THEMES.find((t) => t.requiredStars > 0);
  assert.equal(isThemeUnlocked(locked, locked.requiredStars - 1), false);
  assert.equal(isThemeUnlocked(locked, locked.requiredStars), true);
});

test('without a provider no ad or purchase is ever offered', async () => {
  const ads = new AdService(null);
  assert.equal(ads.isRewardedAvailable(), false);
  assert.deepEqual(await ads.showRewarded(), { rewarded: false });
  const store = new StoreService(null);
  assert.equal(store.isAvailable(), false);
  assert.equal((await store.purchase('x')).ok, false);
});

test('a provider that throws is treated as unavailable', async () => {
  const ads = new AdService({ isRewardedReady: () => { throw new Error('sdk'); }, showRewarded: async () => ({ rewarded: true }) });
  assert.equal(ads.isRewardedAvailable(), false);
  const ok = new AdService({ isRewardedReady: () => true, showRewarded: async () => ({ rewarded: true }) });
  assert.deepEqual(await ok.showRewarded(), { rewarded: true });
});
