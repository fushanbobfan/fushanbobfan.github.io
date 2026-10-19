import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coefficients,
  createHistory,
  record,
  samples,
  clearHistory,
  upCrossings,
  analyse,
} from '../src/shedding.js';

const close = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('coefficients divide by the dynamic pressure times the size, lift up on screen', () => {
  const { cd, cl } = coefficients(0.1, -0.05, 0.1, 20);
  close(cd, 1, 1e-12);
  close(cl, 0.5, 1e-12);
});

test('the history keeps the newest samples in time order', () => {
  const h = createHistory(3);
  for (let s = 1; s <= 5; s++) record(h, s * 10, s, -s);
  assert.deepEqual(samples(h).step, [30, 40, 50]);
  assert.deepEqual(samples(h, 40).cd, [4, 5]);
  clearHistory(h);
  assert.equal(samples(h).step.length, 0);
});

test('up-crossings of a sine land on its zeros', () => {
  const t = [], y = [];
  for (let k = 0; k <= 400; k++) {
    t.push(k);
    y.push(Math.sin((2 * Math.PI * (k - 7)) / 100));
  }
  const ups = upCrossings(t, y);
  assert.equal(ups.length, 4);
  for (let j = 0; j < 4; j++) close(ups[j], 7 + 100 * j, 0.1);
});

test('a swinging lift gives the period, Strouhal number and whole-period means', () => {
  const h = createHistory();
  const U = 0.1, D = 20, period = 960;
  for (let s = 0; s <= 12000; s += 10) {
    const ph = (2 * Math.PI * s) / period;
    record(h, s, 1.4 + 0.05 * Math.sin(2 * ph), 0.4 * Math.sin(ph) + 0.01);
  }
  const r = analyse(h, U, D);
  assert.equal(r.shedding, true);
  close(r.period, period, 0.5);
  close(r.strouhal, D / (period * U), 1e-3);
  close(r.cd, 1.4, 2e-3);
  close(r.clMean, 0.01, 2e-3);
  close(r.clAmplitude, 0.4, 2e-3);
  assert.ok(r.cycles >= 11);
});

test('a steady wake reports only its drag', () => {
  const h = createHistory();
  for (let s = 0; s < 2000; s += 10) record(h, s, 2.1, 0.001 * Math.sin(s / 30));
  const r = analyse(h, 0.1, 20);
  assert.equal(r.shedding, false);
  assert.ok(Number.isNaN(r.strouhal));
  close(r.cd, 2.1, 1e-6);
  assert.equal(analyse(createHistory(), 0.1, 20), null);
});
