// An electron in an equal mix of two orbitals a and b:
// Psi = (psi_a e^{-i E_a t / hbar} + psi_b e^{-i E_b t / hbar}) / sqrt 2.
// With real orbitals the density is
// rho = (psi_a^2 + psi_b^2) / 2 + psi_a psi_b cos(omega t),
// so it sloshes back and forth at omega = (E_b - E_a) / hbar, the frequency of
// the light the atom gives out when it drops from one orbital to the other.

import { RYDBERG_EV, makeOrbital, radial, radialNorm, realHarmonic, harmonicNorm, energyEV } from './hydrogen.js';
import { sampleOrbital } from './sampler.js';

export const HC_EV_NM = 1239.84198433; // h c, exact SI
export const PLANCK_EV_S = 4.135667696e-15; // h, exact SI
export const ELECTRON_PROTON_MASS_RATIO = 1 / 1836.15267343; // CODATA 2018
export const FINE_STRUCTURE = 1 / 137.035999084; // CODATA 2018
export const ATOMIC_TIME_S = 2.4188843265857e-17; // hbar / E_h

// Spectral lines use the reduced mass, because the proton moves too; this
// moves every wavelength 0.054% longer than the fixed-nucleus value.
export const RYDBERG_HYDROGEN_EV = RYDBERG_EV / (1 + ELECTRON_PROTON_MASS_RATIO);

export const SERIES = ['Lyman', 'Balmer', 'Paschen', 'Brackett', 'Pfund', 'Humphreys'];

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

const GL = gaussLegendre(16);
const N_PHI = 32;

// Integral over the sphere of Y_a Y_b times the unit vector (x, y, z) / r.
// The integrand is a polynomial of degree at most 11 in cos(theta) and a
// trigonometric polynomial of order at most 11 in phi, which 16 Gauss-Legendre
// nodes and 32 equally spaced angles integrate exactly.
export function angularDipole(la, ma, lb, mb) {
  const na = harmonicNorm(la, ma);
  const nb = harmonicNorm(lb, mb);
  const out = [0, 0, 0];
  for (let i = 0; i < GL.x.length; i++) {
    const c = GL.x[i];
    const s = Math.sqrt(1 - c * c);
    for (let j = 0; j < N_PHI; j++) {
      const phi = (2 * Math.PI * (j + 0.5)) / N_PHI;
      const w = (GL.w[i] * 2 * Math.PI) / N_PHI;
      const f = w * realHarmonic(la, ma, c, phi, na) * realHarmonic(lb, mb, c, phi, nb);
      out[0] += f * s * Math.cos(phi);
      out[1] += f * s * Math.sin(phi);
      out[2] += f * c;
    }
  }
  return out.map((v) => (Math.abs(v) < 1e-13 ? 0 : v));
}

