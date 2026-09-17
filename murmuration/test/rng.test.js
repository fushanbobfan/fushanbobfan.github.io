import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, randomRange } from '../src/rng.js';

test('the same seed produces the same sequence', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

test('different seeds diverge', () => {
  const a = createRng(1);
  const b = createRng(2);
  const same = Array.from({ length: 10 }, () => a() === b()).every(Boolean);
  assert.equal(same, false);
});

test('values stay inside [0, 1)', () => {
  const rng = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1);
  }
});

test('randomRange maps into the requested interval', () => {
  const rng = createRng(3);
  for (let i = 0; i < 1000; i++) {
    const v = randomRange(rng, -5, 5);
    assert.ok(v >= -5 && v < 5);
  }
});
