// Hybrid orbitals: fixed real mixes of the s and p orbitals of one shell.
// In hydrogen ns and np have the same energy, so each hybrid is itself an
// exact stationary state, and a set of them is just another orthonormal
// basis for the shell's s and p orbitals.

import { makeOrbital, radialTable } from './hydrogen.js';
import { sampleOrbital } from './sampler.js';

// Coefficients on (s, p x, p y, p z); each row is one hybrid.
const r2 = Math.SQRT1_2;
const r3 = 1 / Math.sqrt(3);
const r6 = 1 / Math.sqrt(6);
export const HYBRIDS = {
  sp: {
    label: 'sp',
    angle: 180,
    rows: [
      [r2, 0, 0, r2],
      [r2, 0, 0, -r2],
    ],
  },
  sp2: {
    label: 'sp²',
    angle: 120,
    rows: [
      [r3, 2 * r6, 0, 0],
      [r3, -r6, r2, 0],
      [r3, -r6, -r2, 0],
    ],
  },
  sp3: {
    label: 'sp³',
    angle: (Math.acos(-1 / 3) * 180) / Math.PI,
    rows: [
      [0.5, 0.5, 0.5, 0.5],
      [0.5, 0.5, -0.5, -0.5],
      [0.5, -0.5, 0.5, -0.5],
      [0.5, -0.5, -0.5, 0.5],
    ],
  },
};

const BASIS = [[0, 0], [1, 1], [1, -1], [1, 0]]; // (l, m) of s, p x, p y, p z

// Far from the nucleus, R_ns and R_np have opposite signs in every shell
// (the Laguerre polynomials end in (-rho)^(n-l-1)), so the s part enters with
// a minus sign: then the outer lobes add up along the hybrid's direction.
export function hybridTerms(kind, index, n) {
  if (n < 2) throw new RangeError('hybrids need a shell with p orbitals (n >= 2)');
  const row = HYBRIDS[kind].rows[index];
  return row
    .map((c, i) => ({ c: i === 0 ? -c : c, n, l: BASIS[i][0], m: BASIS[i][1] }))
    .filter((t) => t.c !== 0);
}

// The direction a hybrid points: its p part, as a unit vector.
export function hybridDirection(kind, index) {
  const [, x, y, z] = HYBRIDS[kind].rows[index];
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}

export function sShare(kind) {
  return HYBRIDS[kind].rows[0][0] ** 2;
}

// psi of a real combination sum c_i psi_i.
export function makeCombination(terms) {
  const parts = terms.map((t) => ({ c: t.c, orb: makeOrbital(t.n, t.l, t.m) }));
  return {
    terms,
    psi: (x, y, z) => {
      let v = 0;
      for (const { c, orb } of parts) v += c * orb.psi(x, y, z);
      return v;
    },
    parts,
  };
}

// Dots for a combination of orthonormal orbitals with sum c_i^2 = 1. About a
// c_i^2 share of the dots comes from each orbital; with q_i the actual share
// after rounding, the dots follow sum q_i psi_i^2, and each is weighted by
// (sum c_i psi_i)^2 over that blend, so the weighted cloud is an unbiased
// sample of the combination. Each dot is coloured by the combination's sign.
export function sampleCombination(terms, count, seed = 1) {
  const combo = makeCombination(terms);
  const counts = terms.map((t) => Math.round(t.c * t.c * count));
  counts[counts.length - 1] += count - counts.reduce((a, b) => a + b, 0);
  const positions = new Float32Array(count * 3);
  const radii = new Float32Array(count);
  let at = 0;
  let tries = 0;
  terms.forEach((t, i) => {
    if (counts[i] <= 0) return;
    const s = sampleOrbital(t.n, t.l, t.m, counts[i], seed + 7919 * i, radialTable(t.n, t.l));
    positions.set(s.positions, at * 3);
    radii.set(s.radii, at);
    tries += counts[i] / s.acceptance;
    at += counts[i];
  });
  const shares = counts.map((c) => c / count);
  const weights = new Float32Array(count);
  const signs = new Int8Array(count);
  for (let k = 0; k < count; k++) {
    const x = positions[3 * k];
    const y = positions[3 * k + 1];
    const z = positions[3 * k + 2];
    let v = 0;
    let mix = 0;
    combo.parts.forEach(({ c, orb }, i) => {
      const p = orb.psi(x, y, z);
      v += c * p;
      mix += shares[i] * p * p;
    });
    weights[k] = mix > 0 ? (v * v) / mix : 0;
    signs[k] = v >= 0 ? 1 : -1;
  }
  return { positions, radii, weights, signs, count, acceptance: count / tries };
}
