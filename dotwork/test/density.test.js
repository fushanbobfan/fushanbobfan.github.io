import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField, fieldFromRgba, adjustField, fieldMean, resizeField, fitSize } from '../src/density.js';

test('black reads as full ink, white and transparent as paper', () => {
  const rgba = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0, 128, 128, 128, 255]);
  const f = fieldFromRgba(rgba, 2, 2);
  assert.equal(f.data[0], 1);
  assert.equal(f.data[1], 0);
  assert.equal(f.data[2], 0);
  assert.ok(Math.abs(f.data[3] - (1 - 128 / 255)) < 1e-6);
});

test('green weighs more than blue in the luma', () => {
  const f = fieldFromRgba(new Uint8ClampedArray([0, 255, 0, 255, 0, 0, 255, 255]), 2, 1);
  assert.ok(f.data[0] < f.data[1]);
});

test('a mismatched data length is refused', () => {
  assert.throws(() => createField(3, 3, new Float32Array(8)));
});

test('invert, floor and clamping behave', () => {
  const f = createField(4, 1, new Float32Array([0, 0.05, 0.5, 1]));
  assert.deepEqual([...adjustField(f, { invert: true }).data].map((v) => +v.toFixed(3)), [1, 0.95, 0.5, 0]);
  assert.equal(adjustField(f, { floor: 0.1 }).data[1], 0);
  const hard = adjustField(f, { contrast: 4 });
  assert.equal(hard.data[0], 0);
  assert.equal(hard.data[3], 1);
});

test('gamma above one lightens mid tones without moving the ends', () => {
  const f = createField(3, 1, new Float32Array([0, 0.5, 1]));
  const g = adjustField(f, { gamma: 2 });
  assert.equal(g.data[0], 0);
  assert.equal(g.data[2], 1);
  assert.ok(Math.abs(g.data[1] - 0.25) < 1e-6);
});

test('box resampling keeps the mean of an evenly divided field', () => {
  const f = createField(8, 6);
  for (let i = 0; i < f.data.length; i++) f.data[i] = (i * 37) % 11 / 10;
  const small = resizeField(f, 4, 3);
  assert.ok(Math.abs(fieldMean(small) - fieldMean(f)) < 1e-6);
});

test('fitSize keeps the aspect ratio and never upscales', () => {
  assert.deepEqual(fitSize(2000, 1000, 500), { width: 500, height: 250 });
  assert.deepEqual(fitSize(300, 200, 500), { width: 300, height: 200 });
});
