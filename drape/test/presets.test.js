import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../src/cloth.js';
import { pinCount } from '../src/tools.js';
import { PRESETS, WORLD, buildScene } from '../src/presets.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

for (const name of Object.keys(PRESETS)) {
  test(`${name} starts inside the world and is pinned`, () => {
    const c = buildScene(name);
    assert.ok(pinCount(c) >= 2);
    for (let k = 0; k < c.n; k++) {
      assert.ok(c.x[k] >= 0 && c.x[k] <= WORLD.width, `x ${c.x[k]}`);
      assert.ok(c.y[k] >= 0 && c.y[k] < WORLD.floor, `y ${c.y[k]}`);
    }
  });

  test(`${name} hangs without tearing at the default strength`, () => {
    const c = buildScene(name);
    const p = PRESETS[name];
    for (let s = 0; s < 480; s++) step(c, 1 / 120, { wind: p.wind, tearAt: 1.6, floor: WORLD.floor });
    assert.equal(c.brokenCount, 0);
    for (let k = 0; k < c.n; k++) assert.ok(Number.isFinite(c.x[k]) && Number.isFinite(c.y[k]));
  });
}

test('the curtain hangs gathered: its rings sit closer than the cloth between them', () => {
  const c = buildScene('curtain');
  close(c.x[5] - c.x[0], 5 * c.spacing * PRESETS.curtain.gather, 1e-12);
  for (let s = 0; s < 480; s++) step(c, 1 / 120, { floor: WORLD.floor });
  close(c.x[5] - c.x[0], 5 * c.spacing * PRESETS.curtain.gather, 1e-12, 'rings stay put');
  let wiggle = 0;
  const row = 15 * c.cols;
  for (let i = 0; i < c.cols; i++) wiggle = Math.max(wiggle, Math.abs(c.y[row + i] - c.y[row]));
  assert.ok(wiggle > c.spacing, `a middle row should fold, moved ${wiggle}`);
});

test('an unknown scene is an error', () => {
  assert.throws(() => buildScene('tent'), /unknown scene/);
});
