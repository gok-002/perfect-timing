import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameSession, STATES } from '../src/core/session.js';
import { TIMING } from '../src/config.js';
import { seededRng } from './helpers.js';

const STEP = 1 / 240;

function makeSession(seed = 1) {
  const events = [];
  const session = new GameSession({ rng: seededRng(seed), onEvent: (type, payload) => events.push({ type, payload }) });
  return { session, events, count: (t) => events.filter((e) => e.type === t).length };
}

/** Advances in realistic frame-sized steps (update() clamps big deltas). */
function advance(session, seconds) {
  for (let t = 0; t < seconds; t += 0.01) session.update(0.01);
}

function skipReady(session) {
  advance(session, TIMING.READY_DELAY + 0.01);
  assert.equal(session.state, STATES.MOVING);
}

/** Advances until the block centre is within `tol` of the target centre. */
function stepUntilAligned(session, tol = 1.5) {
  for (let i = 0; i < 20000; i++) {
    if (Math.abs(session.round.motion.x - session.round.targetX) <= tol) return;
    session.update(STEP);
  }
  throw new Error('never aligned');
}

function stepUntilClear(session) {
  const { targetWidth, blockWidth } = session.round;
  for (let i = 0; i < 20000; i++) {
    if (Math.abs(session.round.motion.x - session.round.targetX) > (targetWidth + blockWidth) / 2 + 2) return;
    session.update(STEP);
  }
  throw new Error('never cleared target');
}

function finishDrop(session) {
  advance(session, TIMING.DROP_DURATION + 0.01);
}

test('starts in READY, ignores taps until the block moves', () => {
  const { session } = makeSession();
  assert.equal(session.state, STATES.IDLE);
  assert.equal(session.tap(), false);
  session.start();
  assert.equal(session.state, STATES.READY);
  assert.equal(session.tap(), false);
  skipReady(session);
  const x0 = session.round.motion.x;
  session.update(0.02);
  assert.notEqual(session.round.motion.x, x0);
});

test('an aligned tap scores a perfect, stacks a block and raises difficulty', () => {
  const { session, events } = makeSession(3);
  session.start();
  skipReady(session);
  const before = { speed: session.round.speed, targetWidth: session.round.targetWidth };
  stepUntilAligned(session);
  assert.equal(session.tap(), true);
  assert.equal(session.state, STATES.DROPPING);
  finishDrop(session);
  const land = events.find((e) => e.type === 'land');
  assert.equal(land.payload.grade, 'perfect');
  assert.equal(session.stats.score, land.payload.points);
  assert.equal(session.placed.length, 1);
  assert.equal(session.state, STATES.MOVING);
  assert.equal(session.round.row, 1);
  assert.ok(session.round.speed > before.speed);
});

test('rapid repeated taps only score once', () => {
  const { session, count } = makeSession(5);
  session.start();
  skipReady(session);
  stepUntilAligned(session);
  assert.equal(session.tap(), true);
  for (let i = 0; i < 10; i++) assert.equal(session.tap(), false);
  finishDrop(session);
  assert.equal(count('land'), 1);
  assert.equal(session.placed.length, 1);
});

test('a miss ends the run exactly once', () => {
  const { session, count, events } = makeSession(8);
  session.start();
  skipReady(session);
  stepUntilClear(session);
  assert.equal(session.tap(), true);
  assert.equal(session.state, STATES.FALLING);
  for (let i = 0; i < 200; i++) {
    session.update(0.05);
    session.tap();
  }
  assert.equal(session.state, STATES.OVER);
  assert.equal(count('miss'), 1);
  assert.equal(count('gameOver'), 1);
  session.finish(); // even a stray direct call cannot re-trigger it
  assert.equal(count('gameOver'), 1);
  assert.equal(events.find((e) => e.type === 'gameOver').payload.stats.score, 0);
});

test('pause freezes motion and blocks taps; resume continues', () => {
  const { session } = makeSession(2);
  session.start();
  skipReady(session);
  session.update(0.1);
  assert.equal(session.pause(), true);
  assert.equal(session.pause(), false);
  const x = session.round.motion.x;
  session.update(0.05);
  assert.equal(session.round.motion.x, x);
  assert.equal(session.tap(), false);
  assert.equal(session.resume(), true);
  session.update(0.05);
  assert.notEqual(session.round.motion.x, x);
});

test('huge or invalid frame deltas are clamped (background resume)', () => {
  const { session } = makeSession(4);
  session.start();
  skipReady(session);
  const m = session.round.motion;
  const x = m.x;
  session.update(NaN);
  assert.equal(m.x, x);
  session.update(30); // 30s in background -> one clamped step only
  const maxTravel = m.baseSpeed * 1.5 * TIMING.MAX_FRAME_DT + 1e-6;
  assert.ok(Math.abs(m.x - x) <= maxTravel);
});

test('restart fully resets score, stack and streaks', () => {
  const { session } = makeSession(6);
  session.start();
  for (let i = 0; i < 3; i++) {
    if (session.state === STATES.READY) skipReady(session);
    stepUntilAligned(session);
    session.tap();
    finishDrop(session);
  }
  assert.equal(session.placed.length, 3);
  assert.ok(session.stats.score > 0);
  session.start();
  assert.equal(session.placed.length, 0);
  assert.equal(session.stats.score, 0);
  assert.equal(session.stats.combo, 0);
  assert.equal(session.round.row, 0);
  assert.equal(session.pending, null);
});

test('continue revives once, keeps score, breaks streaks', () => {
  const { session, count } = makeSession(11);
  session.start();
  skipReady(session);
  stepUntilAligned(session);
  session.tap();
  finishDrop(session);
  const score = session.stats.score;
  stepUntilClear(session);
  session.tap();
  advance(session, TIMING.MISS_DURATION + 0.02);
  assert.equal(session.state, STATES.OVER);
  assert.equal(session.canContinue(), true);
  assert.equal(session.continueRun(), true);
  assert.equal(session.state, STATES.READY);
  assert.equal(session.stats.score, score);
  assert.equal(session.stats.combo, 0);
  skipReady(session);
  stepUntilClear(session);
  session.tap();
  advance(session, TIMING.MISS_DURATION + 0.02);
  assert.equal(session.canContinue(), false);
  assert.equal(session.continueRun(), false);
  assert.equal(count('gameOver'), 2);
});

test('a throwing listener cannot break the state machine', () => {
  const session = new GameSession({ rng: seededRng(1), onEvent: () => { throw new Error('ui boom'); } });
  const origError = console.error;
  console.error = () => {};
  try {
    session.start();
    skipReady(session);
    stepUntilAligned(session);
    assert.equal(session.tap(), true);
    finishDrop(session);
    assert.equal(session.placed.length, 1);
  } finally {
    console.error = origError;
  }
});

test('simulated long run: score stays a valid integer and difficulty rises', () => {
  const { session } = makeSession(21);
  session.start();
  for (let i = 0; i < 60; i++) {
    if (session.state === STATES.READY) skipReady(session);
    stepUntilAligned(session, 3);
    session.tap();
    finishDrop(session);
    assert.ok(Number.isSafeInteger(session.stats.score) && session.stats.score >= 0);
  }
  assert.equal(session.placed.length, 60);
  assert.ok(session.round.targetWidth < 300);
});
