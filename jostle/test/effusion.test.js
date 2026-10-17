import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGas } from '../src/gas.js';
import { step, createGrid, safeStep } from '../src/physics.js';
import {
  effusionRate, grahamRatio, effectiveGap, createEffusion, sideCounts, updateEffusion, measuredFlux,
  meanFreePath,
} from '../src/effusion.js';

test('the effusion rate is the one-dimensional Maxwell flux', () => {
  assert.ok(Math.abs(effusionRate(2, 3, 1, 1) - 6 / Math.sqrt(2 * Math.PI)) < 1e-12);
  assert.equal(grahamRatio(1, 4), 2);
  assert.equal(effectiveGap(10, 1), 8);
  assert.equal(effectiveGap(1, 1), 0);
});

test('crossings are counted per species and direction', () => {
  const gas = createGas({ n: 3, radius: 1, seed: 1 });
  gas.species[1] = 1;
  gas.partition = { x: 50, hole: 20 };
  gas.x[0] = 40; gas.x[1] = 40; gas.x[2] = 60;
  const eff = createEffusion(gas);
  gas.x[0] = 60; gas.x[1] = 60; gas.x[2] = 40;
  updateEffusion(gas, eff, 1);
  assert.deepEqual(eff.lr, [1, 1]);
  assert.deepEqual(eff.rl, [1, 0]);
  assert.deepEqual(sideCounts(gas, eff), [[1, 0], [1, 1]]);
  assert.equal(eff.exposureLeft[0], 1 / 5000);
  assert.equal(eff.exposureRight[1], 1 / 5000);
});

test('the mean free path shrinks with density and size', () => {
  assert.ok(Math.abs(meanFreePath(0.1, 2) - 1 / (Math.SQRT2 * 0.2)) < 1e-12);
  assert.equal(meanFreePath(0, 1), Infinity);
});

test('a dilute mixture leaks through the hole at the Maxwell rate, light disks faster', () => {
  const gas = createGas({
    n: 300, radius: 0.5, layout: 'left', mixture: { ratio: 4, fraction: 0.5 }, seed: 31,
  });
  gas.partition = { x: 50, hole: 8 };
  const grid = createGrid(gas);
  const eff = createEffusion(gas);
  const dt = safeStep(gas, 0.25);
  while (gas.time < 1500) {
    step(gas, dt, grid);
    updateEffusion(gas, eff, dt);
  }
  const gap = effectiveGap(8, 0.5);
  const light = measuredFlux(eff, 0, gap);
  const heavy = measuredFlux(eff, 1, gap);
  const theoryLight = Math.sqrt(1 / (2 * Math.PI));
  assert.ok(Math.abs(light / theoryLight - 1) < 0.2, `light ${light} vs ${theoryLight}`);
  assert.ok(Math.abs(light / heavy / grahamRatio(1, 4) - 1) < 0.25, `ratio ${light / heavy}`);
});
