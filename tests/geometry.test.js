import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlapWidth, evaluatePlacement, toleranceFor, GRADES } from '../src/core/geometry.js';
import { ACCURACY } from '../src/config.js';

test('overlapWidth handles full, partial, touching and disjoint segments', () => {
  assert.equal(overlapWidth(500, 200, 500, 300), 200); // fully inside
  assert.equal(overlapWidth(500, 200, 600, 200), 100); // partial
  assert.equal(overlapWidth(300, 200, 500, 200), 0); // edges touch
  assert.equal(overlapWidth(100, 50, 900, 50), 0); // disjoint, never negative
});

test('dead-centre placement is PERFECT with full accuracy', () => {
  const r = evaluatePlacement({ blockX: 500, blockWidth: 230, targetX: 500, targetWidth: 300, speed: 360 });
  assert.equal(r.grade, GRADES.PERFECT);
  assert.equal(r.accuracy, 1);
  assert.equal(r.offset, 0);
  assert.equal(r.overlapRatio, 1);
});

test('grades degrade with offset: perfect -> great -> good -> miss', () => {
  const base = { blockWidth: 230, targetX: 500, targetWidth: 300, speed: 360 };
  const maxOffset = (230 + 300) / 2;
  const perfectTol = toleranceFor(ACCURACY.PERFECT, maxOffset, 360);
  const greatTol = toleranceFor(ACCURACY.GREAT, maxOffset, 360);
  assert.ok(perfectTol < greatTol && greatTol < maxOffset);

  assert.equal(evaluatePlacement({ ...base, blockX: 500 + perfectTol - 0.01 }).grade, GRADES.PERFECT);
  assert.equal(evaluatePlacement({ ...base, blockX: 500 + perfectTol + 0.5 }).grade, GRADES.GREAT);
  assert.equal(evaluatePlacement({ ...base, blockX: 500 - greatTol - 0.5 }).grade, GRADES.GOOD);
  assert.equal(evaluatePlacement({ ...base, blockX: 500 + maxOffset - 30 }).grade, GRADES.GOOD);
  assert.equal(evaluatePlacement({ ...base, blockX: 500 + maxOffset }).grade, GRADES.MISS);
  assert.equal(evaluatePlacement({ ...base, blockX: 500 + maxOffset + 100 }).grade, GRADES.MISS);
});

test('a sliver of overlap below MIN_VALID_OVERLAP_RATIO is a MISS', () => {
  const narrower = 230;
  const sliver = narrower * ACCURACY.MIN_VALID_OVERLAP_RATIO * 0.5;
  const blockX = 500 + (230 + 300) / 2 - sliver;
  const r = evaluatePlacement({ blockX, blockWidth: 230, targetX: 500, targetWidth: 300 });
  assert.ok(r.overlap > 0);
  assert.equal(r.grade, GRADES.MISS);
});

test('timing floor widens the perfect window for fast blocks', () => {
  const maxOffset = 125;
  const slow = toleranceFor(ACCURACY.PERFECT, maxOffset, 100);
  const fast = toleranceFor(ACCURACY.PERFECT, maxOffset, 900);
  assert.ok(fast > slow);
  assert.ok(fast <= maxOffset);
});

test('evaluation is symmetric left/right', () => {
  const base = { blockWidth: 200, targetX: 400, targetWidth: 260, speed: 500 };
  const left = evaluatePlacement({ ...base, blockX: 400 - 57 });
  const right = evaluatePlacement({ ...base, blockX: 400 + 57 });
  assert.deepEqual(left, right);
});

test('invalid inputs throw instead of producing NaN scores', () => {
  assert.throws(() => evaluatePlacement({ blockX: NaN, blockWidth: 10, targetX: 0, targetWidth: 10 }), RangeError);
  assert.throws(() => evaluatePlacement({ blockX: 0, blockWidth: 0, targetX: 0, targetWidth: 10 }), RangeError);
  assert.throws(() => evaluatePlacement({ blockX: 0, blockWidth: 10, targetX: 0, targetWidth: -5 }), RangeError);
});
