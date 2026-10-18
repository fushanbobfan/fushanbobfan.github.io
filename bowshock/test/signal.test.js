import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pressure, Trace } from '../src/signal.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('silence is zero pressure', () => {
  assert.equal(pressure([], 2.5), 0);
});

test('one image carries the emitted phase, weakened by distance', () => {
  const p = pressure([{ tau: 0.1, dist: 16 }], 2.5);
  close(p, Math.sin(2 * Math.PI * 0.25) / 4);
  close(pressure([{ tau: 0.1, dist: 64 }], 2.5), p / 2);
});

test('images add, and the near-field floor keeps the sum finite', () => {
  const a = { tau: 0.1, dist: 16 };
  const b = { tau: 0.3, dist: 16 };
  close(pressure([a, b], 2.5), pressure([a], 2.5) + pressure([b], 2.5));
  assert.ok(Number.isFinite(pressure([{ tau: 0.1, dist: 0 }], 2.5)));
});

test('a source heard through one image at its own pitch gives a sine at the ring rate', () => {
  // Constant delay d: tau = t - d.
  const rate = 2;
  const d = 1.3;
  const v = (t) => pressure([{ tau: t - d, dist: 25 }], rate);
  close(v(0.2), v(0.7));
  close(v(0.2), -v(0.45));
});

test('the trace keeps only its window and reports its peak', () => {
  const tr = new Trace(1);
  for (let k = 0; k <= 300; k++) tr.push(k / 100, Math.sin(k / 10) * (k / 300));
  assert.ok(tr.t[0] >= 2 - 1e-9);
  assert.equal(tr.t[tr.t.length - 1], 3);
  close(tr.peak(), Math.max(...tr.v.map(Math.abs)));
  tr.clear();
  assert.equal(tr.peak(), 0);
});
