import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSICAL, angleGap, curvature, torque } from '../src/machine.js';
import { restPoints, settle } from '../src/equilibria.js';

const m = CLASSICAL;

test('far from the set there is one well, inside the diamond there are two', () => {
  assert.equal(restPoints(m, -3.5, 0).minima.length, 1);
  assert.equal(restPoints(m, 1, 1).minima.length, 1);
  const inside = restPoints(m, -1.9, 0);
  assert.equal(inside.minima.length, 2);
  assert.equal(inside.maxima.length, 2);
});

test('a circle of angles alternates minima and maxima', () => {
  for (const [cx, cy] of [[-1.9, 0.2], [-3, 1], [0, 2], [-2.2, -0.1]]) {
    const { minima, maxima } = restPoints(m, cx, cy);
    assert.equal(minima.length, maxima.length);
  }
});

test('every reported point is an equilibrium of the right kind', () => {
  for (const [cx, cy] of [[-1.9, 0.1], [-2.1, -0.2], [-3, 0.5]]) {
    const { minima, maxima } = restPoints(m, cx, cy);
    for (const p of minima) {
      assert.ok(Math.abs(torque(m, cx, cy, p.theta)) < 1e-10);
      assert.ok(curvature(m, cx, cy, p.theta) > 0);
    }
    for (const p of maxima) {
      assert.ok(Math.abs(torque(m, cx, cy, p.theta)) < 1e-10);
      assert.ok(curvature(m, cx, cy, p.theta) < 0);
    }
  }
});

test('the two wells on the axis are mirror images', () => {
  const [a, b] = restPoints(m, -1.9, 0).minima;
  assert.ok(Math.abs(a.theta + b.theta) < 1e-9);
  assert.ok(Math.abs(a.energy - b.energy) < 1e-12);
});

test('settle rolls into the well on the side it starts', () => {
  const [low, high] = restPoints(m, -1.9, 0).minima.sort((p, q) => p.theta - q.theta);
  assert.ok(Math.abs(settle(m, -1.9, 0, 0.1) - high.theta) < 1e-9);
  assert.ok(Math.abs(settle(m, -1.9, 0, -0.1) - low.theta) < 1e-9);
});

test('settle keeps the winding of the wheel', () => {
  const turned = 2 * Math.PI + 0.1;
  const end = settle(m, -1.9, 0, turned);
  assert.ok(end > Math.PI, `stayed on the second turn: ${end}`);
  assert.ok(Math.abs(angleGap(end, settle(m, -1.9, 0, 0.1))) < 1e-9);
});

test('settle leaves a resting wheel where it is', () => {
  const [p] = restPoints(m, -3, 0.5).minima;
  assert.ok(Math.abs(settle(m, -3, 0.5, p.theta) - p.theta) < 1e-9);
});
