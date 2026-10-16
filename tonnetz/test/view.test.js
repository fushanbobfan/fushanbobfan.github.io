import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createView, worldToScreen, screenToWorld, visibleBox, pan, zoomAt, fitBox, keepInView, SCALE_RANGE } from '../src/view.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('screen and world coordinates invert each other', () => {
  const v = createView(1, -2, 50);
  const s = worldToScreen(v, 800, 600, 3, 4);
  const w = screenToWorld(v, 800, 600, s.x, s.y);
  close(w.x, 3);
  close(w.y, 4);
  const c = worldToScreen(v, 800, 600, 1, -2);
  close(c.x, 400);
  close(c.y, 300);
});

test('the visible box matches the canvas size', () => {
  const b = visibleBox(createView(0, 0, 100), 800, 400);
  assert.deepEqual(b, { x0: -4, x1: 4, y0: -2, y1: 2 });
});

test('dragging moves the lattice with the pointer', () => {
  const v = createView(0, 0, 100);
  const before = worldToScreen(v, 800, 600, 1, 1);
  const after = worldToScreen(pan(v, 30, -20), 800, 600, 1, 1);
  close(after.x - before.x, 30);
  close(after.y - before.y, -20);
});

test('zooming keeps the point under the cursor and respects the range', () => {
  const v = createView(0, 0, 80);
  const p = screenToWorld(v, 800, 600, 650, 120);
  const z = zoomAt(v, 800, 600, 650, 120, 1.5);
  const q = screenToWorld(z, 800, 600, 650, 120);
  close(p.x, q.x);
  close(p.y, q.y);
  assert.equal(zoomAt(v, 800, 600, 0, 0, 100).scale, SCALE_RANGE[1]);
  assert.equal(zoomAt(v, 800, 600, 0, 0, 0.01).scale, SCALE_RANGE[0]);
});

test('fitting a box centres it at the largest scale that fits', () => {
  const v = fitBox({ x0: 0, x1: 8, y0: 0, y1: 2 }, 800, 600);
  assert.equal(v.cx, 4);
  assert.equal(v.cy, 1);
  assert.equal(v.scale, 100);
});

test('keepInView only moves when the point leaves the margin', () => {
  const v = createView(0, 0, 100);
  assert.deepEqual(keepInView(v, 800, 600, 1, 1), v);
  const moved = keepInView(v, 800, 600, 10, 0);
  close(moved.cx, 10 - 4 * 0.7);
  assert.equal(moved.cy, 0);
});
