import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, LINE_MARGIN, circleRadius, pathAt, steer } from '../src/path.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('the straight line crosses the middle at the set speed and wraps past the margin', () => {
  const a = pathAt('line', 0, 10);
  const b = pathAt('line', 1, 10);
  close(b.x - a.x, 10);
  close(a.y, WORLD.height / 2);
  assert.equal(a.vx, 10);
  const span = WORLD.width + 2 * LINE_MARGIN;
  const later = pathAt('line', span / 10, 10);
  close(later.x, a.x, 1e-6);
  assert.equal(later.lap, a.lap + 1);
  for (let t = 0; t < 60; t += 0.37) {
    const p = pathAt('line', t, 10);
    assert.ok(p.x >= -LINE_MARGIN && p.x < WORLD.width + LINE_MARGIN);
  }
});

test('a line source at rest stays on screen', () => {
  const p = pathAt('line', 5, 0);
  assert.ok(p.x > 0 && p.x < WORLD.width);
});

test('the circle keeps its radius and its speed, with velocity along the tangent', () => {
  const r = circleRadius();
  for (const t of [0, 0.7, 3.1, 9]) {
    const p = pathAt('circle', t, 12);
    close(Math.hypot(p.x - WORLD.width / 2, p.y - WORLD.height / 2), r);
    close(Math.hypot(p.vx, p.vy), 12);
    close((p.x - WORLD.width / 2) * p.vx + (p.y - WORLD.height / 2) * p.vy, 0, 1e-7);
  }
});

test('the circle velocity matches the change in position', () => {
  const h = 1e-5;
  const p = pathAt('circle', 2, 15);
  const q = pathAt('circle', 2 + h, 15);
  close((q.x - p.x) / h, p.vx, 1e-3);
  close((q.y - p.y) / h, p.vy, 1e-3);
});

test('steering heads for the target and respects the speed cap', () => {
  const s = steer({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.1, 20);
  close(Math.hypot(s.vx, s.vy), 20);
  close(s.x, 2);
  const near = steer({ x: 0, y: 0 }, { x: 1, y: 1 }, 0.1, 20);
  close(near.vx, 4);
  close(near.vy, 4);
});
