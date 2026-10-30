import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radialAngle, filterWeights, polarizationDegree } from '../src/polarizer.js';
import { bowTop, bowSpan } from '../src/sky.js';
import { angularProfile, colourProfile } from '../src/scatter.js';

const R = Math.PI / 180;

function near(a, b, eps = 1e-6) {
  const d = Math.atan2(Math.sin(a - b), Math.cos(a - b));
  return Math.abs(d) < eps;
}

test('from the top of the bow the antisolar point is straight down the page', () => {
  for (const el0 of [-10 * R, 0, 20 * R]) {
    const sun = 12 * R;
    assert.ok(near(radialAngle(0, bowTop(42 * R, sun), sun, el0), -Math.PI / 2));
  }
});

test('at the foot of a low-sun bow the antisolar point is sideways', () => {
  const sun = 0;
  const span = bowSpan(42 * R, sun);
  assert.ok(near(radialAngle(span, 0, sun, 0), Math.PI));
  assert.ok(near(radialAngle(-span, 0, sun, 0), 0));
});

test('the radial angle points at the projected antisolar point when that is the centre', () => {
  const sun = 15 * R;
  for (const az of [0.3, -0.8, 1.2]) {
    const el = 0.4;
    const ang = radialAngle(az, el, sun, -sun);
    // Great circles through the projection centre are straight lines.
    const x = Math.cos(el) * Math.sin(az);
    const k = 2 / (1 + Math.sin(-sun) * Math.sin(el) + Math.cos(-sun) * Math.cos(el) * Math.cos(az));
    const y = Math.cos(-sun) * Math.sin(el) - Math.sin(-sun) * Math.cos(el) * Math.cos(az);
    assert.ok(near(ang, Math.atan2(-k * y, -k * x), 1e-4));
  }
});

test('a filter along the bow passes the s light and one across it the p light', () => {
  const radial = -Math.PI / 2;
  const along = filterWeights(radial, 0);
  assert.ok(Math.abs(along.s - 1) < 1e-12 && Math.abs(along.p) < 1e-12);
  const across = filterWeights(radial, Math.PI / 2);
  assert.ok(Math.abs(across.s) < 1e-12 && Math.abs(across.p - 1) < 1e-12);
  for (const a of [0.1, 0.9, 2.5]) {
    const w = filterWeights(0.4, a);
    assert.ok(Math.abs(w.s + w.p - 1) < 1e-12);
  }
});

test('the light of the primary bow is mostly polarized, inside it much less', () => {
  const rgb = colourProfile(angularProfile({ orders: [1], samples: 8000 }));
  const at = (deg) => {
    const b = Math.round(deg / rgb.binDeg);
    return polarizationDegree(rgb.rgbS.slice(3 * b, 3 * b + 3), rgb.rgbP.slice(3 * b, 3 * b + 3));
  };
  assert.ok(at(41.8) > 0.9, `bow ${at(41.8)}`);
  assert.ok(at(20) < at(41.8) - 0.3, `inside ${at(20)}`);
});
