import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOLDEN_DEG, GOLDEN_TURNS, PHI, florets, floretPosition, continuedFraction,
  convergents, contactPair, winding, packing, fibonacciUpTo,
} from '../src/phyllo.js';

test('the golden angle is 360 / phi^2 degrees', () => {
  assert.ok(Math.abs(GOLDEN_DEG - 360 / (PHI * PHI)) < 1e-9);
  assert.ok(Math.abs(GOLDEN_DEG - 137.50776405) < 1e-7);
});

test('florets keep a constant area each: n florets fill a disc of radius c sqrt(n)', () => {
  const p = floretPosition(400, GOLDEN_TURNS, 2);
  assert.ok(Math.abs(p.r - 40) < 1e-12);
  assert.ok(Math.abs(Math.hypot(p.x, p.y) - 40) < 1e-9);
  assert.equal(florets(123, 0.3).length, 123);
});

test('the golden fraction is [0; 2, 1, 1, 1, ...] and its convergents have Fibonacci denominators', () => {
  const cf = continuedFraction(GOLDEN_TURNS, 14);
  assert.deepEqual(cf.slice(0, 2), [0, 2]);
  assert.ok(cf.slice(2).every((a) => a === 1));
  const qs = convergents(cf).map((c) => c.q);
  assert.deepEqual(qs.slice(0, 10), [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]);
});

test('a rational angle has a finite continued fraction', () => {
  assert.deepEqual(continuedFraction(2 / 5), [0, 2, 2]);
  assert.deepEqual(continuedFraction(0.5), [0, 2]);
  const last = convergents(continuedFraction(3 / 8)).at(-1);
  assert.deepEqual(last, { p: 3, q: 8 });
});

test('convergents approach the value from alternating sides', () => {
  const x = 0.3141592653;
  const cs = convergents(continuedFraction(x, 8));
  for (let i = 1; i < cs.length; i++) {
    const e0 = cs[i - 1].p / cs[i - 1].q - x;
    const e1 = cs[i].p / cs[i].q - x;
    assert.ok(Math.abs(e1) <= Math.abs(e0) + 1e-15);
    if (Math.abs(e1) > 1e-12) assert.ok(Math.sign(e0) !== Math.sign(e1));
  }
});

test('golden heads show consecutive Fibonacci spirals that climb with the radius', () => {
  const fib = fibonacciUpTo(1000);
  let prev = 0;
  for (const n of [20, 50, 200, 1000, 3000]) {
    const [a, b] = contactPair(n, GOLDEN_TURNS);
    const i = fib.indexOf(a);
    assert.ok(i >= 0, `${a} is Fibonacci`);
    assert.equal(fib[i + 1], b, `${a}, ${b} are consecutive`);
    assert.ok(a >= prev);
    prev = a;
  }
  assert.deepEqual(contactPair(1000, GOLDEN_TURNS), [55, 89]);
});

test('a rational angle p/q puts the florets on q straight spokes', () => {
  assert.equal(contactPair(2000, 2 / 5)[0], 5);
  assert.equal(contactPair(2000, 3 / 8)[0], 8);
});

test('the two families of a golden head wind in opposite directions', () => {
  for (const [a, b] of [[8, 13], [21, 34], [55, 89]]) {
    assert.notEqual(winding(a, GOLDEN_TURNS), winding(b, GOLDEN_TURNS));
  }
});

test('the golden angle packs the head more evenly than its near neighbours', () => {
  const n = 1500;
  const golden = packing(florets(n, GOLDEN_TURNS));
  assert.ok(golden > 0.85, `golden packing ${golden}`);
  for (const deg of [137.3, 137.45, 137.5, 137.55, 137.6, 99.5]) {
    const other = packing(florets(n, deg / 360));
    assert.ok(golden > other, `${deg}: ${other} vs golden ${golden}`);
  }
});

test('mirroring the angle mirrors the head and keeps its packing', () => {
  const a = packing(florets(800, GOLDEN_TURNS));
  const b = packing(florets(800, 1 - GOLDEN_TURNS));
  assert.ok(Math.abs(a - b) < 1e-9);
});
