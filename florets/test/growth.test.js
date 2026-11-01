import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TAU, crowding, leastCrowded, divergenceDeg, growthAt, Tip, grow, contactPairOf, settled,
} from '../src/growth.js';
import { GOLDEN_DEG } from '../src/phyllo.js';

const near = (a, b, tol) => Math.abs(a - b) <= tol;

test('a lone primordium pushes the next one to the opposite side', () => {
  const a = leastCrowded([{ r: 2, a: 0 }]);
  assert.ok(near(a, Math.PI, 1e-6), `${a}`);
});

test('two primordia a quarter turn apart leave the gap opposite their midpoint', () => {
  const a = leastCrowded([{ r: 1.5, a: 0 }, { r: 1.5, a: Math.PI / 2 }]);
  assert.ok(near(a, (5 * Math.PI) / 4, 1e-6), `${a}`);
});

test('crowding falls off with distance', () => {
  const close = crowding(0, [{ r: 1.2, a: 0 }]);
  const far = crowding(0, [{ r: 3, a: 0 }]);
  assert.ok(close > far);
  assert.ok(near(crowding(0, [{ r: 2, a: 0 }], 3), 1, 1e-12));
});

test('divergences are folded into [0, 180] so mirror images agree', () => {
  assert.ok(near(divergenceDeg(0, TAU * 0.25), 90, 1e-9));
  assert.ok(near(divergenceDeg(0, TAU * 0.75), 90, 1e-9));
  assert.ok(near(divergenceDeg(TAU * 0.9, TAU * 0.1), 72, 1e-9));
});

test('the growth ratio eases geometrically from start to end', () => {
  assert.equal(growthAt(0, 100, 3, 1.05), 3);
  assert.ok(near(growthAt(99, 100, 3, 1.05), 1.05, 1e-12));
  assert.ok(near(growthAt(49.5, 100, 4, 1), 2, 1e-12));
  assert.equal(growthAt(10, 100, 1.2), 1.2);
});

test('a fast drift keeps the tip alternating at 180 degrees', () => {
  const { divergences } = grow({ start: 6, end: 6, steps: 60 });
  const s = settled(divergences);
  assert.ok(near(s.mean, 180, 1e-6) && s.spread < 1e-6, JSON.stringify(s));
});

test('slowing the drift as the shoot grows brings the divergence to the golden angle', () => {
  const tip = new Tip({ start: 3, end: 1.05, steps: 300 }).run();
  assert.equal(tip.divergences.length, 300);
  assert.ok(near(tip.divergences[0], 180, 1e-4));
  const s = settled(tip.divergences);
  assert.ok(near(s.mean, GOLDEN_DEG, 1), `settled at ${s.mean}`);
  assert.ok(s.spread < 1, `spread ${s.spread}`);
});

test('the spirals of the grown tip climb the Fibonacci numbers', () => {
  const { primordia } = grow({ start: 3, end: 1.05, steps: 300 });
  const fib = [1, 2, 3, 5, 8, 13, 21];
  let prev = 0;
  for (const n of [60, 120, 240, 280]) {
    const [a, b] = contactPairOf(primordia, n);
    const i = fib.indexOf(a);
    assert.ok(i >= 0 && fib[i + 1] === b, `primordium ${n}: ${a}, ${b}`);
    assert.ok(a >= prev);
    prev = a;
  }
  assert.deepEqual(contactPairOf(primordia, 280), [5, 8]);
});

test('a slow drift from the start can lock onto the Lucas branch instead', () => {
  const { primordia, divergences } = grow({ start: 1.15, end: 1.15, steps: 250 });
  const s = settled(divergences);
  assert.ok(s.mean > 95 && s.mean < 105 && s.spread < 0.01, JSON.stringify(s));
  assert.deepEqual(contactPairOf(primordia, 200), [4, 7]);
});
