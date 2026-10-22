import test from 'node:test';
import assert from 'node:assert/strict';
import { decadeRange, makeScale, superscript } from '../src/chart.js';

test('decade ranges cover the data and respect a minimum span', () => {
  assert.deepEqual(decadeRange(3, 4500), [0, 4]);
  assert.deepEqual(decadeRange(0.002, 0.004, 2), [-3, -1]);
  assert.deepEqual(decadeRange(1, 1, 1), [0, 1]);
});

test('the scale maps decade ends to the plot corners', () => {
  const pad = { left: 10, right: 10, top: 10, bottom: 10 };
  const pts = [{ size: 2, density: 0.3 }, { size: 900, density: 1e-5 }];
  const s = makeScale(pts, 210, 110, pad);
  assert.equal(s.px(10 ** s.x0), 10);
  assert.equal(s.px(10 ** s.x1), 200);
  assert.equal(s.py(10 ** s.y0), 100);
  assert.ok(Math.abs(s.py(10 ** s.y1) - 10) < 1e-9);
});

test('exponents render as superscripts', () => {
  assert.equal(superscript(-12), '⁻¹²');
  assert.equal(superscript(3), '³');
});
