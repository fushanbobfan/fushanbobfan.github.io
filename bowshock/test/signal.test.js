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

import { BoomLog } from '../src/signal.js';
import { createSim, stepSim, heard, STEP } from '../src/sim.js';
import { SOUND_SPEED, WORLD } from '../src/path.js';

test('a boom is logged when two images appear at once', () => {
  const log = new BoomLog(10);
  assert.equal(log.update(0, 0), false);
  assert.equal(log.update(0.1, 2), true);
  assert.equal(log.update(0.2, 2), false);
  assert.equal(log.update(0.3, 1), false);
  assert.equal(log.update(0.4, 2), false);
  assert.deepEqual(log.times, [0.1]);
  assert.equal(log.last, 0.1);
  log.update(20, 0);
  assert.equal(log.last, null);
});

test('the boom reaches the listener when the cone edge does', () => {
  const mach = 2;
  const sim = createSim({ path: 'line', mach, listener: { x: 60, y: 20 } });
  const log = new BoomLog(100);
  for (let i = 0; i < 2.5 / STEP; i++) {
    stepSim(sim);
    log.update(sim.t, heard(sim).length);
  }
  // The source starts at x = 0.15 W along y = H / 2, so the cone edge,
  // h sqrt(M^2 - 1) behind it, reaches the listener when the source is at
  // 60 + 30 sqrt(3).
  const h = WORLD.height / 2 - 20;
  const x0 = WORLD.width * 0.15;
  const expected = (60 + h * Math.sqrt(mach * mach - 1) - x0) / (mach * SOUND_SPEED);
  assert.equal(log.times.length, 1);
  close(log.times[0], expected, 2 * STEP);
});
