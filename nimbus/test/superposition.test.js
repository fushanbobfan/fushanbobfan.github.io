import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeOrbital } from '../src/hydrogen.js';
import {
  dipoleElement,
  angularDipole,
  transition,
  bandOf,
  mixedSample,
  weightsAt,
  mixedDensity,
} from '../src/superposition.js';

const orb = (n, l, m) => ({ n, l, m });

test('the 2p-1s dipole matches the closed form 128 sqrt2 / 243', () => {
  const d = dipoleElement(orb(1, 0, 0), orb(2, 1, 0));
  assert.ok(Math.abs(d[2] - (128 * Math.SQRT2) / 243) < 1e-9, `${d}`);
  assert.equal(d[0], 0);
  assert.equal(d[1], 0);
  const dx = dipoleElement(orb(1, 0, 0), orb(2, 1, 1));
  assert.ok(Math.abs(dx[0] - (128 * Math.SQRT2) / 243) < 1e-9 && dx[2] === 0);
  const dy = dipoleElement(orb(2, 1, -1), orb(1, 0, 0));
  assert.ok(Math.abs(dy[1] - (128 * Math.SQRT2) / 243) < 1e-9);
});

test('the selection rule: light only when l changes by one', () => {
  for (const [a, b] of [[orb(1, 0, 0), orb(2, 0, 0)], [orb(1, 0, 0), orb(3, 2, 0)], [orb(2, 1, 0), orb(3, 1, 0)], [orb(2, 1, 1), orb(4, 3, 0)]]) {
    assert.equal(transition(a, b).allowed, false, `${JSON.stringify(a)} ${JSON.stringify(b)}`);
  }
  assert.equal(transition(orb(2, 1, 0), orb(3, 2, 0)).allowed, true);
  // p_x to d_xy is allowed along y; p_z to d_xy is not.
  assert.equal(transition(orb(2, 1, 1), orb(3, 2, -2)).allowed, true);
  assert.equal(transition(orb(2, 1, 0), orb(3, 2, -2)).allowed, false);
});

test('angular dipoles are symmetric and sum like a completeness relation', () => {
  // Y00 times the unit vector lies wholly in the l = 1 shell, so the squared
  // overlaps with the three p orbitals add up to |r_hat|^2 = 1.
  let total = 0;
  for (const m of [-1, 0, 1]) {
    const v = angularDipole(0, 0, 1, m);
    total += v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
    const back = angularDipole(1, m, 0, 0);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(v[i] - back[i]) < 1e-14);
  }
  assert.ok(Math.abs(total - 1) < 1e-12);
});

test('wavelengths of known lines, with the reduced mass', () => {
  // Vacuum wavelengths (NIST ASD, fine-structure-weighted): Lyman alpha 121.567 nm,
  // Balmer alpha 656.46 nm, Balmer beta 486.27 nm, Paschen alpha 1875.6 nm.
  const la = transition(orb(1, 0, 0), orb(2, 1, 0));
  assert.ok(Math.abs(la.wavelengthNm - 121.567) < 0.01, `${la.wavelengthNm}`);
  assert.equal(la.series, 'Lyman');
  const ha = transition(orb(3, 2, 0), orb(2, 1, 0));
  assert.ok(Math.abs(ha.wavelengthNm - 656.46) < 0.02, `${ha.wavelengthNm}`);
  assert.equal(ha.series, 'Balmer');
  assert.equal(bandOf(ha.wavelengthNm), 'visible, red');
  const hb = transition(orb(2, 1, 1), orb(4, 2, 1));
  assert.ok(Math.abs(hb.wavelengthNm - 486.27) < 0.02);
  assert.equal(bandOf(hb.wavelengthNm), 'visible, blue');
  const pa = transition(orb(3, 1, 0), orb(4, 2, 0));
  assert.ok(Math.abs(pa.wavelengthNm - 1875.6) < 0.5);
  assert.equal(bandOf(la.wavelengthNm), 'ultraviolet');
  assert.equal(bandOf(pa.wavelengthNm), 'infrared');
  // 2p - 1s beats every 0.41 fs.
  assert.ok(Math.abs(la.periodFs - 0.4054) < 0.001, `${la.periodFs}`);
});

test('the 2p lifetime comes out at 1.6 ns', () => {
  // A(2p -> 1s) = 6.27e8 per second, the same for every 2p orbital.
  for (const m of [-1, 0, 1]) {
    const t = transition(orb(2, 1, m), orb(1, 0, 0));
    assert.ok(Math.abs(t.rate - 6.268e8) / 6.268e8 < 1e-3, `${t.rate}`);
  }
});

test('same-shell mixes do not beat', () => {
  const t = transition(orb(2, 0, 0), orb(2, 1, 0));
  assert.equal(t.sameShell, true);
  assert.equal(t.wavelengthNm, undefined);
  assert.equal(t.allowed, true);
});

test('the weighted cloud follows rho(t): its centre swings as d cos(omega t)', () => {
  const a = orb(1, 0, 0);
  const b = orb(2, 1, 0);
  const N = 60000;
  const s = mixedSample(a, b, N, 5);
  const dz = dipoleElement(a, b)[2];
  for (const phase of [0, Math.PI / 3, Math.PI / 2, Math.PI]) {
    const w = weightsAt(s, phase);
    let sum = 0;
    let z = 0;
    for (let k = 0; k < N; k++) {
      sum += w[k];
      z += w[k] * s.positions[3 * k + 2];
    }
    // Weights average to one, and the mean z is d cos(phase).
    assert.ok(Math.abs(sum / N - 1) < 0.02, `phase ${phase}: mean weight ${sum / N}`);
    assert.ok(Math.abs(z / sum - dz * Math.cos(phase)) < 0.05, `phase ${phase}: <z> ${z / sum}`);
  }
  for (let k = 0; k < N; k++) assert.ok(s.cross[k] >= -1 - 1e-6 && s.cross[k] <= 1 + 1e-6);
});

test('the mixed slice density is never negative and matches |Psi|^2', () => {
  const pa = makeOrbital(2, 0, 0).psi;
  const pb = makeOrbital(3, 1, 0).psi;
  const pts = [[0.5, 0, 1], [2, 0, -3], [-4, 0, 0.2], [0, 0, 6]];
  const A = Float64Array.from(pts.map(([x, y, z]) => pa(x, y, z)));
  const B = Float64Array.from(pts.map(([x, y, z]) => pb(x, y, z)));
  for (const phase of [0, 1, 2, 3]) {
    const rho = mixedDensity(A, B, phase);
    for (let k = 0; k < pts.length; k++) {
      // |(a + b e^{-i phase}) / sqrt 2|^2
      const re = (A[k] + B[k] * Math.cos(phase)) / Math.SQRT2;
      const im = (B[k] * Math.sin(phase)) / Math.SQRT2;
      assert.ok(Math.abs(rho[k] - (re * re + im * im)) < 1e-15);
      assert.ok(rho[k] >= 0);
    }
  }
});
