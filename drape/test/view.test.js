import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fit, toWorld, toScreen, strainBucket, PALETTE } from '../src/view.js';
import { WORLD } from '../src/presets.js';

test('the world fits the canvas and round-trips through screen space', () => {
  const v = fit(WORLD, 900, 500);
  assert.ok(WORLD.width * v.scale <= 900 && WORLD.height * v.scale <= 500);
  const [sx, sy] = toScreen(v, 1.3, 0.7);
  const [x, y] = toWorld(v, sx, sy);
  assert.ok(Math.abs(x - 1.3) < 1e-12 && Math.abs(y - 0.7) < 1e-12);
  const [cx, cy] = toScreen(v, WORLD.width / 2, WORLD.height / 2);
  assert.ok(Math.abs(cx - 450) < 1e-9 && Math.abs(cy - 250) < 1e-9, 'centred');
});

test('strain buckets run from slack to the tearing point', () => {
  assert.equal(strainBucket(-0.2, 1.6), 0);
  assert.equal(strainBucket(0, 1.6), 0);
  assert.equal(strainBucket(0.04, 1.6), 2, 'a quarter of the way up the square-root scale');
  assert.equal(strainBucket(0.16, 1.6), 4);
  assert.equal(strainBucket(0.6, 1.6), PALETTE.length - 1);
  assert.equal(strainBucket(5, 1.6), PALETTE.length - 1);
  assert.equal(strainBucket(0.13, Infinity), 4, 'unbreakable cloth uses a 50% scale');
});
