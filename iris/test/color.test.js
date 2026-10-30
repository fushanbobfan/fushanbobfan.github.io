import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cmf, spectrumToLinear, SUNLIGHT, planck, wavelengthColor } from '../src/color.js';
import { WAVELENGTHS } from '../src/water.js';

test('the luminance curve peaks near 555 nm at about 1', () => {
  let best = 0;
  let at = 0;
  for (let l = 380; l <= 780; l++) {
    const y = cmf(l)[1];
    if (y > best) {
      best = y;
      at = l;
    }
  }
  assert.ok(Math.abs(best - 1) < 0.02, `peak ${best}`);
  assert.ok(at >= 550 && at <= 565, `at ${at}`);
});

test('the three matching functions enclose nearly equal areas', () => {
  const area = [0, 0, 0];
  for (let l = 360; l <= 830; l++) cmf(l).forEach((v, c) => (area[c] += v));
  for (const a of area) assert.ok(Math.abs(a / area[1] - 1) < 0.05, `areas ${area}`);
});

test('a 5778 K blackbody peaks near 500 nm', () => {
  let at = 0;
  let best = 0;
  for (let l = 300; l <= 900; l++) {
    if (planck(l, 5778) > best) {
      best = planck(l, 5778);
      at = l;
    }
  }
  assert.ok(Math.abs(at - 501) <= 2, `at ${at}`);
});

test('unfiltered sunlight comes out white', () => {
  const c = spectrumToLinear(WAVELENGTHS.map(() => 1));
  for (const v of c) assert.ok(Math.abs(v - 1) < 1e-12);
  assert.ok(SUNLIGHT.every((v) => v > 0 && v <= 1));
});

test('single wavelengths get their expected hues', () => {
  const parse = (s) => s.match(/\d+/g).map(Number);
  const [r1, g1, b1] = parse(wavelengthColor(650));
  assert.ok(r1 > g1 && r1 > b1);
  const [r2, g2, b2] = parse(wavelengthColor(530));
  assert.ok(g2 > r2 && g2 > b2);
  const [r3, g3, b3] = parse(wavelengthColor(450));
  assert.ok(b3 > r3 && b3 > g3);
});
