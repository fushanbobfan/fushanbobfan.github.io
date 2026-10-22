import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, buildLut, lutIndex, periodColour, LUT_SIZE } from '../src/palette.js';

test('tables hit their stops and close the cycle', () => {
  for (const [name, stops] of Object.entries(PALETTES)) {
    const lut = buildLut(stops);
    assert.equal(lut.length, LUT_SIZE * 3);
    assert.deepEqual(Array.from(lut.slice(0, 3)), stops[0].slice(1), `${name} starts on its first stop`);
    // last stop repeats the first so the gradient wraps without a seam
    assert.deepEqual(stops[stops.length - 1].slice(1), stops[0].slice(1), `${name} wraps`);
    const end = Array.from(lut.slice(-3));
    const first = stops[0].slice(1);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(end[k] - first[k]) < 12, `${name} seam`);
  }
});

test('interpolation is linear between two stops', () => {
  const lut = buildLut([[0, 0, 0, 0], [1, 200, 100, 0]], 4);
  assert.deepEqual(Array.from(lut), [0, 0, 0, 50, 25, 0, 100, 50, 0, 150, 75, 0]);
});

test('lutIndex wraps any real value into the table', () => {
  assert.equal(lutIndex(0), 0);
  assert.equal(lutIndex(0.5), LUT_SIZE / 2);
  assert.equal(lutIndex(1.5), LUT_SIZE / 2);
  assert.equal(lutIndex(-0.25), (3 * LUT_SIZE) / 4);
  assert.equal(lutIndex(0.9999999999), LUT_SIZE - 1);
});

test('the first twelve periods get different colours', () => {
  const seen = new Set();
  for (let p = 1; p <= 12; p++) seen.add(periodColour(p).join(','));
  assert.equal(seen.size, 12);
  assert.deepEqual(periodColour(13), periodColour(1));
  assert.deepEqual(periodColour(0), [6, 6, 10]);
});
