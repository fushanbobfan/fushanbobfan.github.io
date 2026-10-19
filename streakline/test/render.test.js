import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diverging,
  sequential,
  luminance,
  paintField,
  pressureCoefficient,
  fieldScale,
  OBSTACLE,
  WALL,
} from '../src/render.js';
import { clampSettings } from '../src/settings.js';
import { createSim, paintWalls } from '../src/sim.js';

test('the diverging map runs blue, pale, red and clamps outside [-1, 1]', () => {
  const [r0, , b0] = diverging(-1);
  const mid = diverging(0);
  const [r1, , b1] = diverging(1);
  assert.ok(b0 > r0 && r1 > b1);
  assert.ok(luminance(mid) > 0.85);
  assert.deepEqual(diverging(-5), diverging(-1));
  assert.deepEqual(diverging(7), diverging(1));
});

test('the sequential map gets steadily lighter', () => {
  let last = -1;
  for (let k = 0; k <= 20; k++) {
    const L = luminance(sequential(k / 20));
    assert.ok(L > last, `step ${k}`);
    last = L;
  }
});

test('pressure coefficient is zero in the free stream and 1 at a stagnation density', () => {
  const U = 0.1;
  assert.equal(pressureCoefficient(1, U), 0);
  assert.ok(Math.abs(pressureCoefficient(1 + 1.5 * U * U, U) - 1) < 1e-12);
  assert.ok(Math.abs(fieldScale('curl', 0.1, 20) - 0.0125) < 1e-12);
});

test('painting the field marks the obstacle and walls in their own colours', () => {
  const sim = createSim(clampSettings({ width: 200 }));
  paintWalls(sim, 150, 10, 1, true);
  const px = new Uint8ClampedArray(4 * sim.lat.n);
  for (const view of ['curl', 'speed', 'pressure']) {
    paintField(sim, view, px, new Float32Array(sim.lat.n));
    const at = (c) => Array.from(px.slice(4 * c, 4 * c + 3));
    assert.deepEqual(at(40 * 200 + 50), OBSTACLE);
    assert.deepEqual(at(10 * 200 + 150), WALL);
    assert.equal(px[4 * 7 + 3], 255);
  }
  // The free stream has no vorticity, so the curl view is pale there.
  paintField(sim, 'curl', px, new Float32Array(sim.lat.n));
  assert.ok(luminance(Array.from(px.slice(4 * 5, 4 * 5 + 3))) > 0.85);
});
