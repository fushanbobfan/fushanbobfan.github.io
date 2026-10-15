import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEMS, SYSTEM_KEYS, defaultParams } from '../src/systems.js';
import {
  createStepper,
  sampleOrbit,
  bounds,
  largestLyapunov,
  successiveMaxima,
  distinctLevels,
} from '../src/integrate.js';

const oscillator = (p, s, out) => {
  out[0] = s[1];
  out[1] = -s[0];
  out[2] = -p.k * s[2];
};

test('RK4 follows a harmonic oscillator and an exponential decay with fourth-order error', () => {
  const errAt = (dt) => {
    const step = createStepper(oscillator, { k: 1 });
    const s = [1, 0, 1];
    const n = Math.round(10 / dt);
    for (let i = 0; i < n; i++) step(s, dt);
    return Math.max(Math.abs(s[0] - Math.cos(10)), Math.abs(s[1] + Math.sin(10)), Math.abs(s[2] - Math.exp(-10)));
  };
  const coarse = errAt(0.1);
  const fine = errAt(0.05);
  assert.ok(coarse < 1e-4, `error ${coarse}`);
  const order = Math.log2(coarse / fine);
  assert.ok(order > 3.8 && order < 4.2, `observed order ${order}`);
});

test('sampleOrbit records the requested points and stops when an orbit escapes', () => {
  const o = sampleOrbit(SYSTEMS.lorenz, defaultParams('lorenz'), { transient: 100, count: 500, every: 2 });
  assert.equal(o.length, 500);
  assert.equal(o.points.length, 1500);
  assert.equal(o.escaped, false);
  const blowup = {
    field: (p, s, out) => {
      out[0] = s[0] * s[0];
      out[1] = 0;
      out[2] = 0;
    },
    start: [1, 0, 0],
    dt: 0.01,
  };
  const e = sampleOrbit(blowup, {}, { transient: 0, count: 1000 });
  assert.equal(e.escaped, true);
  assert.ok(e.length < 1000);
});

test('every system stays bounded on its attractor at its defaults', () => {
  for (const key of SYSTEM_KEYS) {
    const s = SYSTEMS[key];
    const o = sampleOrbit(s, defaultParams(key), { transient: Math.round(50 / s.dt), count: Math.round(200 / s.dt) });
    assert.equal(o.escaped, false, key);
    const b = bounds(o.points, o.length);
    for (let a = 0; a < 3; a++) assert.ok(b.max[a] - b.min[a] > 0.5 && b.max[a] - b.min[a] < 200, `${key} axis ${a}`);
  }
});

test('the Lorenz attractor reaches the classic extent', () => {
  const o = sampleOrbit(SYSTEMS.lorenz, defaultParams('lorenz'), { transient: 4000, count: 60000 });
  const b = bounds(o.points, o.length);
  assert.ok(b.max[0] > 15 && b.max[0] < 22 && b.min[0] < -15, `x ${b.min[0]}..${b.max[0]}`);
  assert.ok(b.max[2] > 42 && b.max[2] < 52 && b.min[2] > 0, `z ${b.min[2]}..${b.max[2]}`);
});

test('largest Lyapunov exponents agree with published values', () => {
  // Lorenz (10, 28, 8/3): 0.9056. Rossler (0.2, 0.2, 5.7): 0.0714. Chen (35, 3, 28): about 2.0.
  const lorenz = largestLyapunov(SYSTEMS.lorenz, defaultParams('lorenz'), { time: 400 });
  assert.ok(Math.abs(lorenz - 0.9056) < 0.05, `Lorenz ${lorenz}`);
  const rossler = largestLyapunov(SYSTEMS.rossler, defaultParams('rossler'), { time: 2000 });
  assert.ok(Math.abs(rossler - 0.0714) < 0.015, `Rossler ${rossler}`);
  const chen = largestLyapunov(SYSTEMS.chen, defaultParams('chen'), { time: 200 });
  assert.ok(chen > 1.8 && chen < 2.3, `Chen ${chen}`);
});

test('a stable equilibrium gives a negative exponent and a limit cycle gives about zero', () => {
  const stable = largestLyapunov(SYSTEMS.lorenz, { ...defaultParams('lorenz'), rho: 20 }, { time: 200 });
  assert.ok(stable < -0.05, `rho = 20: ${stable}`);
  const cycle = largestLyapunov(SYSTEMS.rossler, { ...defaultParams('rossler'), c: 2.5 }, { time: 1000 });
  assert.ok(Math.abs(cycle) < 0.01, `c = 2.5: ${cycle}`);
});

test('successive maxima are refined to the peak of a sampled sine', () => {
  const n = 2000;
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pts[3 * i + 1] = 2 * Math.sin(i * 0.07 + 0.3);
  const m = successiveMaxima(pts, n, 1);
  assert.equal(m.length, Math.floor(((n - 1) * 0.07 + 0.3 - Math.PI / 2) / (2 * Math.PI)) + 1);
  for (const v of m) assert.ok(Math.abs(v - 2) < 1e-3, `peak ${v}`);
});

test('distinctLevels clusters nearby values', () => {
  assert.deepEqual(distinctLevels([1, 1.0001, 3, 2.9999, 1.00005], 0.01).map((v) => +v.toFixed(3)), [1, 3]);
  assert.deepEqual(distinctLevels([], 0.1), []);
});

function maxLevels(key, over, axis, { transient, time, tol = 1e-3 }) {
  const s = SYSTEMS[key];
  const o = sampleOrbit(s, { ...defaultParams(key), ...over }, {
    transient: Math.round(transient / s.dt),
    count: Math.round(time / s.dt),
  });
  return distinctLevels(successiveMaxima(o.points, o.length, axis), tol).length;
}

test('the Rossler period-doubling cascade quoted in its note', () => {
  const opts = { transient: 1000, time: 600 };
  assert.equal(maxLevels('rossler', { c: 2.5 }, 0, opts), 1);
  assert.equal(maxLevels('rossler', { c: 3.5 }, 0, opts), 2);
  assert.equal(maxLevels('rossler', { c: 4 }, 0, opts), 4);
  assert.ok(maxLevels('rossler', { c: 5.7 }, 0, opts) > 30);
});

test('the Lorenz periodic windows quoted in its note', () => {
  const opts = { transient: 200, time: 100 };
  assert.ok(maxLevels('lorenz', { rho: 99.65 }, 2, opts) <= 8);
  assert.ok(maxLevels('lorenz', { rho: 160 }, 2, opts) <= 4);
  assert.ok(maxLevels('lorenz', {}, 2, opts) > 50);
  assert.equal(maxLevels('lorenz', { rho: 20 }, 2, opts), 0);
});

test('Halvorsen is chaotic at its default and periodic at a = 1.89, as its note says', () => {
  const opts = { transient: 50, time: 300 };
  assert.ok(maxLevels('halvorsen', {}, 0, opts) > 100);
  assert.equal(maxLevels('halvorsen', { a: 1.89 }, 0, opts), 3);
});
