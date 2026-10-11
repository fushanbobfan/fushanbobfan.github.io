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

test('hex centres round back to their own cell, and the six neighbours sit one unit away', async () => {
  const { worldCentre, hexRound, HEX_H } = await import('../src/render.js');
  const { HEX_DX, HEX_DY } = await import('../src/colony.js');
  for (let r = -5; r <= 5; r++) {
    for (let q = -5; q <= 5; q++) {
      const { wx, wy } = worldCentre('hex', q, r);
      assert.deepEqual(hexRound(wx, wy), { x: q, y: r });
      // A point just inside the cell's inscribed circle still belongs to it.
      for (let k = 0; k < 12; k++) {
        const t = (k * Math.PI) / 6;
        assert.deepEqual(hexRound(wx + 0.45 * HEX_H * Math.cos(t) * 1.1, wy + 0.45 * Math.sin(t)), { x: q, y: r });
      }
    }
  }
  const o = worldCentre('hex', 0, 0);
  for (let d = 0; d < 6; d++) {
    const n = worldCentre('hex', HEX_DX[d], HEX_DY[d]);
    assert.ok(Math.abs(Math.hypot(n.wx - o.wx, n.wy - o.wy) - 1) < 1e-12);
    // Directions run clockwise on screen (y down) in steps of 60°.
    const angle = (Math.atan2(n.wy - o.wy, n.wx - o.wx) * 180) / Math.PI;
    assert.ok(Math.abs(((angle - 60 * d + 540) % 360) - 180) < 1e-9, `direction ${d} at ${angle}°`);
  }
});

test('hex views fit, map clicks to cells and paint hexagons', async () => {
  const { fitView: fit, cellAt: at, cellCentre: centre, paintPixels: paint } = await import('../src/render.js');
  const box = { minX: -3, maxX: 3, minY: -3, maxY: 3 };
  const v = fit(box, 300, 300, 0.1, 'hex');
  for (const [q, r] of [[0, 0], [3, -3], [-3, 3], [2, 1]]) {
    const { px, py } = centre(v, 300, 300, q, r, 'hex');
    assert.ok(px > 0 && px < 300 && py > 0 && py < 300, `${q},${r} on canvas`);
    assert.deepEqual(at(v, 300, 300, px, py, 'hex'), { x: q, y: r });
  }
  const g = new Grid(16);
  g.set(1, 0, 1);
  const out = new Uint32Array(300 * 300);
  paint(out, 300, 300, g, v, [5, 6], 99, 'hex');
  const { px, py } = centre(v, 300, 300, 1, 0, 'hex');
  assert.equal(out[Math.round(py) * 300 + Math.round(px)], 6);
  assert.ok(!out.includes(99), 'no square grid lines on hexagons');
  const painted = out.filter((c) => c === 6).length;
  const hexArea = (Math.sqrt(3) / 2) * v.scale * v.scale;
  assert.ok(Math.abs(painted / hexArea - 1) < 0.05, `one hexagon of pixels (${painted} vs ${hexArea})`);
});
