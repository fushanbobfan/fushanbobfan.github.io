import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_N,
  radial,
  radialDensity,
  realHarmonic,
  makeOrbital,
  meanRadius,
  radialNodes,
  radialTable,
  enclosingRadius,
  mostProbableRadius,
  checkQuantumNumbers,
  energyEV,
} from '../src/hydrogen.js';

const simpson = (f, a, b, n) => {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
};

// Gauss-Legendre nodes on [-1, 1] by Newton iteration on P_N.
function gaussLegendre(N) {
  const x = [];
  const w = [];
  for (let i = 1; i <= N; i++) {
    let z = Math.cos((Math.PI * (i - 0.25)) / (N + 0.5));
    let dp = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1;
      let p1 = z;
      for (let k = 2; k <= N; k++) {
        const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      dp = (N * (z * p1 - p0)) / (z * z - 1);
      const dz = p1 / dp;
      z -= dz;
      if (Math.abs(dz) < 1e-15) break;
    }
    x.push(z);
    w.push(2 / ((1 - z * z) * dp * dp));
  }
  return { x, w };
}

const states = [];
for (let n = 1; n <= MAX_N; n++) for (let l = 0; l < n; l++) states.push([n, l]);

test('the textbook closed forms are reproduced', () => {
  for (const r of [0, 0.3, 1, 2.5, 7]) {
    assert.ok(Math.abs(radial(1, 0, r) - 2 * Math.exp(-r)) < 1e-14);
    const r20 = (1 / (2 * Math.SQRT2)) * (2 - r) * Math.exp(-r / 2);
    assert.ok(Math.abs(radial(2, 0, r) - r20) < 1e-14);
    const r21 = (1 / (2 * Math.sqrt(6))) * r * Math.exp(-r / 2);
    assert.ok(Math.abs(radial(2, 1, r) - r21) < 1e-14);
    const r32 = (4 / (81 * Math.sqrt(30))) * r * r * Math.exp(-r / 3);
    assert.ok(Math.abs(radial(3, 2, r) - r32) < 1e-14);
  }
});

test('every radial function is normalised and has the closed-form mean radius', () => {
  for (const [n, l] of states) {
    const top = n * (3 * n + 20);
    const norm = simpson((r) => radialDensity(n, l, r), 0, top, 20000);
    assert.ok(Math.abs(norm - 1) < 1e-9, `n=${n} l=${l} norm ${norm}`);
    const mean = simpson((r) => r * radialDensity(n, l, r), 0, top, 20000);
    assert.ok(Math.abs(mean - meanRadius(n, l)) < 1e-7, `n=${n} l=${l} <r> ${mean}`);
  }
});

test('radial functions with the same l are orthogonal', () => {
  for (const [n, l] of states) {
    for (let n2 = n + 1; n2 <= MAX_N; n2++) {
      if (l >= n2) continue;
      const top = n2 * (3 * n2 + 20);
      const ip = simpson((r) => r * r * radial(n, l, r) * radial(n2, l, r), 0, top, 20000);
      assert.ok(Math.abs(ip) < 1e-9, `R${n}${l} . R${n2}${l} = ${ip}`);
    }
  }
});

test('real spherical harmonics are orthonormal', () => {
  const { x, w } = gaussLegendre(24);
  const nPhi = 48;
  const list = [];
  for (let l = 0; l < MAX_N; l++) for (let m = -l; m <= l; m++) list.push([l, m]);
  const values = list.map(([l, m]) => {
    const v = [];
    for (let i = 0; i < x.length; i++) {
      for (let j = 0; j < nPhi; j++) v.push(realHarmonic(l, m, x[i], (2 * Math.PI * j) / nPhi));
    }
    return v;
  });
  const weight = [];
  for (let i = 0; i < x.length; i++) for (let j = 0; j < nPhi; j++) weight.push((w[i] * 2 * Math.PI) / nPhi);
  for (let a = 0; a < list.length; a++) {
    for (let b = a; b < list.length; b++) {
      let s = 0;
      for (let k = 0; k < weight.length; k++) s += weight[k] * values[a][k] * values[b][k];
      const want = a === b ? 1 : 0;
      assert.ok(Math.abs(s - want) < 1e-12, `Y${list[a]} . Y${list[b]} = ${s}`);
    }
  }
});

