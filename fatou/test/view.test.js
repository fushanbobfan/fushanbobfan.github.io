import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeView, fitView, toComplex, toPixel, zoomAt, panBy, precisionLimited, suggestedIterations,
} from '../src/view.js';

const W = 640;
const H = 480;

test('toPixel inverts toComplex and the imaginary axis points up', () => {
  const v = makeView(-0.5, 0.25, 0.005);
  const [x, y] = toComplex(v, W, H, 100, 50);
  const [px, py] = toPixel(v, W, H, x, y);
  assert.ok(Math.abs(px - 100) < 1e-9 && Math.abs(py - 50) < 1e-9);
  const [, top] = toComplex(v, W, H, W / 2, 0);
  const [, bottom] = toComplex(v, W, H, W / 2, H);
  assert.ok(top > bottom);
  assert.deepEqual(toComplex(v, W, H, W / 2, H / 2), [-0.5, 0.25]);
});

test('fitView shows the whole rectangle', () => {
  const v = fitView(-2.5, 1, -1.25, 1.25, W, H);
  const [x0, y0] = toComplex(v, W, H, 0, 0);
  const [x1, y1] = toComplex(v, W, H, W, H);
  assert.ok(x0 <= -2.5 + 1e-12 && x1 >= 1 - 1e-12);
  assert.ok(y0 >= 1.25 - 1e-12 && y1 <= -1.25 + 1e-12);
});

test('zoomAt keeps the point under the cursor fixed', () => {
  const v = makeView(-0.5, 0, 0.004);
  const before = toComplex(v, W, H, 400, 120);
  const z = zoomAt(v, W, H, 400, 120, 2.5);
  const after = toComplex(z, W, H, 400, 120);
  assert.ok(Math.abs(before[0] - after[0]) < 1e-15 && Math.abs(before[1] - after[1]) < 1e-15);
  assert.ok(Math.abs(z.scale - 0.004 / 2.5) < 1e-18);
});

test('panBy moves the picture with the pointer', () => {
  const v = makeView(0, 0, 0.01);
  const p = panBy(v, 10, -20);
  // dragging right by 10 px brings points from the left under the pointer
  assert.deepEqual([p.cx, p.cy], [-0.1, -0.2]);
});

test('precision warning appears only deep in', () => {
  assert.ok(!precisionLimited(makeView(-0.75, 0.1, 1e-6)));
  assert.ok(precisionLimited(makeView(-0.75, 0.1, 1e-15)));
});

test('iteration budget grows with magnification and is capped', () => {
  const shallow = suggestedIterations(makeView(0, 0, 3 / W), W);
  const deep = suggestedIterations(makeView(0, 0, 3e-9 / W), W);
  assert.equal(shallow, 200);
  assert.ok(deep > shallow * 10);
  assert.ok(suggestedIterations(makeView(0, 0, 1e-30), W) <= 20000);
});
