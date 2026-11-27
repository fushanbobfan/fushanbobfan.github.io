// Draws electron positions from |psi|^2 exactly: the radius from the radial
// distribution by inverting its cumulative table, the direction from Y^2 by
// rejection on the sphere. The two factors are independent, so the product
// is the full three-dimensional density.

import { radialTable, radial, radialNorm, realHarmonic, harmonicNorm } from './hydrogen.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function angularPeak(l, m) {
  const norm = harmonicNorm(l, m);
  let best = 0;
  const nc = 361;
  const np = 360;
  for (let i = 0; i < nc; i++) {
    const c = -1 + (2 * i) / (nc - 1);
    for (let j = 0; j < np; j++) {
      const v = realHarmonic(l, m, c, (2 * Math.PI * j) / np, norm);
      if (v * v > best) best = v * v;
    }
  }
  return best;
}

// Returns positions (x, y, z interleaved) and the sign of psi at each.
export function sampleOrbital(n, l, m, count, seed = 1, table = radialTable(n, l)) {
  const rand = mulberry32(seed);
  const norm = harmonicNorm(l, m);
  const rn = radialNorm(n, l);
  const ceiling = angularPeak(l, m) * 1.02;
  const positions = new Float32Array(count * 3);
  const signs = new Int8Array(count);
  const radii = new Float32Array(count);
  const { r, cdf } = table;
  let tries = 0;
  for (let k = 0; k < count; k++) {
    const u = rand();
    let lo = 0;
    let hi = cdf.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < u) lo = mid;
      else hi = mid;
    }
    const span = cdf[hi] - cdf[lo];
    const radius = r[lo] + (span > 0 ? (u - cdf[lo]) / span : 0) * (r[hi] - r[lo]);

    let c;
    let phi;
    let y;
    do {
      c = 2 * rand() - 1;
      phi = 2 * Math.PI * rand();
      y = realHarmonic(l, m, c, phi, norm);
      tries++;
    } while (rand() * ceiling > y * y);

    const s = Math.sqrt(Math.max(0, 1 - c * c));
    positions[3 * k] = radius * s * Math.cos(phi);
    positions[3 * k + 1] = radius * s * Math.sin(phi);
    positions[3 * k + 2] = radius * c;
    radii[k] = radius;
    // The radial factor's sign flips at each spherical node.
    const radialSign = radial(n, l, Math.max(radius, 1e-9), rn) >= 0 ? 1 : -1;
    signs[k] = y >= 0 ? radialSign : -radialSign;
  }
  return { positions, signs, radii, count, acceptance: count / tries };
}

// Highest value of |psi|^2 anywhere: the largest R^2 on the radial grid
// (at the nucleus for s orbitals) times the angular peak.
export function peakDensity(n, l, m, table = radialTable(n, l)) {
  const rn = radialNorm(n, l);
  let best = 0;
  for (let i = 0; i < table.r.length; i++) {
    const v = radial(n, l, table.r[i], rn);
    if (v * v > best) best = v * v;
  }
  return best * angularPeak(l, m);
}
