import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGas } from '../src/gas.js';
import { speedHistogram } from '../src/stats.js';
import {
  speedColour, boxView, histogramGeometry, seriesGeometry, niceStep, drawGas, drawHistogram,
  msdGeometry, drawMsd,
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
  assert.equal(speedColour(0, 1), 'rgb(47 111 208)');
  assert.equal(speedColour(1.25, 1), 'rgb(176 172 166)');
  assert.equal(speedColour(2.5, 1), 'rgb(232 89 12)');
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

test('the MSD panel maps a power law to a straight line', () => {
  const pts = [1, 10, 100].map((tau) => ({ tau, msd: 3 * tau * tau }));
  const g = msdGeometry(pts, 1, 2, null, 240, 132);
  const [a, b, c] = g.dots;
  // Equal steps in log tau and equal steps in log msd: collinear and evenly spaced.
  assert.ok(Math.abs((b[0] - a[0]) - (c[0] - b[0])) < 1e-9);
  assert.ok(Math.abs((b[1] - a[1]) - (c[1] - b[1])) < 1e-9);
  assert.equal(a[0], g.pad.l);
  assert.equal(c[0], g.pad.l + g.pw);
  assert.equal(g.diffusive.length, 0);
  assert.ok(g.ballistic.length > 10);
  const withFit = msdGeometry(pts, 1, 2, { D: 1, b: 0 }, 240, 132);
  assert.ok(withFit.diffusive.length > 10);
  assert.equal(msdGeometry(pts.slice(0, 1), 1, 2, null, 240, 132), null);
});

test('drawing the MSD panel draws one dot per point', () => {
  const pts = [1, 2, 5, 10].map((tau) => ({ tau, msd: tau }));
  const ctx = recorder();
  drawMsd(ctx, msdGeometry(pts, 1, 1, { D: 0.25, b: 0 }, 240, 132), { ...THEME, muted: '#999' });
  assert.equal(ctx.calls.filter((c) => c[0] === 'arc').length, 4);
});

test('MSD lines stay inside the panel and the fit starts at its onset', () => {
  const pts = [1, 10, 100, 1000].map((tau) => ({ tau, msd: tau }));
  const g = msdGeometry(pts, 1, 1, { D: 0.25, b: 0, from: 100 }, 240, 132);
  for (const [, y] of [...g.ballistic, ...g.diffusive]) {
    assert.ok(y >= g.pad.t - 1e-9 && y <= g.pad.t + g.ph + 1e-9);
  }
  // The ballistic tau^2 line leaves through the top long before tau = 1000.
  assert.ok(g.ballistic[g.ballistic.length - 1][0] < g.pad.l + g.pw);
  const startX = g.pad.l + ((2 - 0) / 3) * g.pw;
  assert.ok(Math.abs(g.diffusive[0][0] - startX) < 1e-9);
});

test('the partition is drawn as two segments and species get their own colours', async () => {
  const { SPECIES_COLOURS, drawLines } = await import('../src/render.js');
  const gas = createGas({ n: 10, mixture: { ratio: 4, fraction: 0.5 }, layout: 'left', seed: 2 });
  gas.partition = { x: 50, hole: 10 };
  const ctx = recorder();
  const fills = [];
  const proxy = new Proxy(ctx, {
    set(target, key, value) { if (key === 'fillStyle') fills.push(value); target[key] = value; return true; },
    get(target, key) { return target[key]; },
  });
  drawGas(proxy, gas, boxView(gas, 300, 300), { colouring: 'species', vmp: 1, theme: THEME, trail: null });
  // The box outline uses strokeRect; the partition adds two moveTo/lineTo pairs.
  assert.equal(ctx.calls.filter((c) => c[0] === 'moveTo').length, 2);
  assert.ok(fills.includes(SPECIES_COLOURS[0]) && fills.includes(SPECIES_COLOURS[1]));
  const lctx = recorder();
  drawLines(lctx, [{ points: [[0, 0], [1, 1], [2, 0]], colour: 'red' }, { points: [[0, 0]], colour: 'blue' }]);
  assert.equal(lctx.calls.filter((c) => c[0] === 'lineTo').length, 2);
});
