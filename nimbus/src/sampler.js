// Draws electron positions from |psi|^2 exactly: the radius by rejection
// under a step-shaped envelope of the radial distribution, the direction from
// Y^2 by rejection on the sphere. The two factors are independent, so the product
// is the full three-dimensional density.

import { radialTable, radial, radialNorm, radialDensity, realHarmonic, harmonicNorm } from './hydrogen.js';

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

// A constant ceiling over each cell of the radial grid, a little above the
// largest r^2 R^2 in the cell, and the running total of ceiling x width.
// The cells are so narrow that a 6% margin over the endpoint and midpoint
// values clears every peak (checked in the tests).
export const ENVELOPE_MARGIN = 1.06;

export function radialEnvelope(n, l, table = radialTable(n, l)) {
  if (table.envelope) return table.envelope;
  const { r, p } = table;
  const cells = r.length - 1;
  const ceiling = new Float64Array(cells);
  const cumulative = new Float64Array(cells + 1);
  for (let i = 0; i < cells; i++) {
    const mid = radialDensity(n, l, 0.5 * (r[i] + r[i + 1]));
    ceiling[i] = ENVELOPE_MARGIN * Math.max(p[i], p[i + 1], mid);
    cumulative[i + 1] = cumulative[i] + ceiling[i] * (r[i + 1] - r[i]);
  }
  table.envelope = { r, ceiling, cumulative };
  return table.envelope;
}

// Picks a cell in proportion to its share of the envelope, a uniform radius
// inside it, and keeps it with probability r^2 R^2 / ceiling. The kept radii
// follow r^2 R^2 exactly on [0, rMax]; beyond rMax lies less than 1e-15 of
// the electron (see the tests).
export function sampleRadius(n, l, envelope, rn, rand) {
  const { r, ceiling, cumulative } = envelope;
  const total = cumulative[cumulative.length - 1];
  for (;;) {
    const u = rand() * total;
    let lo = 0;
    let hi = ceiling.length;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] <= u) lo = mid;
      else hi = mid;
    }
    const radius = r[lo] + rand() * (r[lo + 1] - r[lo]);
    const R = radial(n, l, radius, rn);
    if (rand() * ceiling[lo] < radius * radius * R * R) return radius;
  }
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
  const envelope = radialEnvelope(n, l, table);
  let tries = 0;
  for (let k = 0; k < count; k++) {
    const radius = sampleRadius(n, l, envelope, rn, rand);

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
