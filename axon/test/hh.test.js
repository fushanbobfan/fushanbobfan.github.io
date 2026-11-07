import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SQUID, alphaM, alphaN, channels, derivatives, stableStep, steadyGates, step, temperatureFactor,
} from '../src/hh.js';

function near(actual, expected, tolerance, label = '') {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} ${actual} is not within ${tolerance} of ${expected}`);
}

test('the rates are smooth through the points where they read 0/0', () => {
  near(alphaN(-55), 0.1, 1e-9, 'alphaN');
  near(alphaM(-40), 1, 1e-9, 'alphaM');
  near(alphaN(-55 + 1e-4), alphaN(-55), 1e-5);
  near(alphaM(-40 - 1e-4), alphaM(-40), 1e-4);
});

test('steady gates at -65 mV match the textbook values', () => {
  const g = steadyGates(-65);
  near(g.m, 0.0529, 1e-3, 'm');
  near(g.h, 0.5961, 1e-3, 'h');
  near(g.n, 0.3177, 1e-3, 'n');
});

test('with every gate steady the membrane sits almost still at -65 mV', () => {
  const out = new Float64Array(4);
  const s = steadyGates(-65);
  derivatives(SQUID, 1, [-65, s.m, s.h, s.n], 0, out);
  near(out[0], 0, 0.01, 'dV/dt');
  for (const i of [1, 2, 3]) near(out[i], 0, 1e-12);
});

test('currents push the voltage toward each reversal potential', () => {
  const c = channels(SQUID, { v: 0, m: 0.5, h: 0.5, n: 0.5 });
  assert.ok(c.iNa < 0, 'sodium flows in');
  assert.ok(c.iK > 0, 'potassium flows out');
  near(c.gNa, 120 * 0.125 * 0.5, 1e-12);
  near(c.gK, 36 * 0.0625, 1e-12);
});

test('temperature triples the rates every ten degrees', () => {
  near(temperatureFactor(6.3), 1, 1e-12);
  near(temperatureFactor(16.3), 3, 1e-12);
  near(temperatureFactor(18.5), Math.pow(3, 1.22), 1e-9);
});

test('Runge-Kutta is fourth order on a relaxing gate', () => {
  const run = (dt) => {
    const s = steadyGates(-65);
    const y = new Float64Array([-65, s.m, s.h, s.n]);
    for (let t = 0; t < 2 - 1e-9; t += dt) step(SQUID, 1, y, t, dt, () => 20);
    return y[0];
  };
  const coarse = Math.abs(run(0.04) - run(0.0025));
  const fine = Math.abs(run(0.02) - run(0.0025));
  assert.ok(coarse / fine > 10, `error ratio ${coarse / fine}`);
});

test('the step shrinks as the rates grow', () => {
  assert.equal(stableStep(6.3), 0.01);
  assert.ok(stableStep(35) < 0.002);
});
