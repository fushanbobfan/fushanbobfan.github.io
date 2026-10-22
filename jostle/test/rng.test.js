import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, gaussian } from '../src/rng.js';

test('the same seed gives the same sequence', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('uniform values stay in [0, 1) with mean near one half', () => {
  const rand = mulberry32(7);
  let sum = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    const x = rand();
    assert.ok(x >= 0 && x < 1);
    sum += x;
  }
  assert.ok(Math.abs(sum / n - 0.5) < 0.01);
});

test('normal deviates have mean 0 and variance 1', () => {
  const normal = gaussian(mulberry32(3));
  const n = 40000;
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const z = normal();
    sum += z;
    sq += z * z;
  }
  const mean = sum / n;
  assert.ok(Math.abs(mean) < 0.02);
  assert.ok(Math.abs(sq / n - mean * mean - 1) < 0.03);
});
