import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDifficulty, createRoundPlan, pickPattern, nextRelief } from '../src/core/difficulty.js';
import { BlockMotion } from '../src/core/motion.js';
import { DIFFICULTY, WORLD } from '../src/config.js';
import { seededRng } from './helpers.js';

test('difficulty ramps monotonically and respects limits', () => {
  let prev = getDifficulty(0);
  assert.equal(prev.speed, DIFFICULTY.BASE_SPEED);
  assert.equal(prev.targetWidth, DIFFICULTY.BASE_TARGET_WIDTH);
  for (let lv = 1; lv <= 300; lv++) {
    const d = getDifficulty(lv);
    assert.ok(d.speed >= prev.speed && d.speed <= DIFFICULTY.MAX_SPEED);
    assert.ok(d.targetWidth <= prev.targetWidth && d.targetWidth >= DIFFICULTY.MIN_TARGET_WIDTH);
    assert.ok(d.blockWidth <= prev.blockWidth && d.blockWidth >= DIFFICULTY.MIN_BLOCK_WIDTH);
    prev = d;
  }
  assert.equal(getDifficulty(300).speed, DIFFICULTY.MAX_SPEED);
});

test('garbage levels/relief are sanitised', () => {
  assert.deepEqual(getDifficulty(NaN), getDifficulty(0));
  assert.deepEqual(getDifficulty(-4), getDifficulty(0));
  assert.equal(getDifficulty(50, 1e9).targetWidth, Math.min(DIFFICULTY.BASE_TARGET_WIDTH, getDifficulty(50).targetWidth + DIFFICULTY.MAX_RELIEF));
});

test('relief: perfect adds (capped), great keeps, good resets', () => {
  let r = 0;
  for (let i = 0; i < 20; i++) r = nextRelief(r, 'perfect');
  assert.equal(r, DIFFICULTY.MAX_RELIEF);
  assert.equal(nextRelief(r, 'great'), r);
  assert.equal(nextRelief(r, 'good'), 0);
});

test('patterns unlock by level', () => {
  const rng = seededRng(7);
  const early = new Set(Array.from({ length: 200 }, () => pickPattern(0, rng)));
  assert.deepEqual([...early], ['linear']);
  const late = new Set(Array.from({ length: 500 }, () => pickPattern(40, rng)));
  assert.deepEqual([...late].sort(), ['linear', 'pulse', 'sine']);
});

test('round targets always fit inside the playfield', () => {
  const rng = seededRng(99);
  for (let lv = 0; lv < 200; lv++) {
    const p = createRoundPlan(lv, 0, rng);
    assert.ok(p.targetX - p.targetWidth / 2 >= WORLD.SIDE_MARGIN - 1e-9);
    assert.ok(p.targetX + p.targetWidth / 2 <= WORLD.WIDTH - WORLD.SIDE_MARGIN + 1e-9);
    assert.ok(p.minX < p.maxX);
  }
});

test('block motion stays in bounds for every pattern and bounces', () => {
  for (const pattern of ['linear', 'sine', 'pulse']) {
    const m = new BlockMotion({ minX: 100, maxX: 900, speed: 800, pattern });
    let sawLeft = false;
    let sawRight = false;
    for (let i = 0; i < 5000; i++) {
      m.update(1 / 120);
      assert.ok(m.x >= 100 - 1e-9 && m.x <= 900 + 1e-9, `${pattern} out of bounds: ${m.x}`);
      assert.ok(Number.isFinite(m.currentSpeed) && m.currentSpeed >= 0);
      if (m.direction < 0) sawLeft = true;
      else sawRight = true;
    }
    assert.ok(sawLeft && sawRight, `${pattern} should travel both ways`);
  }
});

test('linear motion travels at the configured speed', () => {
  const m = new BlockMotion({ minX: 0, maxX: 1000, speed: 400 });
  m.update(0.5);
  assert.ok(Math.abs(m.x - 200) < 1e-6);
  const r = new BlockMotion({ minX: 0, maxX: 1000, speed: 400, startSide: 'right' });
  r.update(0.5);
  assert.ok(Math.abs(r.x - 800) < 1e-6);
});

test('motion ignores invalid dt and rejects invalid config', () => {
  const m = new BlockMotion({ minX: 0, maxX: 100, speed: 50 });
  m.update(NaN);
  m.update(-1);
  m.update(Infinity);
  assert.equal(m.x, 0);
  assert.throws(() => new BlockMotion({ minX: 10, maxX: 10, speed: 5 }), RangeError);
  assert.throws(() => new BlockMotion({ minX: 0, maxX: 10, speed: 0 }), RangeError);
});
