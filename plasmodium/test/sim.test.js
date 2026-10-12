import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, stepSim, resetSim, retune, normalizeSettings, DEFAULTS } from '../src/sim.js';
import { totalTrail } from '../src/trail.js';

const small = { width: 80, height: 60, population: 800 };

test('settings are clamped and filled from defaults', () => {
  const s = normalizeSettings({ sensorAngle: 500, decay: -1, population: 'lots', width: 50.6 });
  assert.equal(s.sensorAngle, 180);
  assert.equal(s.decay, 0);
  assert.equal(s.population, DEFAULTS.population);
  assert.equal(s.width, 51);
  assert.equal(s.height, DEFAULTS.height);
});

test('a run is reproducible from its seed', () => {
  const a = createSim({ ...small, seed: 7 });
  const b = createSim({ ...small, seed: 7 });
  stepSim(a, 30);
  stepSim(b, 30);
  assert.deepEqual(a.trail.data, b.trail.data);
  assert.deepEqual(a.agents.x, b.agents.x);
});

test('reset returns to step 0 with the same layout', () => {
  const sim = createSim({ ...small, seed: 3 });
  const x0 = Float32Array.from(sim.agents.x);
  stepSim(sim, 10);
  assert.equal(sim.steps, 10);
  resetSim(sim);
  assert.equal(sim.steps, 0);
  assert.equal(totalTrail(sim.trail), 0);
  assert.deepEqual(sim.agents.x, x0);
});

test('without decay the trail grows by exactly what the particles lay', () => {
  const sim = createSim({ ...small, decay: 0, seed: 2 });
  stepSim(sim, 5);
  const expected = 5 * small.population * DEFAULTS.depositAmount;
  assert.ok(Math.abs(totalTrail(sim.trail) - expected) / expected < 1e-5);
});

test('with decay the trail settles to a steady level', () => {
  const sim = createSim({ ...small, seed: 2 });
  stepSim(sim, 200);
  const a = totalTrail(sim.trail);
  stepSim(sim, 20);
  const b = totalTrail(sim.trail);
  // Steady state: lay N*d per step, lose a tenth, so about 9 * N * d remains.
  const steady = small.population * DEFAULTS.depositAmount * (1 - DEFAULTS.decay) / DEFAULTS.decay;
  assert.ok(Math.abs(a - steady) / steady < 0.01);
  assert.ok(Math.abs(b - a) / a < 0.01);
});

test('retuning changes behaviour without restarting', () => {
  const sim = createSim(small);
  stepSim(sim, 4);
  retune(sim, { sensorAngle: 45 });
  assert.equal(sim.steps, 4);
  assert.ok(Math.abs(sim.params.sensorAngle - Math.PI / 4) < 1e-9);
});

test('food sources keep adding attractant every step', () => {
  const sim = createSim({ ...small, population: 0, decay: 0, foodStrength: 2 });
  sim.foods.push({ x: 20, y: 20 }, { x: 50, y: 30 });
  stepSim(sim, 3);
  assert.ok(Math.abs(totalTrail(sim.trail) - 3 * 2 * 13 * 2) < 1e-3);
});
