import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../src/grid.js';
import {
  oklchToRgb, makePalette, packRgb, fitView, cellAt, cellCentre, paintPixels, SCHEMES, MAX_SCALE,
} from '../src/render.js';

test('OKLCH conversion hits white, black and a known red', () => {
  assert.deepEqual(oklchToRgb(1, 0, 0), [255, 255, 255]);
  assert.deepEqual(oklchToRgb(0, 0, 0), [0, 0, 0]);
  // CSS oklch(0.628 0.2577 29.23) is #ff0000.
  const [r, g, b] = oklchToRgb(0.628, 0.2577, 29.23);
  assert.ok(r >= 254 && g <= 2 && b <= 2, `${r} ${g} ${b}`);
});

test('palettes start with the background and keep colours apart', () => {
  for (const scheme of ['light', 'dark']) {
    assert.deepEqual(makePalette(2, scheme), [SCHEMES[scheme].background, SCHEMES[scheme].ink]);
    const p = makePalette(12, scheme);
    assert.equal(p.length, 12);
    assert.deepEqual(p[0], SCHEMES[scheme].background);
    for (let i = 1; i < 12; i++) {
      for (let j = i + 1; j < 12; j++) {
        const d = Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1], p[i][2] - p[j][2]);
        assert.ok(d > 20, `${scheme} ${i} ${j} too close`);
      }
    }
  }
});

test('packing follows the ImageData byte order', () => {
  const buf = new Uint32Array([packRgb([1, 2, 3])]);
  assert.deepEqual([...new Uint8Array(buf.buffer)], [1, 2, 3, 255]);
});

test('a fitted view frames the box and maps pixels to cells and back', () => {
  const box = { minX: -10, maxX: 9, minY: -5, maxY: 4 };
  const v = fitView(box, 400, 400, 0);
  assert.equal(v.scale, 20);
  assert.deepEqual([v.cx, v.cy], [0, 0]);
  assert.deepEqual(cellAt(v, 400, 400, 0, 200), { x: -10, y: 0 });
  assert.deepEqual(cellAt(v, 400, 400, 399, 199), { x: 9, y: -1 });
  const { px, py } = cellCentre(v, 400, 400, 3, -2);
  assert.deepEqual(cellAt(v, 400, 400, px, py), { x: 3, y: -2 });
  assert.equal(fitView({ minX: 0, maxX: 0, minY: 0, maxY: 0 }, 400, 400).scale, MAX_SCALE);
});

test('painting samples cells, pads off-grid with the background and draws lines when zoomed', () => {
  const g = new Grid(8);
  g.set(0, 0, 1);
  g.set(-1, 0, 2);
  const pal = [10, 11, 12];
  const out = new Uint32Array(4 * 2);
  paintPixels(out, 4, 2, g, { cx: 0, cy: 0, scale: 1 }, pal);
  // Columns cover cells -2..1, rows cover cells -1..0.
  assert.deepEqual([...out], [10, 10, 10, 10, 10, 12, 11, 10]);

  paintPixels(out, 4, 2, g, { cx: 100, cy: 0, scale: 1 }, pal);
  assert.ok(out.every((v) => v === 10));

  const big = new Uint32Array(16 * 16);
  paintPixels(big, 16, 16, g, { cx: 0, cy: 0, scale: 8 }, pal, 99);
  assert.equal(big[0], 99, 'corner of a cell is a line');
  assert.equal(big[9 * 16 + 9], 11, 'inside cell (0, 0)');
  assert.equal(big[9 * 16 + 4], 12, 'inside cell (-1, 0)');
  paintPixels(big, 16, 16, g, { cx: 0, cy: 0, scale: 4 }, pal, 99);
  assert.ok(!big.includes(99), 'no lines when cells are small');
});