test('the real orbitals point where their names say', () => {
  const s = Math.SQRT1_2;
  const px = makeOrbital(2, 1, 1);
  const py = makeOrbital(2, 1, -1);
  const pz = makeOrbital(2, 1, 0);
  assert.ok(px.psi(1, 0, 0) > 0 && px.psi(-1, 0, 0) < 0 && Math.abs(px.psi(0, 1, 0)) < 1e-15);
  assert.ok(py.psi(0, 1, 0) > 0 && Math.abs(py.psi(1, 0, 0)) < 1e-15);
  assert.ok(pz.psi(0, 0, 1) > 0 && Math.abs(pz.psi(1, 0, 0)) < 1e-15);
  const dxy = makeOrbital(3, 2, -2);
  const dx2y2 = makeOrbital(3, 2, 2);
  const dz2 = makeOrbital(3, 2, 0);
  assert.ok(dxy.psi(s, s, 0) > 0 && dxy.psi(s, -s, 0) < 0 && Math.abs(dxy.psi(1, 0, 0)) < 1e-15);
  assert.ok(dx2y2.psi(1, 0, 0) > 0 && dx2y2.psi(0, 1, 0) < 0);
  assert.ok(dz2.psi(0, 0, 1) > 0 && dz2.psi(1, 0, 0) < 0);
  assert.ok(Math.abs(dz2.psi(0, 0, 1) + 2 * dz2.psi(1, 0, 0)) < 1e-14);
});

test('each radial function has n - l - 1 spherical nodes where it changes sign', () => {
  for (const [n, l] of states) {
    const nodes = radialNodes(n, l);
    assert.equal(nodes.length, n - l - 1, `n=${n} l=${l}`);
    for (const r0 of nodes) {
      assert.ok(Math.abs(radial(n, l, r0)) < 1e-10);
      assert.ok(radial(n, l, r0 - 1e-3) * radial(n, l, r0 + 1e-3) < 0);
    }
  }
  const [a, b] = radialNodes(3, 0);
  assert.ok(Math.abs(a - (9 - 3 * Math.sqrt(3)) / 2) < 1e-9);
  assert.ok(Math.abs(b - (9 + 3 * Math.sqrt(3)) / 2) < 1e-9);
});

test('most probable and enclosing radii', () => {
  assert.ok(Math.abs(mostProbableRadius(1, 0) - 1) < 1e-6);
  assert.ok(Math.abs(mostProbableRadius(2, 1) - 4) < 1e-6);
  assert.ok(Math.abs(mostProbableRadius(3, 2) - 9) < 1e-6);
  assert.ok(Math.abs(mostProbableRadius(6, 5) - 36) < 1e-6);
  // 1s: P(r < R) = 1 - e^{-2R}(1 + 2R + 2R^2); half the electron is inside 1.3370 a0.
  const t = radialTable(1, 0);
  const half = enclosingRadius(t, 0.5);
  const inside = 1 - Math.exp(-2 * half) * (1 + 2 * half + 2 * half * half);
  assert.ok(Math.abs(inside - 0.5) < 1e-4);
  for (const [n, l] of states) assert.ok(Math.abs(radialTable(n, l).total - 1) < 1e-4);
});

test('quantum numbers are checked and the energies follow 1/n^2', () => {
  assert.throws(() => checkQuantumNumbers(0, 0, 0), RangeError);
  assert.throws(() => checkQuantumNumbers(2, 2, 0), RangeError);
  assert.throws(() => checkQuantumNumbers(3, 1, 2), RangeError);
  assert.throws(() => checkQuantumNumbers(MAX_N + 1, 0, 0), RangeError);
  assert.ok(Math.abs(energyEV(1) + 13.6057) < 1e-4);
  // Balmer alpha: 3 -> 2 releases 1.8897 eV (656.1 nm with an infinitely heavy nucleus).
  assert.ok(Math.abs(energyEV(3) - energyEV(2) - 1.88968) < 1e-4);
});
