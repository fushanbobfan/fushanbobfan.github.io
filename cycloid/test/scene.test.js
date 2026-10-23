import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, B_LIMITS, fit, clampB, sketchPath } from '../src/scene.js';
import { cycloidDepth } from '../src/curves.js';

const close = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('fit keeps the whole stage visible and round-trips', () => {
  for (const [w, h] of [[900, 600], [400, 700], [1600, 500]]) {
    const v = fit(w, h);
    const [ax, ay] = v.toScreen(WORLD.x0, WORLD.y0);
    const [bx, by] = v.toScreen(WORLD.x1, WORLD.y1);
    assert.ok(ax >= -1e-9 && ay >= -1e-9 && bx <= w + 1e-9 && by <= h + 1e-9);
    const [x, y] = v.toWorld(...v.toScreen(1.3, 0.7));
    close(x, 1.3, 1e-12);
    close(y, 0.7, 1e-12);
  }
});

test('clampB keeps B inside its limits', () => {
  assert.deepEqual(clampB(-3, 9), [B_LIMITS.xMin, B_LIMITS.yMax]);
  assert.deepEqual(clampB(2, 1), [2, 1]);
});

test('for every allowed B the cycloid stays on the stage', () => {
  for (let i = 0; i <= 40; i++) {
    for (let j = 0; j <= 40; j++) {
      const bx = B_LIMITS.xMin + ((B_LIMITS.xMax - B_LIMITS.xMin) * i) / 40;
      const by = B_LIMITS.yMin + ((B_LIMITS.yMax - B_LIMITS.yMin) * j) / 40;
      assert.ok(cycloidDepth(bx, by) < WORLD.y1, `B=(${bx},${by})`);
    }
  }
});

test('sketchPath runs from A through the stroke to B, dropping crowded points', () => {
  const p = sketchPath([0.001, 0.001, 0.5, 1, 0.505, 1.001, 1, 1.5, 1.99, 1], 2, 1);
  assert.deepEqual(Array.from(p), [0, 0, 0.5, 1, 1, 1.5, 2, 1]);
});

test('an empty stroke is the straight ramp', () => {
  assert.deepEqual(Array.from(sketchPath([], 2, 1)), [0, 0, 2, 1]);
});