// Integral of r^3 R_a R_b dr, by Simpson's rule far into the tail.
export function radialDipole(na, la, nb, lb) {
  const top = Math.max(na, nb) * (3 * Math.max(na, nb) + 20);
  const steps = 20000;
  const h = top / steps;
  const ra = radialNorm(na, la);
  const rb = radialNorm(nb, lb);
  const f = (r) => r * r * r * radial(na, la, r, ra) * radial(nb, lb, r, rb);
  let s = f(0) + f(top);
  for (let i = 1; i < steps; i++) s += f(i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

// <a| r |b> in Bohr radii, a vector because the real orbitals pick out axes.
export function dipoleElement(a, b) {
  const ang = angularDipole(a.l, a.m, b.l, b.m);
  if (ang.every((v) => v === 0)) return [0, 0, 0];
  const rad = radialDipole(a.n, a.l, b.n, b.l);
  return ang.map((v) => v * rad);
}

export function transition(a, b) {
  const [lo, hi] = a.n <= b.n ? [a, b] : [b, a];
  const sameShell = lo.n === hi.n;
  const dipole = dipoleElement(a, b);
  const d2 = dipole.reduce((s, v) => s + v * v, 0);
  const result = { sameShell, dipole, dipoleSize: Math.sqrt(d2), allowed: d2 > 1e-18, lower: lo, upper: hi };
  if (sameShell) return result;
  const photonEV = RYDBERG_HYDROGEN_EV * (1 / (lo.n * lo.n) - 1 / (hi.n * hi.n));
  const fixedEV = energyEV(hi.n) - energyEV(lo.n);
  // Spontaneous emission rate from the upper orbital into the lower one alone:
  // A = (4/3) alpha^3 omega^3 |d|^2 in atomic units (fixed nucleus).
  const omegaAU = fixedEV / (2 * RYDBERG_EV);
  const rate = ((4 / 3) * FINE_STRUCTURE ** 3 * omegaAU ** 3 * d2) / ATOMIC_TIME_S;
  return {
    ...result,
    photonEV,
    wavelengthNm: HC_EV_NM / photonEV,
    frequencyHz: photonEV / PLANCK_EV_S,
    periodFs: (PLANCK_EV_S / photonEV) * 1e15,
    series: SERIES[lo.n - 1],
    rate,
  };
}

export function bandOf(nm) {
  if (nm < 380) return 'ultraviolet';
  if (nm > 750) return 'infrared';
  if (nm < 450) return 'visible, violet';
  if (nm < 495) return 'visible, blue';
  if (nm < 570) return 'visible, green';
  if (nm < 590) return 'visible, yellow';
  if (nm < 620) return 'visible, orange';
  return 'visible, red';
}

// Points drawn half from each orbital, so from q_a psi_a^2 + q_b psi_b^2 with
// q the actual shares of the dots (one half each for an even count). Each
// dot's weight at any moment is rho(t) divided by that blend, base + cross
// cos(omega t), so the weighted cloud is an unbiased sample of rho(t) at every
// moment without being drawn again. For an even split the weight runs from
// 0 to 2.
export function mixedSample(a, b, count, seed = 1) {
  // The 1/sqrt 2 normalisation needs two different (orthogonal) orbitals.
  if (a.n === b.n && a.l === b.l && a.m === b.m) throw new RangeError('mix two different orbitals');
  const half = Math.floor(count / 2);
  const sa = sampleOrbital(a.n, a.l, a.m, half, seed);
  const sb = sampleOrbital(b.n, b.l, b.m, count - half, seed + 7919);
  const positions = new Float32Array(count * 3);
  positions.set(sa.positions, 0);
  positions.set(sb.positions, half * 3);
  const oa = makeOrbital(a.n, a.l, a.m);
  const ob = makeOrbital(b.n, b.l, b.m);
  const qa = half / count;
  const qb = 1 - qa;
  const base = new Float32Array(count);
  const cross = new Float32Array(count);
  const radii = new Float32Array(count);
  radii.set(sa.radii, 0);
  radii.set(sb.radii, half);
  for (let k = 0; k < count; k++) {
    const x = positions[3 * k];
    const y = positions[3 * k + 1];
    const z = positions[3 * k + 2];
    const pa = oa.psi(x, y, z);
    const pb = ob.psi(x, y, z);
    const blend = qa * pa * pa + qb * pb * pb;
    base[k] = blend > 0 ? (0.5 * (pa * pa + pb * pb)) / blend : 0;
    cross[k] = blend > 0 ? (pa * pb) / blend : 0;
  }
  const tries = half / sa.acceptance + (count - half) / sb.acceptance;
  return { positions, base, cross, radii, count, acceptance: count / tries };
}

export function weightsAt(sample, phase, out = new Float32Array(sample.count)) {
  const c = Math.cos(phase);
  for (let k = 0; k < sample.count; k++) out[k] = sample.base[k] + sample.cross[k] * c;
  return out;
}

// Density on a slice from the two orbitals' own slices.
export function mixedDensity(valuesA, valuesB, phase, out = new Float64Array(valuesA.length)) {
  const c = Math.cos(phase);
  for (let k = 0; k < valuesA.length; k++) {
    const a = valuesA[k];
    const b = valuesB[k];
    out[k] = 0.5 * (a * a + b * b) + a * b * c;
  }
  return out;
}
