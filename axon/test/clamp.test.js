import test from 'node:test';
import assert from 'node:assert/strict';
import { clampCurrents, clampTrace, currentVoltage } from '../src/clamp.js';
import { alphaH, alphaM, alphaN, betaH, betaM, betaN, steadyGates } from '../src/hh.js';
import { membrane } from '../src/simulate.js';

const P = membrane();

test('the exact gates match a numerical integration at the clamp voltage', () => {
  const v = -10;
  const g = steadyGates(-65);
  let { m, h, n } = g;
  const dt = 0.0005;
  for (let i = 0; i < 6000; i++) {
    m += dt * (alphaM(v) * (1 - m) - betaM(v) * m);
    h += dt * (alphaH(v) * (1 - h) - betaH(v) * h);
    n += dt * (alphaN(v) * (1 - n) - betaN(v) * n);
  }
  const exact = clampCurrents(P, -65, v, 3);
  assert.ok(Math.abs(exact.m - m) < 1e-4);
  assert.ok(Math.abs(exact.h - h) < 1e-4);
  assert.ok(Math.abs(exact.n - n) < 1e-4);
});

test('holding at the same voltage changes nothing', () => {
  const a = clampCurrents(P, -65, -65, 0);
  const b = clampCurrents(P, -65, -65, 30);
  assert.ok(Math.abs(a.total - b.total) < 1e-9);
  assert.ok(Math.abs(a.total) < 0.01, `total ${a.total}`);
});

test('a step to 0 mV: inward first, outward later', () => {
  const trace = clampTrace(P, -65, 0, { duration: 40 });
  const lowest = Math.min(...trace.total);
  const lowestAt = trace.t[trace.total.indexOf(lowest)];
  assert.ok(lowest < -300, `lowest ${lowest}`);
  assert.ok(lowestAt < 2.5, `at ${lowestAt}`);
  assert.ok(trace.total[trace.total.length - 1] > 1000);
});

test('sodium reverses at +50 and potassium at -77', () => {
  assert.ok(Math.abs(clampCurrents(P, -65, 50, 1).iNa) < 1e-9);
  assert.ok(clampCurrents(P, -65, 60, 1).iNa > 0);
  assert.ok(clampCurrents(P, -65, 40, 1).iNa < 0);
  assert.ok(Math.abs(clampCurrents(P, -65, -77, 5).iK) < 1e-9);
});

test('the largest inward sodium current flows a little below 0 mV', () => {
  const voltages = Array.from({ length: 141 }, (_, i) => -80 + i);
  const curve = currentVoltage(P, -65, voltages);
  const best = curve.reduce((a, b) => (b.early < a.early ? b : a));
  assert.ok(best.v > -15 && best.v < 5, `v ${best.v}`);
});

test('holding higher before the step leaves less sodium current to come', () => {
  const peak = (hold) => currentVoltage(P, hold, [0])[0].early;
  const low = peak(-90);
  const normal = peak(-65);
  const high = peak(-45);
  assert.ok(low < normal && normal < high, `${low} ${normal} ${high}`);
  assert.ok(Math.abs(high) < 0.5 * Math.abs(normal), `${high} vs ${normal}`);
});

test('with sodium blocked only the delayed outward current is left', () => {
  const trace = clampTrace(membrane({ naOpen: 0 }), -65, 0, { duration: 20 });
  assert.ok(Math.min(...trace.total) > -5);
  assert.ok(trace.total[trace.total.length - 1] > 1000);
});
