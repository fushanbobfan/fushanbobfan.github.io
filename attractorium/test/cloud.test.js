import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEMS, defaultParams } from '../src/systems.js';
import { sampleOrbit } from '../src/integrate.js';
import { createCloud, spreadOf, growthRate } from '../src/cloud.js';

const lorenz = SYSTEMS.lorenz;
const params = defaultParams('lorenz');
const onAttractor = sampleOrbit(lorenz, params, { transient: 4000, count: 1 }).state;

test('the cloud starts inside the requested ball with orbit 0 at the centre', () => {
  const c = createCloud(lorenz, params, { center: onAttractor, count: 300, radius: 0.01, seed: 4 });
  for (let i = 0; i < c.count; i++) {
    const d = Math.hypot(c.pos[3 * i] - onAttractor[0], c.pos[3 * i + 1] - onAttractor[1], c.pos[3 * i + 2] - onAttractor[2]);
    assert.ok(d <= 0.01 + 1e-12);
  }
  assert.equal(c.pos[0], onAttractor[0]);
  // Uniform in a ball: the RMS distance from the centre is sqrt(3/5) of the radius.
  assert.ok(Math.abs(spreadOf(c.pos, c.alive) / 0.01 - Math.sqrt(3 / 5)) < 0.06);
});

test('the same seed releases the same cloud', () => {
  const a = createCloud(lorenz, params, { center: onAttractor, count: 20, seed: 9 });
  const b = createCloud(lorenz, params, { center: onAttractor, count: 20, seed: 9 });
  assert.deepEqual(Array.from(a.pos), Array.from(b.pos));
});

test('tails remember earlier positions, newest first', () => {
  const c = createCloud(lorenz, params, { center: onAttractor, count: 3, tail: 5 });
  const seen = [];
  for (let k = 0; k < 4; k++) {
    c.advance(10);
    seen.push([c.pos[3], c.pos[4], c.pos[5]]);
  }
  const out = [];
  for (let age = 0; age < 4; age++) {
    c.tailPoint(1, age, out);
    const want = seen[3 - age];
    for (let a = 0; a < 3; a++) assert.ok(Math.abs(out[a] - want[a]) < 1e-4);
  }
});

test('a Lorenz cloud spreads at about the largest Lyapunov exponent, then saturates', () => {
  const c = createCloud(lorenz, params, { center: onAttractor, count: 200, radius: 1e-7, seed: 2 });
  while (c.time < 30) c.advance(10);
  const { rate, samples } = growthRate(c.history, 1e-5, 1);
  assert.ok(samples > 50, `samples ${samples}`);
  assert.ok(rate > 0.6 && rate < 1.3, `rate ${rate}`);
  const last = c.history[c.history.length - 1].spread;
  assert.ok(last > 3 && last < 20, `saturated spread ${last}`);
  assert.equal(c.aliveCount(), 200);
});

test('a cloud near a stable equilibrium shrinks', () => {
  const p = { ...params, rho: 15 };
  const c = createCloud(lorenz, p, { center: [5, 5, 14], count: 50, radius: 0.5 });
  while (c.time < 20) c.advance(10);
  assert.ok(c.history[c.history.length - 1].spread < 1e-3);
  assert.ok(growthRate(c.history, 1e-9, 1).rate < 0);
});

test('orbits that escape are dropped from the cloud', () => {
  const runaway = { field: (p, s, out) => { out[0] = s[0] * s[0]; out[1] = 0; out[2] = 0; }, start: [0, 0, 0], dt: 0.05 };
  const c = createCloud(runaway, {}, { center: [2, 0, 0], count: 10, radius: 0.1 });
  for (let k = 0; k < 20; k++) c.advance(10);
  assert.equal(c.aliveCount(), 0);
  assert.equal(spreadOf(c.pos, c.alive), 0);
});
