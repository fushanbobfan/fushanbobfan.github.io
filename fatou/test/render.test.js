import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRows, shadeSample, samplePoint } from '../src/render.js';
import { fitView, toPixel } from '../src/view.js';
import { PALETTES, buildLut, periodColour } from '../src/palette.js';
import { SAMPLE_SIZE, ESCAPED, PERIOD, SMOOTH, DISTANCE } from '../src/dynamics.js';
import { attractingCycle } from '../src/cycle.js';

const lut = buildLut(PALETTES.ember);
const base = { julia: false, c: [0, 0], maxIter: 300, colouring: 'bands', interior: 'period', lut, density: 1, offset: 0 };

function pixelAt(img, w, x, y) {
  const p = 4 * (y * w + x);
  return Array.from(img.slice(p, p + 3));
}

test('the full picture colours the cardioid, the period-2 disk and the outside', () => {
  const w = 120;
  const h = 90;
  const view = fitView(-2.5, 1, -1.25, 1.25, w, h);
  const img = new Uint8ClampedArray(w * h * 4);
  renderRows(img, w, h, view, base, 0, h);
  const at = (x, y) => {
    const [px, py] = toPixel(view, w, h, x, y);
    return pixelAt(img, w, Math.floor(px), Math.floor(py));
  };
  assert.deepEqual(at(-0.1, 0.05), periodColour(1));
  assert.deepEqual(at(-1, 0.02), periodColour(2));
  assert.notDeepEqual(at(0.9, 1.0), periodColour(1));
  for (let i = 3; i < img.length; i += 4) assert.equal(img[i], 255);
});

test('a coarse pass fills every pixel, including ragged right and bottom edges', () => {
  const w = 37;
  const h = 23;
  const view = fitView(-2.5, 1, -1.25, 1.25, w, h);
  const img = new Uint8ClampedArray(w * h * 4);
  renderRows(img, w, h, view, base, 0, h, 8);
  for (let i = 3; i < img.length; i += 4) assert.equal(img[i], 255, `pixel ${(i - 3) / 4}`);
  // a block shares one colour
  assert.deepEqual(pixelAt(img, w, 0, 0), pixelAt(img, w, 7, 7));
});

test('row ranges can be rendered in pieces with the same result', () => {
  const w = 40;
  const h = 30;
  const view = fitView(-2, 0.6, -1.2, 1.2, w, h);
  const whole = new Uint8ClampedArray(w * h * 4);
  renderRows(whole, w, h, view, base, 0, h);
  const pieces = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 7) renderRows(pieces, w, h, view, base, y, Math.min(h, y + 7));
  assert.deepEqual(pieces, whole);
});

test('Julia mode iterates the pixel under the chosen c', () => {
  const out = new Float64Array(SAMPLE_SIZE);
  const opts = { ...base, julia: true, c: [-1, 0] };
  assert.equal(samplePoint(out, 0, 0, opts)[PERIOD], 2);
  assert.equal(samplePoint(out, 1.7, 0, opts)[ESCAPED], 1);
});

test('boundary colouring darkens points within a pixel or two of the set', () => {
  const s = new Float64Array(SAMPLE_SIZE);
  s[ESCAPED] = 1;
  s[SMOOTH] = 10;
  const opts = { ...base, colouring: 'boundary' };
  s[DISTANCE] = 0.1;
  const far = shadeSample(s, opts, 0.01, [0, 0, 0]).slice();
  s[DISTANCE] = 0.002;
  const near = shadeSample(s, opts, 0.01, [0, 0, 0]).slice();
  const sum = (c) => c[0] + c[1] + c[2];
  assert.ok(sum(near) < sum(far) * 0.5);
  assert.deepEqual(far, shadeSample(s, { ...opts, colouring: 'bands' }, 0.01, [0, 0, 0]));
});

test('phase colouring paints the two basilica components differently', () => {
  const c = [-1, 0];
  const cycle = attractingCycle(...c);
  const opts = { ...base, julia: true, c, interior: 'phase', cycle };
  const out = new Float64Array(SAMPLE_SIZE);
  const colourAt = (x, y) => shadeSample(samplePoint(out, x, y, opts), opts, 0.01, [0, 0, 0]).slice();
  const a = colourAt(0.05, 0.05);
  const b = colourAt(-1.05, 0.03);
  assert.notDeepEqual(a, b);
  assert.deepEqual(colourAt(-0.03, -0.06), a);
  // with interior 'period' the whole basin shares one colour
  const p = { ...opts, interior: 'period' };
  assert.deepEqual(shadeSample(samplePoint(out, 0.05, 0.05, p), p, 0.01, [0, 0, 0]).slice(),
    shadeSample(samplePoint(out, -1.05, 0.03, p), p, 0.01, [0, 0, 0]).slice());
});

test('phase colouring without a cycle falls back to the period', () => {
  const s = new Float64Array(SAMPLE_SIZE);
  s[PERIOD] = 4;
  assert.deepEqual(shadeSample(s, { ...base, interior: 'phase' }, 0.01, [0, 0, 0]), periodColour(4));
});

test('dark interior ignores the period', () => {
  const s = new Float64Array(SAMPLE_SIZE);
  s[PERIOD] = 3;
  assert.deepEqual(shadeSample(s, { ...base, interior: 'dark' }, 0.01, [0, 0, 0]), [6, 6, 10]);
  assert.deepEqual(shadeSample(s, base, 0.01, [0, 0, 0]), periodColour(3));
});
