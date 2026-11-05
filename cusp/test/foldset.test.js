import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSICAL, curvature, thirdDerivative } from '../src/machine.js';
import { countWells, restPoints } from '../src/equilibria.js';
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

function insideCurve(points, x, y) {
  let inside = false;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    if ((p.y > y) !== (q.y > y) && x < p.x + ((y - p.y) * (q.x - p.x)) / (q.y - p.y)) inside = !inside;
  }
  return inside;
}

// Soft, stiff, hairpinned and slack-arc machines, from a survey of the slider range.
const others = [
  { r: 0.5, a: 2.4, l: 0.8, s: 1.6 },
  { r: 0.5, a: 1.8, l: 0.7, s: 0.6 },
  { r: 0.5, a: 1.95, l: 1.3, s: 1.6 },
  { r: 0.5, a: 2.45, l: 1.3, s: 2.2 },
  { r: 0.5, a: 1.45, l: 0.3, s: 2.2 },
  { r: 0.5, a: 2, l: 1.4, s: 2 },
];

for (const other of others) {
  test(`a=${other.a} l=${other.l} s=${other.s} traces one closed curve of true fold points`, () => {
    const set = traceFoldSet(other);
    assert.equal(set.length, 1);
    assert.ok(set[0].closed);
    for (const p of set[0].points) {
      if (p.slack || p.stretch < 1e-4) continue;
      const r = foldResiduals(other, p);
      assert.ok(Math.abs(r.torque) < 1e-8 && Math.abs(r.curvature) < 1e-8);
    }
  });

  test(`a=${other.a} l=${other.l} s=${other.s}: two wells inside the curve, one outside`, () => {
    const { points } = traceFoldSet(other)[0];
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => Math.abs(p.y));
    const [x0, x1, y1] = [Math.min(...xs), Math.max(...xs), Math.max(...ys)];
    let wrong = 0;
    let total = 0;
    for (let i = 1; i < 30; i += 1) {
      for (let j = 1; j < 30; j += 1) {
        const x = x0 + ((x1 - x0) * i) / 30;
        const y = -y1 + (2 * y1 * j) / 30 + 1e-4;
        total += 1;
        if ((countWells(other, x, y, 720) >= 2) !== insideCurve(points, x, y)) wrong += 1;
      }
    }
    assert.ok(wrong / total < 0.03, `${wrong} of ${total}`);
  });
}

test('where the moving band goes slack, the set follows the circle it goes taut on', () => {
  const m2 = { r: 0.5, a: 2, l: 1.4, s: 2 };
  const { points } = traceFoldSet(m2)[0];
  const arc = points.filter((p) => p.slack);
  assert.ok(arc.length > 4);
  for (const p of arc) {
    assert.ok(Math.abs(Math.hypot(p.x + m2.r, p.y) - m2.l) < 1e-9);
    // Just outside the circle the pin at pi is a minimum, just inside it a maximum.
    const out = 1 + 0.001 / m2.l;
    const near = { x: -m2.r + (p.x + m2.r) * out, y: p.y * out };
    assert.ok(curvature(m2, near.x, near.y, Math.PI) > 0);
    assert.ok(curvature(m2, -m2.r + (p.x + m2.r) * 0.999, p.y * 0.999, Math.PI) < 0);
  }
  assert.equal(findCusps(m2, traceFoldSet(m2)).length, 2);
});
