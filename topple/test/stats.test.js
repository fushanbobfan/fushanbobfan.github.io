import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHistogram, binOf, record, reset, densities, fitSlope,
} from '../src/stats.js';

test('sizes land in logarithmic bins', () => {
  const h = createHistogram(5);
  assert.equal(binOf(h, 1), 0);
  assert.equal(binOf(h, 10), 5);
  assert.equal(binOf(h, 99), 9);
  assert.equal(binOf(h, 100), 10);
  assert.equal(binOf(h, 1e30), h.counts.length - 1);
});

test('zero-size events are counted apart and reset clears everything', () => {
  const h = createHistogram();
  record(h, 0);
  record(h, 0);
  record(h, 12);
  assert.equal(h.total, 3);
  assert.equal(h.zeros, 2);
  assert.equal(h.largest, 12);
  assert.equal(densities(h).length, 1);
  reset(h);
  assert.equal(h.total, 0);
  assert.equal(densities(h).length, 0);
});

test('densities integrate to one over the recorded sizes', () => {
  const h = createHistogram(4);
  for (let s = 1; s <= 1000; s++) record(h, s);
  let mass = 0;
  for (let k = 0, pts = densities(h); k < pts.length; k++) {
    const lo = 10 ** (k / 4);
    const hi = 10 ** ((k + 1) / 4);
    mass += pts[k].density * (Math.ceil(hi - 1e-9) - Math.ceil(lo - 1e-9));
  }
  assert.ok(Math.abs(mass - 1) < 0.01, `mass ${mass}`);
});

test('the fit recovers the exponent of a sampled power law', () => {
  const h = createHistogram(5);
  const tau = 1.5;
  let a = 12345;
  for (let k = 0; k < 200000; k++) {
    a = (a * 1664525 + 1013904223) >>> 0;
    const u = (a + 0.5) / 4294967296;
    record(h, Math.floor(u ** (-1 / (tau - 1))));
  }
  const fit = fitSlope(densities(h), { from: 3, to: 3000 });
  assert.ok(fit);
  assert.ok(Math.abs(fit.slope + tau) < 0.1, `slope ${fit.slope}`);
});

test('too few points give no fit', () => {
  assert.equal(fitSlope([{ size: 1, density: 1, count: 10 }]), null);
});
