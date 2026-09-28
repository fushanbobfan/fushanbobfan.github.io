import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid, DIRECTIONS } from '../src/hexgrid.js';
import {
  axialToPixel, pixelToAxial, fitSize, buildPixelMap,
} from '../src/layout.js';

test('every cell centre maps back to its own cell, and so do points near it', () => {
  const size = 7;
  const g = makeGrid(9);
  for (let c = 0; c < g.count; c++) {
    const { x, y } = axialToPixel(g.q[c], g.r[c], size);
    for (const [dx, dy] of [[0, 0], [2, 1], [-3, 2], [1, -3]]) {
      assert.deepEqual(pixelToAxial(x + dx, y + dy, size), [g.q[c], g.r[c]]);
    }
  }
});

test('neighbours sit one hexagon apart and one of them straight above', () => {
  const size = 10;
  const dirs = DIRECTIONS.map(([q, r]) => axialToPixel(q, r, size));
  for (const { x, y } of dirs) assert.ok(Math.abs(Math.hypot(x, y) - size * Math.sqrt(3)) < 1e-9);
  assert.ok(dirs.some(({ x, y }) => Math.abs(x) < 1e-9 && y < 0));
});

test('the patch fits inside the box at the fitted size', () => {
  for (const [w, h, n] of [[800, 600, 50], [300, 900, 20], [1000, 1000, 120]]) {
    const size = fitSize(w, h, n);
    const g = makeGrid(n);
    for (let c = 0; c < g.count; c++) {
      if (!g.boundary[c]) continue;
      const { x, y } = axialToPixel(g.q[c], g.r[c], size);
      assert.ok(Math.abs(x) + size <= w / 2 + 1e-9, `x ${x}`);
      assert.ok(Math.abs(y) + (size * Math.sqrt(3)) / 2 <= h / 2 + 1e-9, `y ${y}`);
    }
  }
});

test('the pixel map covers every cell and leaves the corners outside', () => {
  const g = makeGrid(12);
  const { map, width, height } = buildPixelMap(g, 240, 200);
  const seen = new Set(map);
  for (let c = 0; c < g.count; c++) assert.ok(seen.has(c), `cell ${c} not drawn`);
  assert.equal(map[0], -1);
  assert.equal(map[width * height - 1], -1);
  assert.equal(map[(height / 2) * width + width / 2], g.center);
});
