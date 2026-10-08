import { test } from 'node:test';
import assert from 'node:assert/strict';
import { biasFromX, isUniform, rowBiases } from '../src/patterns.js';
import { binPmf, binomialPmf, pmfMoments } from '../src/stats.js';

test('the same pattern gives one chance for every row', () => {
  const b = rowBiases('same', 6, 0.3);
  assert.deepEqual(b, [0.3, 0.3, 0.3, 0.3, 0.3, 0.3]);
  assert.ok(isUniform(b));
});

test('alternate swaps p and 1 - p row by row', () => {
  assert.deepEqual(rowBiases('alternate', 5, 0.2), [0.2, 0.8, 0.2, 0.8, 0.2]);
});

test('ramp runs from p down or up to 1 - p', () => {
  const b = rowBiases('ramp', 5, 0.1);
  assert.deepEqual(b, [0.1, 0.3, 0.5, 0.7, 0.9]);
  assert.deepEqual(rowBiases('ramp', 1, 0.1), [0.1]);
});

test('random rows depend only on the seed', () => {
  const a = rowBiases('random', 20, 0.5, { seed: 7 });
  assert.deepEqual(a, rowBiases('random', 20, 0.9, { seed: 7 }));
  assert.notDeepEqual(a, rowBiases('random', 20, 0.5, { seed: 8 }));
  assert.ok(a.every((x) => x >= 0 && x <= 1));
  assert.ok(!isUniform(a));
});

test('hand-set rows keep what was painted and fill gaps with p', () => {
  assert.deepEqual(rowBiases('hand', 4, 0.5, { custom: [0.1, 0.95] }), [0.1, 0.95, 0.5, 0.5]);
  assert.deepEqual(rowBiases('hand', 2, 0.5, { custom: [7, -1] }), [1, 0]);
});

test('unknown patterns fall back to the same chance everywhere', () => {
  assert.deepEqual(rowBiases('nonsense', 3, 0.4), [0.4, 0.4, 0.4]);
});

test('uneven rows narrow the pile compared with a binomial of the same mean', () => {
  const rows = 12;
  const b = rowBiases('alternate', rows, 0.1);
  const uneven = pmfMoments(binPmf(rows, b));
  const mean = b.reduce((x, y) => x + y, 0) / rows;
  const even = pmfMoments(binomialPmf(rows, mean));
  assert.ok(Math.abs(uneven.mean - even.mean) < 1e-12);
  assert.ok(uneven.variance < even.variance);
  assert.ok(Math.abs(uneven.variance - rows * 0.09) < 1e-12);
});

test('painting maps the pointer across the board to a chance', () => {
  assert.equal(biasFromX(100, 100, 300), 0);
  assert.equal(biasFromX(300, 100, 300), 1);
  assert.equal(biasFromX(250, 100, 300), 0.75);
  assert.equal(biasFromX(-50, 100, 300), 0);
  assert.equal(biasFromX(5, 10, 10), 0.5);
});
