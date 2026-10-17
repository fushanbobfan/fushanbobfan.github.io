import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGas } from '../src/gas.js';
import { speedHistogram } from '../src/stats.js';
import {
  speedColour, boxView, histogramGeometry, seriesGeometry, niceStep, drawGas, drawHistogram,
} from '../src/render.js';

function recorder() {
  const calls = [];
  return new Proxy({ calls, canvas: { width: 300, height: 200 } }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => calls.push([key, ...args]);
    },
    set(target, key, value) { target[key] = value; return true; },
  });
}

const THEME = { box: '#fff', wall: '#000', trail: '#888', disk: '#36c', ink: '#111', bar: '#ccc', curve: '#c33', axis: '#555' };

test('slow disks are blue, fast disks orange, and the scale saturates', () => {
  assert.equal(speedColour(0, 1), 'hsl(215 80% 52%)');
  assert.equal(speedColour(2.5, 1), 'hsl(25 80% 60%)');
  assert.equal(speedColour(99, 1), speedColour(2.5, 1));
});

test('the box view keeps the aspect ratio and centres the box', () => {
  const gas = { width: 100, height: 50 };
  const v = boxView(gas, 416, 416, 8);
  assert.equal(v.scale, 4);
  assert.equal(v.ox, 8);
  assert.equal(v.oy, 108);
});

test('histogram bars are densities on the Maxwell curve axis', () => {
  const gas = createGas({ n: 300, seed: 4 });
  const hist = speedHistogram(gas, 10, 4);
  const g = histogramGeometry(hist, 1, 1, 300, 200);
  assert.equal(g.bars.length, 10);
  // Total bar area in data units is one.
  const area = g.bars.reduce((s, b) => s + (b.w / g.sx) * (b.h / g.sy), 0);
  assert.ok(Math.abs(area - 1) < 1e-9);
  assert.equal(g.curve[0][1], g.pad.t + g.ph);
  assert.ok(g.yMax >= Math.max(...g.bars.map((b) => b.h / g.sy)));
});

test('series points span the panel and clamp to the range', () => {
  const pts = seriesGeometry([0, 5, 20], 0, 10, 142, 128);
  assert.deepEqual(pts[0], [34, 110]);
  assert.deepEqual(pts[2], [134, 10]);
});

test('tick steps are 1, 2 or 5 times a power of ten', () => {
  assert.equal(niceStep(0.8), 1);
  assert.equal(niceStep(0.23), 0.2);
  assert.equal(niceStep(4), 5);
});

test('drawing a gas draws every disk and the traced path', () => {
  const gas = createGas({ n: 20, seed: 1 });
  const ctx = recorder();
  drawGas(ctx, gas, boxView(gas, 300, 300), { colouring: 'speed', vmp: 1, theme: THEME, trail: [[1, 1], [2, 2], [3, 1]] });
  assert.equal(ctx.calls.filter((c) => c[0] === 'arc').length, 21);
  assert.equal(ctx.calls.filter((c) => c[0] === 'lineTo').length, 2);
  const hctx = recorder();
  const hist = speedHistogram(gas, 8, 4);
  drawHistogram(hctx, histogramGeometry(hist, 1, 1, 300, 200), hist, THEME);
  assert.equal(hctx.calls.filter((c) => c[0] === 'fillRect').length, 8);
});
