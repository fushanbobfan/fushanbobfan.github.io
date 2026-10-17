import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGas, packingFraction } from '../src/gas.js';
import { step, createGrid, safeStep } from '../src/physics.js';
import {
  maxwellPdf, maxwellCdf, characteristicSpeeds, speedHistogram, blendHistogram,
  boltzmannH, maxwellH, ksDistance, wallPressure, idealPressure, hendersonZ,
  createPressureMeter, recordPressure, meterReading,
} from '../src/stats.js';

function integrate(f, a, b, n = 20000) {
  const h = (b - a) / n;
  let s = 0;
  for (let k = 0; k < n; k++) s += f(a + (k + 0.5) * h);
  return s * h;
}

test('the Maxwell density integrates to its CDF and to one', () => {
  const f = (v) => maxwellPdf(v, 2, 1.5);
  assert.ok(Math.abs(integrate(f, 0, 20) - 1) < 1e-6);
  assert.ok(Math.abs(integrate(f, 0, 1.1) - maxwellCdf(1.1, 2, 1.5)) < 1e-6);
});

test('characteristic speeds match their definitions', () => {
  const m = 3;
  const kT = 2;
  const s = characteristicSpeeds(m, kT);
  const f = (v) => maxwellPdf(v, m, kT);
  assert.ok(Math.abs(integrate((v) => v * f(v), 0, 20) - s.mean) < 1e-6);
  assert.ok(Math.abs(Math.sqrt(integrate((v) => v * v * f(v), 0, 20)) - s.rms) < 1e-6);
  const e = 1e-4;
  assert.ok(f(s.mostProbable) > f(s.mostProbable - e) && f(s.mostProbable) > f(s.mostProbable + e));
});

test('the histogram counts every selected disk once', () => {
  const gas = createGas({ n: 200, seed: 3 });
  const h = speedHistogram(gas, 20, 2);
  assert.equal(h.total, 200);
  assert.equal(h.counts.reduce((a, b) => a + b, 0), 200);
  const half = speedHistogram(gas, 20, 2, (i) => i % 2 === 0);
  assert.equal(half.total, 100);
});

test('blending starts from the snapshot and then moves toward new data', () => {
  const a = { counts: Float64Array.from([4, 0]), total: 4, width: 1, vmax: 2 };
  const b = { counts: Float64Array.from([0, 4]), total: 4, width: 1, vmax: 2 };
  let avg = blendHistogram(null, a);
  assert.deepEqual(Array.from(avg.counts), [4, 0]);
  avg = blendHistogram(avg, b, 0.75);
  assert.deepEqual(Array.from(avg.counts), [3, 1]);
});

test('a spike of equal speeds has a higher H than the Maxwell distribution', () => {
  const spike = { counts: Float64Array.from([0, 0, 0, 100, 0, 0, 0, 0]), total: 100, width: 0.5, vmax: 4 };
  assert.ok(boltzmannH(spike) > maxwellH(1, 1, 8, 4));
});

test('Henderson reduces to the ideal gas at zero density and grows with it', () => {
  assert.equal(hendersonZ(0), 1);
  assert.ok(hendersonZ(0.3) > hendersonZ(0.1));
});

test('wall pressure is impulse per perimeter per time', () => {
  assert.equal(wallPressure(40, 2, 3, 2), 2);
  assert.equal(idealPressure(10, 2, 4, 5), 1);
});

test('the pressure meter keeps only a recent window', () => {
  const meter = createPressureMeter(2);
  recordPressure(meter, 100, 1);
  recordPressure(meter, 4, 1);
  recordPressure(meter, 4, 1);
  assert.equal(meter.samples.length, 2);
  assert.equal(meterReading(meter, 1, 1), 8 / (4 * 2));
});

test('a relaxed gas has Maxwell speeds and pressure near the equation of state', () => {
  const gas = createGas({ n: 400, radius: 1, width: 100, height: 100, kT: 1, seed: 21 });
  const grid = createGrid(gas);
  const dt = safeStep(gas, 0.25);
  for (let s = 0; s < 1500; s++) step(gas, dt, grid);
  const i0 = gas.wallImpulse;
  const t0 = gas.time;
  for (let s = 0; s < 3000; s++) step(gas, dt, grid);
  const measured = wallPressure(gas.wallImpulse - i0, gas.time - t0, gas.width, gas.height);
  const expected = idealPressure(gas.n, 1, gas.width, gas.height) * hendersonZ(packingFraction(gas));
  assert.ok(Math.abs(measured / expected - 1) < 0.12, `P=${measured} vs ${expected}`);
  // 400 disks: the 1% KS critical value is about 1.63 / sqrt(400) = 0.08.
  assert.ok(ksDistance(gas, 1, 1) < 0.08);
});
