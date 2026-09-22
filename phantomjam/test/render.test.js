import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  speedRgb,
  speedColor,
  ringGeometry,
  cellAngle,
  cellAtPoint,
  flowAxisMax,
  chartScales,
  SpaceTime,
  EMPTY_RGB,
} from '../src/render.js';

test('speedRgb runs from red at rest to pale yellow at the limit, and clamps', () => {
  assert.deepEqual(speedRgb(0, 5), [230, 57, 70]);
  assert.deepEqual(speedRgb(5, 5), [255, 232, 163]);
  assert.deepEqual(speedRgb(9, 5), speedRgb(5, 5));
  assert.deepEqual(speedRgb(-1, 5), speedRgb(0, 5));
  assert.deepEqual(speedRgb(3, 0), speedRgb(5, 5));
});

test('brightness rises monotonically with speed', () => {
  let last = -1;
  for (let v = 0; v <= 5; v++) {
    const [r, g, b] = speedRgb(v, 5);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    assert.ok(lum > last, `speed ${v}`);
    last = lum;
  }
});

test('speedColor formats a CSS rgb() string', () => {
  assert.equal(speedColor(0, 5), 'rgb(230, 57, 70)');
});

test('ringGeometry centres the ring and keeps it inside the canvas', () => {
  const g = ringGeometry(600, 400, 200);
  assert.equal(g.cx, 300);
  assert.equal(g.cy, 200);
  assert.ok(g.radius + g.laneWidth / 2 <= 200);
  assert.ok(g.laneWidth >= 8);
  const wide = ringGeometry(600, 400, 20);
  assert.ok(wide.laneWidth <= wide.radius * 0.18 + 1e-9);
});

test('cellAngle starts at the top and goes clockwise', () => {
  const cells = 8;
  assert.ok(Math.abs(cellAngle(0, cells) - (-Math.PI / 2 + Math.PI / 8)) < 1e-12);
  const a0 = cellAngle(0, cells);
  const a2 = cellAngle(2, cells);
  assert.ok(Math.abs(a2 - a0 - Math.PI / 2) < 1e-12);
});

test('cellAtPoint inverts cellAngle on the lane and rejects points off it', () => {
  const cells = 120;
  const g = ringGeometry(500, 500, cells);
  for (const cell of [0, 1, 30, 59, 60, 61, 119]) {
    const a = cellAngle(cell, cells);
    const x = g.cx + Math.cos(a) * g.radius;
    const y = g.cy + Math.sin(a) * g.radius;
    assert.equal(cellAtPoint(g, cells, x, y), cell);
  }
  assert.equal(cellAtPoint(g, cells, g.cx, g.cy), -1);
  assert.equal(cellAtPoint(g, cells, 0, 0), -1);
});

test('flowAxisMax rounds the model peak up to a tenth', () => {
  assert.equal(flowAxisMax(5), 0.9);
  assert.equal(flowAxisMax(1), 0.5);
  assert.equal(flowAxisMax(2), 0.7);
});

test('chartScales map density and flow into the padded plot area', () => {
  const s = chartScales(400, 200, 5);
  assert.equal(s.x(0), s.padding.left);
  assert.equal(s.x(1), 400 - s.padding.right);
  assert.equal(s.x(2), s.x(1));
  assert.equal(s.y(0), 200 - s.padding.bottom);
  assert.ok(Math.abs(s.y(s.flowMax) - s.padding.top) < 1e-9);
  assert.ok(s.y(0.3) < s.y(0.1));
  assert.equal(s.y(-1), s.y(0));
});

// A tiny stand-in for a 2D canvas that records rows so SpaceTime can be
// exercised without a browser.
function fakeCanvas(width, height) {
  const canvas = { width, height, rows: [] };
  canvas.getContext = () => ({
    fillStyle: '',
    fillRect() {},
    createImageData: (w) => ({ width: w, height: 1, data: new Uint8ClampedArray(w * 4) }),
    drawImage(src, dx, dy) {
      if (src === canvas && dy === -1 && canvas.rows.length === height) canvas.rows.shift();
    },
    putImageData(img) {
      canvas.rows.push(Array.from(img.data));
    },
  });
  return canvas;
}

test('SpaceTime scrolls rows upward and colours cells by speed', () => {
  const st = new SpaceTime(fakeCanvas, 3, 2);
  st.push(Int8Array.from([-1, 0, 5]), 5);
  assert.equal(st.filled, 1);
  const row = st.canvas.rows.at(-1);
  assert.deepEqual(row.slice(0, 4), [...EMPTY_RGB, 255]);
  assert.deepEqual(row.slice(4, 8), [230, 57, 70, 255]);
  assert.deepEqual(row.slice(8, 12), [255, 232, 163, 255]);
  st.push(Int8Array.from([2, -1, -1]), 5);
  st.push(Int8Array.from([-1, -1, -1]), 5);
  assert.equal(st.filled, 2);
  assert.equal(st.canvas.rows.length, 2);
  assert.deepEqual(st.canvas.rows[0].slice(0, 3), speedRgb(2, 5));
});

test('SpaceTime.reset swaps in a fresh canvas of the new size', () => {
  const st = new SpaceTime(fakeCanvas, 3, 2);
  st.push(Int8Array.from([1, 1, 1]), 5);
  st.reset(5, 4);
  assert.equal(st.cells, 5);
  assert.equal(st.rows, 4);
  assert.equal(st.filled, 0);
  assert.equal(st.canvas.width, 5);
});
