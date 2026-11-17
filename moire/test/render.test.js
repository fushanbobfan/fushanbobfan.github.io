import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLayer } from '../src/gratings.js';
import { boxBlur, composite, renderInks, toRGBA } from '../src/render.js';

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

test('one ink array per layer, sized to the image', () => {
  const inks = renderInks(30, 20, [makeLayer(), makeLayer({ kind: 'rings' })]);
  assert.equal(inks.length, 2);
  assert.equal(inks[0].length, 600);
});

test('high-density rendering keeps the period in CSS pixels', () => {
  // Vertical bars, period 10 CSS px, ink on [0, 5): at scale 2 the first ten
  // device pixels are inked and the next ten are clear.
  const [ink] = renderInks(40, 1, [makeLayer({ period: 10 })], 2);
  for (let i = 0; i < 10; i++) assert.equal(ink[i], 1);
  for (let i = 10; i < 20; i++) assert.equal(ink[i], 0);
  assert.equal(ink[20], 1);
});

test('overlapping inks multiply on the light box', () => {
  const black = [0, 0, 0];
  const half = [128, 128, 128];
  const inks = [Float32Array.from([0, 1, 0, 1]), Float32Array.from([0, 0, 1, 1])];
  const rgb = composite(inks, [half, black], [255, 255, 255], 4);
  assert.equal(rgb[0], 255); // both clear
  assert.equal(rgb[3], 128); // only the grey sheet inked
  assert.equal(rgb[6], 0); // black ink blocks everything
  assert.equal(rgb[9], 0);
});

test('two crossed sheets transmit the product of their clear fractions', () => {
  const w = 120;
  const layers = [makeLayer({ period: 6, duty: 0.5 }), makeLayer({ period: 6, duty: 0.5, angle: Math.PI / 2 })];
  const inks = renderInks(w, w, layers);
  const rgb = composite(inks, [[0, 0, 0], [0, 0, 0]], [255, 255, 255], w * w);
  const red = rgb.filter((_, i) => i % 3 === 0);
  assert.ok(Math.abs(mean(red) / 255 - 0.25) < 0.01);
});

test('blur keeps the mean and flattens fine stripes', () => {
  const w = 64;
  const [ink] = renderInks(w, w, [makeLayer({ period: 4 })]);
  const blurred = boxBlur(ink, w, w, 4);
  assert.ok(Math.abs(mean(blurred) - mean(ink)) < 1e-3);
  // Away from the borders, where the repeated edge pixel weighs more.
  const inner = [];
  for (let j = 16; j < w - 16; j++) for (let i = 16; i < w - 16; i++) inner.push(blurred[j * w + i]);
  const spread = Math.max(...inner) - Math.min(...inner);
  assert.ok(spread < 0.05, `left ${spread} of the stripes`);
});

test('blur works on interleaved channels independently', () => {
  const rgb = new Float32Array(3 * 25);
  for (let p = 0; p < 25; p++) rgb[p * 3 + 1] = 90;
  const out = boxBlur(rgb, 5, 5, 1, 3);
  for (let p = 0; p < 25; p++) {
    assert.equal(out[p * 3], 0);
    assert.ok(Math.abs(out[p * 3 + 1] - 90) < 1e-4);
  }
});

test('RGBA output is opaque', () => {
  const out = toRGBA(Float32Array.from([10, 20, 30]), 1);
  assert.deepEqual([...out], [10, 20, 30, 255]);
});
