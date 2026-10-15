import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawBifurcation, bifurcationValueAt, niceTicks, groupOf, groupColour, GROUPS, drawOrbit, drawCloud, drawReturnMap, drawSpread, drawAxes, drawEquilibria } from '../src/render.js';
import { SYSTEMS, defaultParams } from '../src/systems.js';
import { sampleOrbit, bounds, successiveMaxima } from '../src/integrate.js';
import { createCamera, fitCamera } from '../src/camera.js';
import { createCloud } from '../src/cloud.js';
import { createSweep } from '../src/bifurcation.js';

// Records the calls a drawing makes and checks every coordinate is finite.
function fakeContext() {
  const calls = {};
  const handler = {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args) => {
        calls[prop] = (calls[prop] || 0) + 1;
        for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a), `${String(prop)} got ${a}`);
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  };
  return { ctx: new Proxy({}, handler), calls };
}

const colours = { panel: '#111', grid: '#333', muted: '#888', accent: '#fa0' };

test('niceTicks rounds out to 1, 2 or 5 times a power of ten', () => {
  assert.deepEqual(niceTicks(0, 9.3, 5), { lo: 0, hi: 10, step: 2, ticks: [0, 2, 4, 6, 8, 10] });
  const t = niceTicks(28.7, 47.9, 4);
  assert.equal(t.step, 5);
  assert.equal(t.lo, 25);
  assert.equal(t.hi, 50);
  assert.deepEqual(niceTicks(3, 3).ticks, [3]);
});

test('orbits are split into colour groups in index order', () => {
  assert.equal(groupOf(0, 400), 0);
  assert.equal(groupOf(399, 400), GROUPS - 1);
  assert.equal(groupOf(0, 1), 0);
  for (let i = 1; i < 400; i++) assert.ok(groupOf(i, 400) >= groupOf(i - 1, 400));
  assert.match(groupColour(3), /^hsl\(\d+ 85% 62%\)$/);
});

test('the attractor view and both charts draw with finite coordinates', () => {
  const s = SYSTEMS.lorenz;
  const p = defaultParams('lorenz');
  const orbit = sampleOrbit(s, p, { transient: 2000, count: 5000 });
  const cam = fitCamera(createCamera(), bounds(orbit.points, orbit.length));
  const cloud = createCloud(s, p, { center: orbit.state, count: 50, tail: 20 });
  for (let k = 0; k < 30; k++) cloud.advance(4);
  const size = { width: 640, height: 480, colour: '#ccc' };
  const { ctx, calls } = fakeContext();
  drawOrbit(ctx, cam, orbit, size);
  drawCloud(ctx, cam, cloud, size);
  drawEquilibria(ctx, cam, s.equilibria(p), size);
  drawAxes(ctx, cam, size);
  assert.equal(calls.lineTo >= orbit.length - 1, true);
  assert.equal(calls.arc, 50);
  const t = drawReturnMap(ctx, successiveMaxima(orbit.points, orbit.length, 2), { width: 300, height: 200, colours, axisName: 'z' });
  assert.ok(t.lo < 35 && t.hi > 45);
  const r = drawSpread(ctx, cloud.history, { width: 300, height: 200, colours, lambda: 0.9, radius: cloud.radius });
  assert.ok(r.hi > r.lo);
});

test('the return map says so when there is nothing to map', () => {
  const { ctx, calls } = fakeContext();
  assert.equal(drawReturnMap(ctx, [1, 2], { width: 300, height: 200, colours, axisName: 'z' }), null);
  assert.equal(calls.fillText, 1);
});

test('the spread chart copes with a shrinking cloud and a negative exponent', () => {
  const { ctx } = fakeContext();
  const history = [];
  for (let k = 0; k <= 50; k++) history.push({ t: k * 0.2, spread: 0.5 * Math.exp(-0.8 * k * 0.2) });
  const r = drawSpread(ctx, history, { width: 300, height: 200, colours, lambda: -0.8, radius: 0.5 });
  const last = Math.log10(history[history.length - 1].spread);
  assert.ok(r.lo <= last && r.hi >= Math.log10(0.5), `axis ${r.lo}..${r.hi} must hold ${last}`);
});

test('the bifurcation diagram draws partial and finished sweeps and maps clicks back to values', () => {
  const sweep = createSweep(SYSTEMS.rossler, defaultParams('rossler'), { key: 'c', from: 2, to: 6, columns: 20, transientTime: 50, sampleTime: 50 });
  const { ctx, calls } = fakeContext();
  drawBifurcation(ctx, sweep, { width: 600, height: 200, colours, current: 5.7, label: 'c', axisName: 'x' });
  sweep.advance(Infinity, 5);
  const before = calls.fillText;
  drawBifurcation(ctx, sweep, { width: 600, height: 200, colours, current: 5.7, label: 'c', axisName: 'x' });
  assert.ok(calls.fillText > before);
  sweep.advance();
  const r = drawBifurcation(ctx, sweep, { width: 600, height: 200, colours, current: 9, label: 'c', axisName: 'x' });
  assert.ok(r.ty.lo < r.ty.hi);
  assert.equal(bifurcationValueAt(sweep, 40, 600), 2);
  assert.equal(bifurcationValueAt(sweep, 592, 600), 6);
  assert.ok(Math.abs(bifurcationValueAt(sweep, 316, 600) - 4) < 1e-9);
  assert.equal(bifurcationValueAt(sweep, 10, 600), null);
});
