import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, DIVERGING, hexToRgb, buildLut, paint, viewRange } from '../src/render.js';

test('hex colours parse to bytes', () => {
  assert.deepEqual(hexToRgb('#ff8000'), [255, 128, 0]);
  assert.deepEqual(hexToRgb('0a0B0c'), [10, 11, 12]);
  assert.throws(() => hexToRgb('#fff'), RangeError);
});

test('lookup tables start and end on the first and last stops', () => {
  for (const stops of [...Object.values(PALETTES), DIVERGING]) {
    const lut = buildLut(stops);
    assert.deepEqual(Array.from(lut.slice(0, 3)), hexToRgb(stops[0]));
    assert.deepEqual(Array.from(lut.slice(255 * 4, 255 * 4 + 3)), hexToRgb(stops[stops.length - 1]));
    assert.equal(lut[3], 255);
  }
});

test('sequential palettes get steadily brighter or darker', () => {
  const lum = (lut, i) => 0.2126 * lut[i * 4] + 0.7152 * lut[i * 4 + 1] + 0.0722 * lut[i * 4 + 2];
  for (const [name, stops] of Object.entries(PALETTES)) {
    const lut = buildLut(stops);
    const dir = Math.sign(lum(lut, 255) - lum(lut, 0));
    for (let i = 1; i < 256; i++) assert.ok(dir * (lum(lut, i) - lum(lut, i - 1)) >= -0.5, `${name} at ${i}`);
  }
});

test('painting clamps and maps the range onto the table', () => {
  const lut = buildLut(['#000000', '#ffffff']);
  const out = new Uint8ClampedArray(4 * 4);
  paint(Float64Array.from([-1, 0, 0.5, 2]), out, lut, 0, 1);
  assert.deepEqual([out[0], out[4], out[8], out[12]], [0, 0, 128, 255]);
  paint(Float64Array.from([-1, 0, 1, 0.5]), out, lut, -1, 1);
  assert.deepEqual([out[0], out[4], out[8], out[12]], [0, 128, 255, 191]);
});

test('view ranges centre the growth band and cover growth both ways', () => {
  assert.deepEqual(viewRange('cells', { mu: 0.15 }), [0, 1]);
  assert.deepEqual(viewRange('potential', { mu: 0.15 }), [0, 0.3]);
  assert.deepEqual(viewRange('potential', { mu: 0.7 }), [0, 1]);
  assert.deepEqual(viewRange('growth', { mu: 0.15 }), [-1, 1]);
});
