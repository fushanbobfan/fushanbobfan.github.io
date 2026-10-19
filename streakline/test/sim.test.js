import test from 'node:test';
import assert from 'node:assert/strict';
import { clampSettings } from '../src/settings.js';
import { createSim, configure, step, paintWalls, flowTime, healthy } from '../src/sim.js';
import { totals } from '../src/lattice.js';

test('the obstacle sits a quarter of the way along, centred across the tunnel', () => {
  const sim = createSim(clampSettings({ width: 200 }));
  assert.equal(sim.ny, 80);
  const { lat } = sim;
  assert.ok(lat.solid[Math.round(39.5) * 200 + 50]);
  assert.ok(!lat.solid[40 * 200 + 80]);
  assert.equal(sim.relax.re, 150);
});

test('a short run stays healthy and the steps add up to flow time', () => {
  const sim = createSim(clampSettings({ width: 200 }));
  assert.ok(step(sim, 200));
  assert.equal(sim.steps, 200);
  assert.ok(Math.abs(flowTime(sim) - 1) < 1e-12);
  assert.ok(healthy(sim.lat));
});

test('a blown-up run is caught and restarted from the free stream', () => {
  const sim = createSim(clampSettings({ width: 200 }));
  step(sim, 5);
  sim.lat.f[3 * sim.lat.n + 4000] = NaN;
  assert.equal(step(sim, 1), false);
  assert.equal(sim.restarts, 1);
  assert.equal(sim.steps, 0);
  assert.ok(Number.isFinite(totals(sim.lat).mass));
});

test('painted walls become solid, erasing frees them at rest, and the inlet and outlet columns are left alone', () => {
  const sim = createSim(clampSettings({ width: 200, shape: 'none' }));
  const c = 20 * 200 + 120;
  assert.ok(paintWalls(sim, 120, 20, 3, true));
  assert.equal(sim.lat.solid[c], 1);
  for (let i = 0; i < 9; i++) assert.equal(sim.lat.f[i * sim.lat.n + c], 0);
  assert.equal(paintWalls(sim, 120, 20, 3, true), false);
  paintWalls(sim, 0, 40, 2, true);
  assert.equal(sim.lat.solid[40 * 200], 0);
  paintWalls(sim, 199, 40, 2, true);
  assert.equal(sim.lat.solid[40 * 200 + 198], 0);
  assert.equal(sim.lat.solid[40 * 200 + 197], 1);
  assert.ok(paintWalls(sim, 120, 20, 3, false));
  assert.equal(sim.lat.solid[c], 0);
  assert.ok(Math.abs(sim.lat.f[c] - 4 / 9) < 1e-6);
});

test('changing the shape without restarting keeps painted walls and the flow', () => {
  const sim = createSim(clampSettings({ width: 200 }));
  paintWalls(sim, 150, 10, 2, true);
  step(sim, 20);
  configure(sim, clampSettings({ width: 200, shape: 'square' }), { restart: false });
  assert.equal(sim.steps, 20);
  assert.equal(sim.lat.solid[10 * 200 + 150], 1);
  assert.ok(step(sim, 20));
});

test('a run records drag and lift every few steps and resets clear them', async () => {
  const { SAMPLE_EVERY, wakeReport, reset } = await import('../src/sim.js');
  const sim = createSim(clampSettings({ width: 200 }));
  step(sim, 400);
  assert.equal(sim.history.count, 400 / SAMPLE_EVERY);
  const r = wakeReport(sim);
  assert.ok(r.cd > 0, `drag ${r.cd}`);
  assert.equal(r.settling, true);
  reset(sim);
  assert.equal(sim.history.count, 0);
});

test('with no obstacle there are no links and nothing is recorded', () => {
  const sim = createSim(clampSettings({ width: 200, shape: 'none' }));
  step(sim, 50);
  assert.equal(sim.links.length, 0);
  assert.equal(sim.history.count, 0);
});
