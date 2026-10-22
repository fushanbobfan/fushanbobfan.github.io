import test from 'node:test';
import assert from 'node:assert/strict';
import { kernelCore, parseRings, formatRings, kernelShell, kernelProfile, growth, growthBand } from '../src/rules.js';

test('kernel core is a bump that vanishes at both ends and peaks at one half', () => {
  assert.equal(kernelCore(0), 0);
  assert.equal(kernelCore(1), 0);
  assert.equal(kernelCore(-0.2), 0);
  assert.ok(Math.abs(kernelCore(0.5) - 1) < 1e-12);
  assert.ok(Math.abs(kernelCore(0.3) - kernelCore(0.7)) < 1e-12);
  assert.ok(kernelCore(0.4) < kernelCore(0.5));
});

test('ring heights parse fractions and decimals and reject nonsense', () => {
  assert.deepEqual(parseRings('1'), [1]);
  assert.deepEqual(parseRings('1, 1/3'), [1, 1 / 3]);
  assert.deepEqual(parseRings('3/4,1,1/2'), [0.75, 1, 0.5]);
  assert.deepEqual(parseRings('0.25,1'), [0.25, 1]);
  assert.throws(() => parseRings(''), RangeError);
  assert.throws(() => parseRings('2'), RangeError);
  assert.throws(() => parseRings('1,a'), RangeError);
  assert.throws(() => parseRings('1,1,1,1,1'), RangeError);
});

test('ring heights format back to the same short text', () => {
  for (const s of ['1', '1,1/3', '3/4,1,1/2', '1/2,1', '0.2,1']) assert.equal(formatRings(parseRings(s)), s);
});

test('a single ring peaks halfway out; two rings peak in the middle of each', () => {
  assert.ok(Math.abs(kernelShell(6.5, 13, [1]) - 1) < 1e-12);
  assert.equal(kernelShell(13, 13, [1]), 0);
  assert.equal(kernelShell(20, 13, [1]), 0);
  assert.ok(Math.abs(kernelShell(2.5, 10, [0.5, 1]) - 0.5) < 1e-12);
  assert.ok(Math.abs(kernelShell(7.5, 10, [0.5, 1]) - 1) < 1e-12);
  assert.equal(kernelShell(5, 10, [0.5, 1]), 0);
});

test('profile samples run from centre to edge', () => {
  const p = kernelProfile([1], 101);
  assert.equal(p.length, 101);
  assert.equal(p[0], 0);
  assert.equal(p[100], 0);
  assert.ok(Math.abs(p[50] - 1) < 1e-12);
});

test('growth is +1 at mu, -1 far away, and zero on the edges of its band', () => {
  assert.equal(growth(0.15, 0.15, 0.015), 1);
  assert.ok(growth(0.5, 0.15, 0.015) < -0.999);
  const [lo, hi] = growthBand(0.15, 0.015);
  assert.ok(Math.abs(growth(lo, 0.15, 0.015)) < 1e-12);
  assert.ok(Math.abs(growth(hi, 0.15, 0.015)) < 1e-12);
  assert.ok(hi - lo > 2 * 0.015);
});
