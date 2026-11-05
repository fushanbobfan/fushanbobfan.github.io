import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSICAL, thirdDerivative } from '../src/machine.js';
import { restPoints } from '../src/equilibria.js';
import { findCusps, foldResiduals, traceFoldSet } from '../src/foldset.js';

const m = CLASSICAL;
const chains = traceFoldSet(m);
const cusps = findCusps(m, chains).sort((a, b) => a.x - b.x);

test('the classical machine has one closed curve', () => {
  assert.equal(chains.length, 1);
  assert.ok(chains[0].closed);
});

test('every traced point has zero torque and zero curvature', () => {
  for (const p of chains[0].points) {
    const r = foldResiduals(m, p);
    assert.ok(Math.abs(r.torque) < 1e-9, `torque ${r.torque} at ${p.theta}`);
    assert.ok(Math.abs(r.curvature) < 1e-9, `curvature ${r.curvature} at ${p.theta}`);
  }
});

test('the set has four cusps, like a curved diamond', () => {
  assert.equal(cusps.length, 4);
  const [left, side1, side2, right] = cusps;
  assert.ok(Math.abs(left.y) < 1e-6);
  assert.ok(Math.abs(right.y) < 1e-6);
  assert.ok(Math.abs(side1.x - side2.x) < 1e-6);
  assert.ok(Math.abs(side1.y + side2.y) < 1e-6);
  assert.ok(Math.abs(side1.y) > 0.5);
});

test('the axis cusps match the closed forms of V\'\'(0) = 0 and V\'\'(pi) = 0', () => {
  // Wheel pointing at A, C at -x: x^2 - (7/6) x - 1/3 = 0.
  const near = (7 / 6 + Math.sqrt((7 / 6) ** 2 + 4 / 3)) / 2;
  // Wheel pointing away from A: x^2 - 2.7 x + 0.6 = 0.
  const far = (2.7 + Math.sqrt(2.7 ** 2 - 2.4)) / 2;
  assert.ok(Math.abs(cusps[3].x + near) < 1e-6, `${cusps[3].x} vs ${-near}`);
  assert.ok(Math.abs(cusps[0].x + far) < 1e-6, `${cusps[0].x} vs ${-far}`);
});

test('each cusp is a triple root: the third derivative vanishes too', () => {
  for (const c of cusps) {
    const r = foldResiduals(m, c);
    assert.ok(Math.abs(r.torque) < 1e-6);
    assert.ok(Math.abs(r.curvature) < 1e-6);
    assert.ok(Math.abs(thirdDerivative(m, c.x, c.y, c.theta)) < 1e-5);
  }
});

// The honest test of the set: the number of wells changes where the curve is
// crossed and nowhere else, checked against a brute scan of the energy.
function crossings(points, y) {
  const xs = [];
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    if ((p.y > y) !== (q.y > y)) xs.push(p.x + ((y - p.y) * (q.x - p.x)) / (q.y - p.y));
  }
  return xs.sort((a, b) => a - b);
}

test('the count of wells changes exactly where a horizontal line crosses the set', () => {
  for (const y of [0.05, 0.2, 0.4, -0.3, 0.6]) {
    const xs = crossings(chains[0].points, y);
    let prev = null;
    const changes = [];
    for (let x = -3.5; x < -0.5; x += 0.002) {
      const n = restPoints(m, x, y, 720).minima.length;
      if (prev !== null && n !== prev) changes.push(x);
      prev = n;
    }
    assert.equal(changes.length, xs.length, `y=${y}: ${changes} vs ${xs}`);
    changes.forEach((x, i) => assert.ok(Math.abs(x - xs[i]) < 0.006, `y=${y}: ${x} vs ${xs[i]}`));
  }
});

test('other machines trace to fold points too', () => {
  for (const other of [{ r: 0.5, a: 2.4, l: 0.8, s: 1.6 }, { r: 0.5, a: 1.8, l: 0.7, s: 0.6 }]) {
    const set = traceFoldSet(other);
    assert.ok(set.length >= 1);
    for (const chain of set) {
      for (const p of chain.points) {
        const r = foldResiduals(other, p);
        assert.ok(Math.abs(r.torque) < 1e-8 && Math.abs(r.curvature) < 1e-8);
      }
    }
  }
});
