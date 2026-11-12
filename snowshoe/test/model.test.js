import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PARAMS as P,
  rates,
  rk4Step,
  simulate,
  equilibrium,
  invariant,
  smallSwingPeriod,
  measureCycle,
  orbitExtent,
  niceCeil,
  predatorShareOfCatch,
  preyAlone,
  invariantRate,
  smallSwing,
} from '../src/model.js';

const close = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: ${actual} vs ${expected} (tol ${tol})`);

test('both rates vanish at the equilibrium', () => {
  const eq = equilibrium(P);
  close(eq.x, 25, 1e-12, 'prey');
  close(eq.y, 20, 1e-12, 'predators');
  const [dx, dy] = rates(P, eq.x, eq.y);
  close(dx, 0, 1e-12, 'prey rate');
  close(dy, 0, 1e-12, 'predator rate');
});

test('prey grow and predators starve when the other is absent', () => {
  assert.deepEqual(rates(P, 10, 0), [10, 0]);
  assert.deepEqual(rates(P, 0, 10), [0, -5]);
});

test('the invariant is smallest at the equilibrium', () => {
  const eq = equilibrium(P);
  const v0 = invariant(P, eq.x, eq.y);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [3, -2]]) {
    assert.ok(invariant(P, eq.x + dx, eq.y + dy) > v0);
  }
});

test('Runge-Kutta keeps the invariant constant along a large orbit', () => {
  const run = simulate(P, 60, 8, 60, 0.01);
  const v0 = invariant(P, 60, 8);
  const vMin = invariant(P, 25, 20);
  let worst = 0;
  for (let i = 0; i < run.x.length; i += 50) {
    worst = Math.max(worst, Math.abs(invariant(P, run.x[i], run.y[i]) - v0));
  }
  assert.ok(worst / (v0 - vMin) < 1e-5, `relative drift ${worst / (v0 - vMin)}`);
});

test('populations stay positive even through deep troughs', () => {
  const run = simulate(P, 100, 2, 40, 0.01);
  for (let i = 0; i < run.x.length; i++) {
    assert.ok(run.x[i] > 0 && run.y[i] > 0, `step ${i}`);
  }
});

test('small swings have the linearised period', () => {
  const run = simulate(P, 25.5, 20, 40, 0.005);
  const cycle = measureCycle(run.t, run.x, run.y);
  close(cycle.period, smallSwingPeriod(P), 0.005 * smallSwingPeriod(P), 'period');
});

test('larger orbits take longer', () => {
  const periods = [27, 40, 70].map((x0) => {
    const run = simulate(P, x0, 20, 80, 0.01);
    return measureCycle(run.t, run.x, run.y).period;
  });
  assert.ok(periods[0] < periods[1] && periods[1] < periods[2], periods.join(', '));
});

test('averages over one cycle equal the equilibrium on every orbit', () => {
  const eq = equilibrium(P);
  for (const [x0, y0] of [[30, 20], [60, 8], [90, 40]]) {
    const run = simulate(P, x0, y0, 80, 0.005);
    const cycle = measureCycle(run.t, run.x, run.y);
    close(cycle.meanX, eq.x, 0.005 * eq.x, `mean prey from (${x0}, ${y0})`);
    close(cycle.meanY, eq.y, 0.005 * eq.y, `mean predators from (${x0}, ${y0})`);
  }
});

test('measureCycle waits for two peaks and ignores a resting population', () => {
  const short = simulate(P, 60, 8, 3, 0.01);
  assert.equal(measureCycle(short.t, short.x, short.y), null);
  const resting = simulate(P, 25, 20, 30, 0.01);
  assert.equal(measureCycle(resting.t, resting.x, resting.y), null);
});

test('measureCycle can read only the filled part of a buffer', () => {
  const run = simulate(P, 60, 8, 60, 0.01);
  const full = measureCycle(run.t, run.x, run.y);
  const part = measureCycle(run.t, run.x, run.y, 2000);
  assert.ok(part !== null);
  close(part.period, full.period, 0.02, 'period from the first 20 time units');
});

test('one step from the equilibrium stays there', () => {
  const [x, y] = rk4Step(P, 25, 20, 0.1);
  close(x, 25, 1e-12, 'prey');
  close(y, 20, 1e-12, 'predators');
});

test('orbitExtent finds the peaks of an orbit', () => {
  const run = simulate(P, 60, 8, 30, 0.02);
  const ext = orbitExtent(P, 60, 8, 30, 0.02);
  close(ext.maxX, Math.max(...run.x), 1e-9, 'prey peak');
  close(ext.maxY, Math.max(...run.y), 1e-9, 'predator peak');
});

test('niceCeil rounds up to a round axis limit', () => {
  assert.equal(niceCeil(0.8), 1);
  assert.equal(niceCeil(1), 1);
  assert.equal(niceCeil(1.2), 2);
  assert.equal(niceCeil(2.2), 2.5);
  assert.equal(niceCeil(37), 50);
  assert.equal(niceCeil(51), 100);
  assert.equal(niceCeil(0), 1);
});

test('no fishing gives the original equations', () => {
  const fished = { ...P, f: 0 };
  const plain = { r: P.r, a: P.a, e: P.e, m: P.m };
  assert.deepEqual(rates(fished, 30, 12), rates(plain, 30, 12));
  assert.deepEqual(equilibrium(plain), equilibrium(fished));
});

test('fishing raises the prey balance and lowers the predator balance', () => {
  const calm = equilibrium(P);
  const fished = equilibrium({ ...P, f: 0.2 });
  close(fished.x, (P.m + 0.2) / (P.e * P.a), 1e-12, 'prey');
  close(fished.y, (P.r - 0.2) / P.a, 1e-12, 'predators');
  assert.ok(fished.x > calm.x && fished.y < calm.y);
  assert.ok(predatorShareOfCatch({ ...P, f: 0.2 }) < predatorShareOfCatch(P));
});

test('fishing at or above the prey birth rate leaves no balance point', () => {
  assert.equal(equilibrium({ ...P, f: P.r }), null);
  assert.equal(smallSwingPeriod({ ...P, f: 1.2 }), Infinity);
  assert.equal(predatorShareOfCatch({ ...P, f: 1.2 }), 0);
});

test('a fished orbit still conserves its invariant and averages to the fished balance', () => {
  const p = { ...P, f: 0.3 };
  const eq = equilibrium(p);
  const run = simulate(p, 50, 10, 80, 0.005);
  const v0 = invariant(p, 50, 10);
  const vMin = invariant(p, eq.x, eq.y);
  const last = run.x.length - 1;
  assert.ok(Math.abs(invariant(p, run.x[last], run.y[last]) - v0) / (v0 - vMin) < 1e-5);
  const cycle = measureCycle(run.t, run.x, run.y);
  close(cycle.meanX, eq.x, 0.005 * eq.x, 'mean prey');
  close(cycle.meanY, eq.y, 0.005 * eq.y, 'mean predators');
});

test('an infinite carrying capacity gives the classical equations', () => {
  const capped = { ...P, K: Infinity };
  assert.deepEqual(rates(capped, 30, 12), rates(P, 30, 12));
  assert.equal(smallSwing(capped).decay, 0);
});

test('crowding lowers the predator balance and leaves the prey balance alone', () => {
  const p = { ...P, K: 100 };
  const eq = equilibrium(p);
  close(eq.x, 25, 1e-12, 'prey');
  close(eq.y, (1 - 25 / 100) / P.a, 1e-12, 'predators');
  const [dx, dy] = rates(p, eq.x, eq.y);
  close(dx, 0, 1e-12, 'prey rate');
  close(dy, 0, 1e-12, 'predator rate');
});

test('with crowding V only falls and the orbit spirals into the balance point', () => {
  const p = { ...P, K: 100 };
  const eq = equilibrium(p);
  const run = simulate(p, 60, 8, 150, 0.01);
  let prev = invariant(p, run.x[0], run.y[0]);
  for (let i = 100; i < run.x.length; i += 100) {
    const v = invariant(p, run.x[i], run.y[i]);
    assert.ok(v <= prev + 1e-9, `V rose at step ${i}`);
    prev = v;
  }
  const last = run.x.length - 1;
  close(run.x[last], eq.x, 0.02 * eq.x, 'prey settles');
  close(run.y[last], eq.y, 0.02 * eq.y, 'predators settle');
});

test('invariantRate matches the change of V along an orbit', () => {
  const p = { ...P, K: 80 };
  const [x, y] = [40, 12];
  const h = 1e-4;
  const [x2, y2] = rk4Step(p, x, y, h);
  const numeric = (invariant(p, x2, y2) - invariant(p, x, y)) / h;
  close(numeric, invariantRate(p, x), 1e-4 * Math.abs(invariantRate(p, x)) + 1e-9, 'dV/dt');
});

test('the linearised decay rate matches the shrinking of small swings', () => {
  const p = { ...P, K: 200 };
  const eq = equilibrium(p);
  const s = smallSwing(p);
  const run = simulate(p, eq.x + 0.5, eq.y, 60, 0.005);
  const peaks = [];
  for (let i = 1; i < run.x.length - 1; i++) {
    if (run.x[i] > run.x[i - 1] && run.x[i] >= run.x[i + 1]) peaks.push(i);
  }
  const [i1, i2] = [peaks[1], peaks[3]];
  const measured = Math.log((run.x[i1] - eq.x) / (run.x[i2] - eq.x)) / (run.t[i2] - run.t[i1]);
  close(measured, s.decay, 0.03 * s.decay, 'decay rate');
  close((run.t[i2] - run.t[i1]) / 2, smallSwingPeriod(p), 0.01 * smallSwingPeriod(p), 'period');
});

test('a carrying capacity too small to feed the predators leaves prey alone', () => {
  const p = { ...P, K: 20 };
  assert.equal(equilibrium(p), null);
  assert.equal(invariant(p, 10, 10), null);
  close(preyAlone(p), 20, 1e-12, 'prey level without predators');
  const run = simulate(p, 15, 10, 200, 0.01);
  const last = run.x.length - 1;
  close(run.x[last], 20, 0.2, 'prey reach K');
  assert.ok(run.y[last] < 0.01, `predators ${run.y[last]}`);
  assert.equal(preyAlone(P), Infinity);
  close(preyAlone({ ...P, K: 100, f: 0.25 }), 75, 1e-12, 'fished prey level');
});
