import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScoreKeeper, multiplierForCombo, perfectBonusFor } from '../src/core/scoring.js';
import { SCORING } from '../src/config.js';

test('base points per grade with no streaks', () => {
  const sk = new ScoreKeeper();
  assert.equal(sk.register('good').points, SCORING.BASE_POINTS.good);
  assert.equal(sk.register('great').points, SCORING.BASE_POINTS.great);
  sk.reset();
  assert.equal(sk.register('perfect').points, SCORING.BASE_POINTS.perfect);
  assert.equal(sk.score, SCORING.BASE_POINTS.perfect);
});

test('multiplier grows every COMBO_STEP great-or-better hits and caps', () => {
  assert.equal(multiplierForCombo(0), 1);
  assert.equal(multiplierForCombo(SCORING.COMBO_STEP - 1), 1);
  assert.equal(multiplierForCombo(SCORING.COMBO_STEP), 1 + SCORING.MULTIPLIER_STEP);
  assert.equal(multiplierForCombo(10_000), SCORING.MAX_MULTIPLIER);
  assert.equal(multiplierForCombo(NaN), 1);
  assert.equal(multiplierForCombo(-5), 1);
});

test('perfect streak bonus grows and caps', () => {
  assert.equal(perfectBonusFor(1), 0);
  assert.equal(perfectBonusFor(2), SCORING.PERFECT_STREAK_BONUS);
  assert.equal(perfectBonusFor(999), SCORING.PERFECT_STREAK_BONUS_CAP);
});

test('consecutive perfects build streak, bonus and multiplier', () => {
  const sk = new ScoreKeeper();
  const results = [];
  for (let i = 0; i < SCORING.COMBO_STEP; i++) results.push(sk.register('perfect'));
  const last = results.at(-1);
  assert.equal(last.combo, SCORING.COMBO_STEP);
  assert.equal(last.perfectStreak, SCORING.COMBO_STEP);
  assert.equal(last.multiplier, 1 + SCORING.MULTIPLIER_STEP);
  const expected = Math.round((SCORING.BASE_POINTS.perfect + perfectBonusFor(SCORING.COMBO_STEP)) * last.multiplier);
  assert.equal(last.points, expected);
  assert.equal(sk.score, results.reduce((s, r) => s + r.points, 0));
  assert.equal(sk.maxPerfectStreak, SCORING.COMBO_STEP);
});

test('great keeps the combo but ends the perfect streak', () => {
  const sk = new ScoreKeeper();
  sk.register('perfect');
  sk.register('perfect');
  const r = sk.register('great');
  assert.equal(r.combo, 3);
  assert.equal(r.perfectStreak, 0);
  assert.equal(r.comboBroken, false);
  assert.equal(sk.maxPerfectStreak, 2);
});

test('good breaks the combo and reports it once', () => {
  const sk = new ScoreKeeper();
  sk.register('great');
  sk.register('great');
  const r = sk.register('good');
  assert.equal(r.combo, 0);
  assert.equal(r.multiplier, 1);
  assert.equal(r.comboBroken, true);
  assert.equal(sk.register('good').comboBroken, false); // nothing left to break
  assert.equal(sk.maxCombo, 2);
});

test('unknown or miss grades award nothing and never corrupt the score', () => {
  const sk = new ScoreKeeper();
  sk.register('perfect');
  const before = sk.score;
  assert.equal(sk.register('miss').points, 0);
  assert.equal(sk.register('bogus').points, 0);
  assert.equal(sk.register(undefined).points, 0);
  assert.equal(sk.score, before);
  assert.ok(Number.isInteger(sk.score) && sk.score >= 0);
});

test('long perfect run keeps the score a finite non-negative integer', () => {
  const sk = new ScoreKeeper();
  for (let i = 0; i < 5000; i++) sk.register(i % 7 === 0 ? 'good' : 'perfect');
  assert.ok(Number.isSafeInteger(sk.score) && sk.score > 0);
});
