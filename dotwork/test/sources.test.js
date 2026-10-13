import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_IDS, sourceInfo, drawSource } from '../src/sources.js';
import { fieldMean } from '../src/density.js';

test('every built-in picture has a label, a note and values in [0, 1]', () => {
  assert.ok(SOURCE_IDS.length >= 5);
  for (const id of SOURCE_IDS) {
    const info = sourceInfo(id);
    assert.ok(info.label && info.note);
    const f = drawSource(id, 60, 40);
    assert.equal(f.data.length, 60 * 40);
    let lo = 1;
    let hi = 0;
    for (const v of f.data) {
      assert.ok(v >= 0 && v <= 1, `${id} value ${v}`);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    assert.ok(hi - lo > 0.5, `${id} should have real contrast`);
  }
});

test('the tone ramp rises left to right and averages one half', () => {
  const f = drawSource('ramp', 100, 10);
  assert.ok(f.data[0] < f.data[50] && f.data[50] < f.data[99]);
  assert.ok(Math.abs(fieldMean(f) - 0.5) < 1e-6);
});

test('the shaded ball is darker on its shadowed side than at the highlight', () => {
  const f = drawSource('sphere', 200, 200);
  const at = (u, v) => f.data[Math.round((v + 1) * 100) * 200 + Math.round((u + 1) * 100)];
  assert.ok(at(0.4, 0.4) > at(-0.4, -0.4) + 0.3);
});

test('points inside the Mandelbrot set are full ink', () => {
  const f = drawSource('mandelbrot', 101, 101);
  // u, v = 0 maps to c = -0.6, inside the main cardioid.
  assert.equal(f.data[50 * 101 + 50], 1);
});

test('an unknown picture is refused', () => {
  assert.throws(() => drawSource('nope', 10, 10));
  assert.throws(() => sourceInfo('nope'));
});
