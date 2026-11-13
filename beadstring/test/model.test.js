import test from 'node:test';
import assert from 'node:assert/strict';
import {
  modeShape, modeFrequency, continuumFrequency, project, synthesize, evolveMode,
  pluckShape, nudgeShape, bumpShape, modeOnly, createString, step, setParams,
  positions, velocities, modeEnergies, totalEnergy, beadEnergies, beatPeriod, overtoneRatios,
} from '../src/model.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('mode shapes are orthonormal', () => {
  const n = 9;
  for (let a = 1; a <= n; a++) {
    for (let b = 1; b <= n; b++) {
      const pa = modeShape(n, a);
      const pb = modeShape(n, b);
      let dot = 0;
      for (let j = 0; j < n; j++) dot += pa[j] * pb[j];
      close(dot, a === b ? 1 : 0, 1e-12, `modes ${a},${b}`);
    }
  }
});

test('projecting and resynthesizing returns the shape', () => {
  const shape = Float64Array.from({ length: 11 }, (_, i) => Math.sin(i * 1.7) + 0.3 * i);
  const back = synthesize(project(shape));
  shape.forEach((v, i) => close(back[i], v, 1e-12));
});

test('known frequencies', () => {
  const p = { coupling: 1, anchor: 0, damping: 0 };
  close(modeFrequency(1, 1, p), Math.SQRT2, 1e-12, 'one bead between two walls');
  close(modeFrequency(2, 1, p), 1, 1e-12, 'two beads in step');
  close(modeFrequency(2, 2, p), Math.sqrt(3), 1e-12, 'two beads opposed');
  const n = 200;
  close(modeFrequency(n, 1, p), continuumFrequency(n, 1, p), 1e-4, 'many beads look continuous');
  assert.ok(modeFrequency(n, n, p) < 2, 'top mode stays below 2·coupling');
  close(modeFrequency(3, 2, { coupling: 0, anchor: 1.5, damping: 0 }), 1.5, 1e-12, 'uncoupled pendulums');
});

test('beads bend the overtones below whole multiples', () => {
  const ratios = overtoneRatios(6, { coupling: 1, anchor: 0, damping: 0 }, 3);
  assert.equal(ratios.length, 3);
  ratios.forEach((r, i) => assert.ok(r < i + 2 && r > 1, `ratio ${r}`));
  const fine = overtoneRatios(400, { coupling: 1, anchor: 0, damping: 0 }, 3);
  fine.forEach((r, i) => close(r, i + 2, 1e-3));
});

// Integrate the bead equations directly as an independent check.
function rk4Beads(y0, params, t, dt) {
  const n = y0.length;
  const { coupling: c, anchor: a, damping: g } = params;
  const accel = (y, v) => y.map((yj, j) => {
    const l = j > 0 ? y[j - 1] : 0;
    const r = j < n - 1 ? y[j + 1] : 0;
    return c * c * (l - 2 * yj + r) - a * a * yj - g * v[j];
  });
  let y = [...y0];
  let v = new Array(n).fill(0);
  const add = (x, d, h) => x.map((xi, i) => xi + h * d[i]);
  for (let s = 0; s < Math.round(t / dt); s++) {
    const k1v = accel(y, v); const k1y = v;
    const k2v = accel(add(y, k1y, dt / 2), add(v, k1v, dt / 2)); const k2y = add(v, k1v, dt / 2);
    const k3v = accel(add(y, k2y, dt / 2), add(v, k2v, dt / 2)); const k3y = add(v, k2v, dt / 2);
    const k4v = accel(add(y, k3y, dt), add(v, k3v, dt)); const k4y = add(v, k3v, dt);
    y = y.map((yi, i) => yi + (dt / 6) * (k1y[i] + 2 * k2y[i] + 2 * k3y[i] + k4y[i]));
    v = v.map((vi, i) => vi + (dt / 6) * (k1v[i] + 2 * k2v[i] + 2 * k3v[i] + k4v[i]));
  }
  return y;
}

test('exact mode-by-mode motion matches direct integration', () => {
  for (const params of [
    { coupling: 1, anchor: 0, damping: 0 },
    { coupling: 0.7, anchor: 1.2, damping: 0.15 },
    { coupling: 1, anchor: 0, damping: 3.5 },
  ]) {
    const shape = pluckShape(7, 2, 0.8);
    const s = createString(7, params, shape);
    for (let i = 0; i < 300; i++) step(s, 0.02);
    const direct = rk4Beads([...shape], params, 6, 0.001);
    positions(s).forEach((v, i) => close(v, direct[i], 1e-7, `bead ${i + 1}`));
  }
});

