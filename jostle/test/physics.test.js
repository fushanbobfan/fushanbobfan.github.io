import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGas, kineticEnergy } from '../src/gas.js';
import { step, collidePair, bounceWalls, safeStep, createGrid } from '../src/physics.js';

function twoDisks({ m1 = 1, m2 = 1, v1 = [1, 0], v2 = [-1, 0], p1 = [49, 50], p2 = [51.2, 50] } = {}) {
  const gas = createGas({ n: 2, radius: 1.2, seed: 1 });
  gas.m[0] = m1; gas.m[1] = m2;
  [gas.x[0], gas.y[0]] = p1; [gas.x[1], gas.y[1]] = p2;
  [gas.vx[0], gas.vy[0]] = v1; [gas.vx[1], gas.vy[1]] = v2;
  return gas;
}

test('equal disks meeting head on swap velocities', () => {
  const gas = twoDisks();
  assert.equal(collidePair(gas, 0, 1, 1), true);
  assert.ok(Math.abs(gas.vx[0] + 1) < 1e-12);
  assert.ok(Math.abs(gas.vx[1] - 1) < 1e-12);
  // Wound back to contact and carried forward: no longer approaching.
  const dx = gas.x[0] - gas.x[1];
  assert.ok(dx * (gas.vx[0] - gas.vx[1]) > 0);
});

test('an oblique collision of unequal masses conserves momentum and energy', () => {
  const gas = twoDisks({ m1: 1, m2: 4, v1: [2, 0.5], v2: [-0.3, 0.1], p2: [51.0, 51.2] });
  const before = kineticEnergy(gas);
  const px = gas.vx[0] + 4 * gas.vx[1];
  const py = gas.vy[0] + 4 * gas.vy[1];
  assert.equal(collidePair(gas, 0, 1, 1), true);
  assert.ok(Math.abs(kineticEnergy(gas) - before) < 1e-12);
  assert.ok(Math.abs(gas.vx[0] + 4 * gas.vx[1] - px) < 1e-12);
  assert.ok(Math.abs(gas.vy[0] + 4 * gas.vy[1] - py) < 1e-12);
});

test('overlapping disks that are already separating are left alone', () => {
  const gas = twoDisks({ v1: [-1, 0], v2: [1, 0] });
  assert.equal(collidePair(gas, 0, 1, 1), false);
  assert.equal(gas.vx[0], -1);
});

test('a wall bounce reverses the normal velocity and reports 2mv', () => {
  const gas = createGas({ n: 1, radius: 1, mass: 3, seed: 1 });
  gas.x[0] = 0.5; gas.vx[0] = -2; gas.vy[0] = 0.7;
  const impulse = bounceWalls(gas, 0);
  assert.equal(gas.vx[0], 2);
  assert.equal(gas.vy[0], 0.7);
  assert.ok(Math.abs(impulse - 12) < 1e-12);
  assert.ok(gas.x[0] >= 1);
});

test('a dense gas keeps its energy and every disk stays in the box', () => {
  const gas = createGas({ n: 500, radius: 1.5, width: 100, height: 100, seed: 4 });
  const grid = createGrid(gas);
  const e0 = kineticEnergy(gas);
  const dt = safeStep(gas, 0.2);
  for (let s = 0; s < 400; s++) step(gas, dt, grid);
  assert.ok(gas.collisions > 1000);
  assert.ok(Math.abs(kineticEnergy(gas) - e0) / e0 < 1e-9);
  for (let i = 0; i < gas.n; i++) {
    assert.ok(gas.x[i] >= gas.r[i] - 1e-6 && gas.x[i] <= gas.width - gas.r[i] + 1e-6);
    assert.ok(gas.y[i] >= gas.r[i] - 1e-6 && gas.y[i] <= gas.height - gas.r[i] + 1e-6);
  }
});

test('overlaps stay a small fraction of a radius', () => {
  const gas = createGas({ n: 600, radius: 1.5, width: 100, height: 100, seed: 8 });
  const grid = createGrid(gas);
  const dt = safeStep(gas, 0.2);
  for (let s = 0; s < 300; s++) step(gas, dt, grid);
  let worst = 0;
  for (let i = 0; i < gas.n; i++) {
    for (let j = i + 1; j < gas.n; j++) {
      const d = Math.hypot(gas.x[i] - gas.x[j], gas.y[i] - gas.y[j]);
      worst = Math.max(worst, gas.r[i] + gas.r[j] - d);
    }
  }
  assert.ok(worst < 0.5 * 1.5, `worst overlap ${worst}`);
});

test('the partition leaves a hole in the middle', async () => {
  const { partitionSegments } = await import('../src/physics.js');
  const gas = createGas({ n: 1, seed: 1 });
  gas.partition = { x: 50, hole: 10 };
  assert.deepEqual(partitionSegments(gas), [[0, 45], [55, 100]]);
  gas.partition.hole = 100;
  assert.deepEqual(partitionSegments(gas), []);
});

test('a disk hitting the partition face bounces straight back', async () => {
  const { bouncePartition } = await import('../src/physics.js');
  const gas = createGas({ n: 1, radius: 1, seed: 1 });
  gas.partition = { x: 50, hole: 10 };
  gas.x[0] = 49.5; gas.y[0] = 20; gas.vx[0] = 2; gas.vy[0] = 0.5;
  const j = bouncePartition(gas, 0);
  assert.equal(gas.vx[0], -2);
  assert.equal(gas.vy[0], 0.5);
  assert.ok(Math.abs(gas.x[0] - 49) < 1e-12);
  assert.ok(Math.abs(j - 4) < 1e-12);
});

test('a disk passing through the hole is not touched, and the rim deflects', async () => {
  const { bouncePartition } = await import('../src/physics.js');
  const gas = createGas({ n: 1, radius: 1, seed: 1 });
  gas.partition = { x: 50, hole: 10 };
  gas.x[0] = 50; gas.y[0] = 50; gas.vx[0] = 1; gas.vy[0] = 0;
  assert.equal(bouncePartition(gas, 0), 0);
  assert.equal(gas.vx[0], 1);
  // Grazing the upper rim at (50, 45): pushed down and out, speed kept.
  gas.x[0] = 49.6; gas.y[0] = 45.6; gas.vx[0] = 1; gas.vy[0] = -1;
  bouncePartition(gas, 0);
  assert.ok(Math.abs(Math.hypot(gas.vx[0], gas.vy[0]) - Math.SQRT2) < 1e-12);
  assert.ok(Math.hypot(gas.x[0] - 50, gas.y[0] - 45) >= 1 - 1e-12);
});

test('with a closed partition no disk changes side', () => {
  const gas = createGas({ n: 300, radius: 1, layout: 'left', seed: 9 });
  gas.partition = { x: 50, hole: 0 };
  const grid = createGrid(gas);
  const dt = safeStep(gas, 0.25);
  const e0 = kineticEnergy(gas);
  for (let s = 0; s < 1500; s++) step(gas, dt, grid);
  for (let i = 0; i < gas.n; i++) assert.ok(gas.x[i] < 50);
  assert.ok(Math.abs(kineticEnergy(gas) - e0) / e0 < 1e-9);
});
