import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestFraction, dominantFrequency, axisRatio, formatRatio } from '../src/ratio.js';
import { normalizeDesign } from '../src/harmonograph.js';
import { findPreset } from '../src/presets.js';

test('nearestFraction recovers simple fractions and their neighbours', () => {
  assert.deepEqual(nearestFraction(1.5), { p: 3, q: 2 });
  assert.deepEqual(nearestFraction(1.5015), { p: 3, q: 2 });
  assert.deepEqual(nearestFraction(0.8), { p: 4, q: 5 });
  assert.deepEqual(nearestFraction(2), { p: 2, q: 1 });
  assert.deepEqual(nearestFraction(Math.PI, 10), { p: 22, q: 7 });
  assert.deepEqual(nearestFraction(Math.PI, 200), { p: 355, q: 113 });
});

test('nearestFraction never exceeds the denominator limit and is the best within it', () => {
  for (let i = 1; i < 400; i++) {
    const x = 0.05 + i * 0.0173;
    const f = nearestFraction(x, 12);
    assert.ok(f.q >= 1 && f.q <= 12);
    const err = Math.abs(f.p / f.q - x);
    for (let q = 1; q <= 12; q++) {
      const p = Math.round(x * q);
      assert.ok(err <= Math.abs(p / q - x) + 1e-12, `x=${x} q=${q}`);
    }
  }
});

test('nearestFraction rejects non-positive and non-finite input', () => {
  assert.equal(nearestFraction(0), null);
  assert.equal(nearestFraction(-1), null);
  assert.equal(nearestFraction(NaN), null);
});

test('dominantFrequency picks the largest swing on an axis and counts rotary on both', () => {
  const design = normalizeDesign({
    pendulums: [
      { axis: 'x', amp: 0.2, freq: 6 },
      { axis: 'x', amp: 0.5, freq: 2 },
      { axis: 'rotary', amp: 0.4, freq: 0.5 },
    ],
  });
  assert.equal(dominantFrequency(design, 'x'), 2);
  assert.equal(dominantFrequency(design, 'y'), 0.5);
  assert.equal(dominantFrequency(normalizeDesign({}), 'x'), null);
});

test('axisRatio reports the Lissajous preset as 3:2 slightly sharp', () => {
  const info = axisRatio(findPreset('lissajous-3-2').design);
  assert.equal(info.p, 3);
  assert.equal(info.q, 2);
  assert.ok(Math.abs(info.detune - 0.001) < 1e-9);
  assert.equal(formatRatio(info), 'x : y ≈ 3:2 (+0.10%)');
});

test('formatRatio marks exact ratios and flat detuning', () => {
  assert.equal(formatRatio(axisRatio(findPreset('undamped-knot').design)), 'x : y ≈ 5:4 (exact)');
  const flat = normalizeDesign({ pendulums: [{ axis: 'x', freq: 1.998 }, { axis: 'y', freq: 1 }] });
  assert.equal(formatRatio(axisRatio(flat)), 'x : y ≈ 2:1 (−0.10%)');
  assert.match(formatRatio(null), /horizontal and a vertical/);
});
