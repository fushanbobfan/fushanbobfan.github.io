import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fractions, cardioidPoint, cardioidNormal, bulbNucleus } from '../src/bulbs.js';
import { attractingCycle } from '../src/cycle.js';
import { inMainCardioid } from '../src/dynamics.js';

test('fractions are reduced, ordered and counted by Euler phi', () => {
  const f = fractions(7);
  // phi(2..7) = 1, 2, 2, 4, 2, 6
  assert.equal(f.length, 17);
  for (let i = 1; i < f.length; i++) assert.ok(f[i - 1][0] / f[i - 1][1] < f[i][0] / f[i][1]);
  assert.deepEqual(f[0], [1, 7]);
  assert.deepEqual(f[f.length - 1], [6, 7]);
  assert.ok(f.some(([p, q]) => p === 1 && q === 2));
  assert.ok(!f.some(([p, q]) => p === 2 && q === 4));
});

test('cardioid points: cusp at t = 0, the period-2 root at t = 1/2', () => {
  const [x0, y0] = cardioidPoint(0);
  assert.ok(Math.abs(x0 - 0.25) < 1e-15 && Math.abs(y0) < 1e-15);
  const [x1, y1] = cardioidPoint(0.5);
  assert.ok(Math.abs(x1 + 0.75) < 1e-15 && Math.abs(y1) < 1e-15);
});

test('the normal points out of the cardioid', () => {
  for (const [p, q] of fractions(9)) {
    const [x, y] = cardioidPoint(p / q);
    const [nx, ny] = cardioidNormal(p / q);
    assert.ok(Math.abs(Math.hypot(nx, ny) - 1) < 1e-12);
    assert.ok(inMainCardioid(x - 1e-3 * nx, y - 1e-3 * ny), `${p}/${q} inside`);
    assert.ok(!inMainCardioid(x + 1e-3 * nx, y + 1e-3 * ny), `${p}/${q} outside`);
  }
});

test('known bulb centres', () => {
  const half = bulbNucleus(1, 2);
  assert.ok(Math.abs(half.re + 1) < 1e-13 && Math.abs(half.im) < 1e-13);
  const third = bulbNucleus(1, 3);
  assert.ok(Math.abs(third.re + 0.122561166876654) < 1e-13);
  assert.ok(Math.abs(third.im - 0.744861766619744) < 1e-13);
  const twoThirds = bulbNucleus(2, 3);
  assert.ok(Math.abs(twoThirds.re - third.re) < 1e-13 && Math.abs(twoThirds.im + third.im) < 1e-13);
});

test('every p/q bulb up to q = 12 is found, has period q and is superattracting', () => {
  for (const [p, q] of fractions(12)) {
    const n = bulbNucleus(p, q);
    assert.ok(n, `${p}/${q} found`);
    const cyc = attractingCycle(n.re, n.im);
    assert.equal(cyc.period, q, `${p}/${q} period`);
    assert.ok(cyc.multiplier.abs < 1e-9, `${p}/${q} multiplier`);
  }
});

test('mirror bulbs are complex conjugates', () => {
  for (const [p, q] of fractions(8)) {
    const a = bulbNucleus(p, q);
    const b = bulbNucleus(q - p, q);
    assert.ok(Math.abs(a.re - b.re) < 1e-12 && Math.abs(a.im + b.im) < 1e-12, `${p}/${q}`);
  }
});
