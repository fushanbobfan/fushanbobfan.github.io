import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, randomInt, shuffle } from '../src/rng.js';

test('the same seed reproduces the same sequence', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('different seeds diverge', () => {
  const a = createRng(1);
  const b = createRng(2);
  const same = Array.from({ length: 20 }, () => a() === b()).filter(Boolean).length;
  assert.ok(same < 20);
});

test('values stay in [0, 1) and cover the range', () => {
  const rng = createRng(7);
  let min = 1;
  let max = 0;
  for (let i = 0; i < 5000; i++) {
    const x = rng();
    assert.ok(x >= 0 && x < 1);
    min = Math.min(min, x);
    max = Math.max(max, x);
  }
  assert.ok(min < 0.01);
  assert.ok(max > 0.99);
});

test('randomInt stays inside [0, n)', () => {
  const rng = createRng(3);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const k = randomInt(rng, 6);
    assert.ok(Number.isInteger(k) && k >= 0 && k < 6);
    seen.add(k);
  }
  assert.equal(seen.size, 6);
});

test('shuffle permutes in place without losing items', () => {
  const rng = createRng(11);
  const items = Array.from({ length: 30 }, (_, i) => i);
  const result = shuffle(rng, items);
  assert.equal(result, items);
  assert.deepEqual([...items].sort((a, b) => a - b), Array.from({ length: 30 }, (_, i) => i));
  assert.notDeepEqual(items, Array.from({ length: 30 }, (_, i) => i));
});
