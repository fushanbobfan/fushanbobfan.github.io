import { test } from 'node:test';
import assert from 'node:assert/strict';
import { threshold, labelTubes, analyse } from '../src/network.js';
import { createTrail } from '../src/trail.js';
import { createSim, stepSim } from '../src/sim.js';
import { placeFoodLayout } from '../src/food.js';

function paint(trail, cells, v = 10) {
  for (const [x, y] of cells) trail.data[y * trail.width + x] = v;
}

test('the threshold scales the mean trail', () => {
  const t = createTrail(4, 1);
  t.data.set([0, 2, 4, 6]);
  assert.equal(threshold(t, 1), 3);
  assert.equal(threshold(t, 2), 6);
});

test('touching cells share a label and diagonal ones do not', () => {
  const t = createTrail(6, 6);
  paint(t, [[0, 0], [1, 0], [1, 1], [3, 3], [4, 4]]);
  const { labels, sizes, count } = labelTubes(t, 1, false);
  assert.equal(count, 3);
  assert.deepEqual(sizes.slice(1).sort(), [1, 1, 3]);
  assert.equal(labels[0], labels[7]);
  assert.notEqual(labels[3 * 6 + 3], labels[4 * 6 + 4]);
});

test('a wrapping world joins pieces across the edge', () => {
  const t = createTrail(6, 3);
  paint(t, [[0, 1], [5, 1]]);
  assert.equal(labelTubes(t, 1, false).count, 2);
  assert.equal(labelTubes(t, 1, true).count, 1);
});

test('food on one tube counts as linked', () => {
  const t = createTrail(10, 5);
  paint(t, [[1, 2], [2, 2], [3, 2], [4, 2], [8, 2]]);
  const foods = [{ x: 1, y: 2 }, { x: 4, y: 2 }, { x: 8, y: 2 }, { x: 6, y: 0 }];
  const r = analyse(t, foods, false, 1);
  assert.equal(r.foodLinked, 2);
  assert.equal(r.foodTotal, 4);
  assert.equal(r.pieces, 2);
  assert.ok(Math.abs(r.coverage - 5 / 50) < 1e-9);
  assert.ok(Math.abs(r.largest - 4 / 50) < 1e-9);
});

test('an empty trail has no network', () => {
  const r = analyse(createTrail(8, 8), [], true);
  assert.equal(r.pieces, 0);
  assert.equal(r.coverage, 0);
  assert.equal(r.foodLinked, 0);
});

test('in a closed dish, particles grow one network that links all five food sources', () => {
  const sim = createSim({
    width: 200, height: 150, population: 4000, seed: 1, wrap: false,
    sensorAngle: 45, turnAngle: 22.5, sensorDistance: 15, foodStrength: 20,
  });
  sim.foods.push(...placeFoodLayout('pentagon', 200, 150));
  stepSim(sim, 1000);
  const r = analyse(sim.trail, sim.foods, false);
  assert.equal(r.foodLinked, 5);
});