test('the damped step is continuous through critical damping', () => {
  const w = 2;
  const at = (g) => evolveMode(0.7, -0.3, w, g, 0.9);
  const [qa, pa] = at(4 - 1e-7);
  const [qb, pb] = at(4);
  const [qc, pc] = at(4 + 1e-7);
  close(qa, qb, 1e-6); close(qc, qb, 1e-6);
  close(pa, pb, 1e-6); close(pc, pb, 1e-6);
});

test('energy is conserved without damping and falls with it', () => {
  const s = createString(12, { coupling: 1, anchor: 0.5, damping: 0 }, pluckShape(12, 4, 1));
  const e0 = totalEnergy(s);
  for (let i = 0; i < 5000; i++) step(s, 0.05);
  close(totalEnergy(s), e0, 1e-10 * e0);

  const d = createString(12, { coupling: 1, anchor: 0, damping: 0.2 }, pluckShape(12, 4, 1));
  let last = totalEnergy(d);
  for (let i = 0; i < 50; i++) {
    step(d, 0.5);
    const e = totalEnergy(d);
    assert.ok(e <= last + 1e-15);
    last = e;
  }
  assert.ok(last < 0.01 * e0);
});

test('bead energies add up to the mode energies', () => {
  const params = { coupling: 1.3, anchor: 0.6, damping: 0 };
  const s = createString(9, params, bumpShape(9, 3, 2.5, 0.9));
  step(s, 1.37);
  const parts = beadEnergies(positions(s), velocities(s), params);
  close(parts.reduce((a, b) => a + b, 0), totalEnergy(s), 1e-12);
  const one = createString(1, params, nudgeShape(1, 1, 0.5));
  close(beadEnergies(positions(one), velocities(one), params)[0], totalEnergy(one), 1e-12);
});

test('plucking the middle bead excites only the odd modes', () => {
  const s = createString(15, undefined, pluckShape(15, 8, 1));
  const e = modeEnergies(s);
  for (let k = 2; k <= 15; k += 2) close(e[k - 1], 0, 1e-24, `mode ${k}`);
  for (let k = 1; k <= 15; k += 2) assert.ok(e[k - 1] > 0, `mode ${k}`);
});

test('a single-mode start stays in that mode and keeps its shape', () => {
  const n = 10;
  const s = createString(n, undefined, modeOnly(n, 3, 0.5));
  const e = modeEnergies(s);
  e.forEach((v, i) => (i === 2 ? assert.ok(v > 0) : close(v, 0, 1e-24)));
  close(Math.max(...positions(s).map(Math.abs)), 0.5, 0.05);
  const period = (2 * Math.PI) / modeFrequency(n, 3);
  step(s, period / 2);
  const y = positions(s);
  modeOnly(n, 3, 0.5).forEach((v, i) => close(y[i], -v, 1e-12));
});

test('two weakly coupled pendulums trade their energy at the beat period', () => {
  const params = { coupling: 0.4, anchor: 1, damping: 0 };
  const T = beatPeriod(params);
  close(T, (2 * Math.PI) / (Math.sqrt(1.48) - Math.sqrt(1.16)), 1e-12);
  const s = createString(2, params, nudgeShape(2, 1, 0.6));
  const share2 = () => {
    const e = beadEnergies(positions(s), velocities(s), params);
    return e[1] / (e[0] + e[1]);
  };
  assert.ok(share2() < 0.1);
  step(s, T / 2);
  assert.ok(share2() > 0.85, `after half a beat ${share2()}`);
  step(s, T / 2);
  assert.ok(share2() < 0.15, `after a full beat ${share2()}`);
  assert.equal(beatPeriod({ coupling: 0, anchor: 1, damping: 0 }), Infinity);
});

test('changing the physics keeps the present shape', () => {
  const s = createString(6, undefined, pluckShape(6, 2, 1));
  step(s, 0.8);
  const before = positions(s);
  setParams(s, { anchor: 2 });
  positions(s).forEach((v, i) => close(v, before[i], 1e-12));
  close(s.omega[0], modeFrequency(6, 1, { coupling: 1, anchor: 2 }), 1e-12);
});

test('initial shapes', () => {
  assert.deepEqual([...pluckShape(5, 2, 1)], [0.5, 1, 0.75, 0.5, 0.25]);
  assert.deepEqual([...nudgeShape(4, 3, 0.2)], [0, 0, 0.2, 0]);
  const b = bumpShape(9, 5, 2, 1);
  assert.deepEqual([...b], [0, 0, 0, 0.5, 1, 0.5, 0, 0, 0]);
});
