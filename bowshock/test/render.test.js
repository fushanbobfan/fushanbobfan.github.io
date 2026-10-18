import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeView, toScreen, toWorld, tint, coneEdges, ratioToY, COLOURS } from '../src/render.js';
import { machAngle } from '../src/doppler.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('the view fits the world and maps back and forth', () => {
  const world = { width: 160, height: 100 };
  const v = makeView(800, 800, world);
  close(v.scale, 5);
  close(v.ox, 0);
  close(v.oy, 150);
  const [px, py] = toScreen(v, 40, 30);
  const [x, y] = toWorld(v, px, py);
  close(x, 40);
  close(y, 30);
});

test('unshifted sound is the plain crest colour; shifts saturate', () => {
  assert.deepEqual(tint(1), [201, 210, 227]);
  assert.deepEqual(tint(4), COLOURS.high);
  assert.deepEqual(tint(0.2), COLOURS.low);
  assert.deepEqual(tint(-2), COLOURS.reversed);
  const mid = tint(1.5);
  assert.ok(mid[2] > 227 && mid[0] < 201);
});

test('cone edges trail the source at the Mach angle on either side', () => {
  const src = { x: 0, y: 0, vx: 50, vy: 0 };
  assert.equal(coneEdges(src, 0.9, 10), null);
  const [a, b] = coneEdges(src, 2, 10);
  const mu = machAngle(2);
  for (const e of [a, b]) {
    close(Math.hypot(e.x, e.y), 10);
    close(Math.atan2(Math.abs(e.y), -e.x), mu);
  }
  assert.ok(a.y * b.y < 0);
});

test('the pitch axis is logarithmic and centred on the emitted tone', () => {
  close(ratioToY(1, 0, 100), 50);
  close(ratioToY(2, 0, 100), 25);
  close(ratioToY(0.5, 0, 100), 75);
  close(ratioToY(100, 0, 100), 0);
  close(ratioToY(-2, 0, 100), 25);
});
