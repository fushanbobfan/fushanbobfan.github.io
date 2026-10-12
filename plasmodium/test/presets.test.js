import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, DEFAULT_PRESET, presetSettings } from '../src/presets.js';
import { createSim, stepSim, DEFAULTS } from '../src/sim.js';
import { FOOD_LAYOUTS, placeFoodLayout } from '../src/food.js';
import { LAYOUTS } from '../src/spawn.js';
import { analyse } from '../src/network.js';

function run(name) {
  const sim = createSim(presetSettings(name));
  const { width, height } = sim.settings;
  sim.foods.push(...placeFoodLayout(PRESETS[name].food, width, height));
  return sim;
}

function coverageAt(sim, step) {
  stepSim(sim, step - sim.steps);
  return analyse(sim.trail, sim.foods, sim.settings.wrap);
}

test('every preset names a known layout and food layout', () => {
  assert.ok(PRESETS[DEFAULT_PRESET]);
  for (const [name, p] of Object.entries(PRESETS)) {
    assert.ok(p.label && p.note, name);
    assert.ok(FOOD_LAYOUTS[p.food], name);
    assert.ok(LAYOUTS[presetSettings(name).layout], name);
  }
});

test('preset settings start from the defaults', () => {
  const s = presetSettings('threads');
  assert.equal(s.decay, DEFAULTS.decay);
  assert.equal(s.sensorDistance, 3);
  assert.deepEqual(presetSettings('missing'), presetSettings(DEFAULT_PRESET));
});

test("reference: the mesh coarsens and tube cover falls by more than half", () => {
  const sim = run('reference');
  const early = coverageAt(sim, 50).coverage;
  const later = coverageAt(sim, 400).coverage;
  assert.ok(later < early / 2, `${early} -> ${later}`);
});

test('oats: one network runs through all five food sources', () => {
  const r = coverageAt(run('oats'), 600);
  assert.equal(r.foodTotal, 5);
  assert.equal(r.foodLinked, 5);
});

test('lattice: keeps clearly more of the dish covered than the reference', () => {
  const lattice = coverageAt(run('lattice'), 600).coverage;
  const reference = coverageAt(run('reference'), 600).coverage;
  assert.ok(lattice > reference * 1.2, `${lattice} vs ${reference}`);
});

test('spots: many separate clumps, none of them large', () => {
  const r = coverageAt(run('spots'), 800);
  assert.ok(r.pieces >= 8, `${r.pieces} pieces`);
  assert.ok(r.largest < 0.06, `largest ${r.largest}`);
});
