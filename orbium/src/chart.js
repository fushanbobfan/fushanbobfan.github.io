// Geometry for the rule inspector: the kernel's radial profile, the growth
// curve, and a histogram of what the cells currently sense.

import { kernelProfile, growth, growthBand } from './rules.js';

// Maps data coordinates in [x0, x1] x [y0, y1] onto a box, y growing upwards.
export function scaler(box, [x0, x1], [y0, y1]) {
  const sx = box.w / (x1 - x0 || 1);
  const sy = box.h / (y1 - y0 || 1);
  return (x, y) => [box.x + (x - x0) * sx, box.y + box.h - (y - y0) * sy];
}

// Kernel profile from the centre (r = 0) to the rim (r = R), heights in [0, 1].
export function kernelPoints(rings, box, samples = 120) {
  const prof = kernelProfile(rings, samples);
  const map = scaler(box, [0, 1], [0, 1]);
  return Array.from(prof, (v, i) => map(i / (samples - 1), v));
}

// The U axis shown for a rule: up to twice mu, at least wide enough for the band.
export function potentialAxis(mu, sigma) {
  const [, hi] = growthBand(mu, sigma);
  return [0, Math.min(1, Math.max(2 * mu, hi + 2 * sigma))];
}

export function growthPoints(mu, sigma, box, samples = 200) {
  const [u0, u1] = potentialAxis(mu, sigma);
  const map = scaler(box, [u0, u1], [-1, 1]);
  const pts = [];
  for (let i = 0; i < samples; i++) {
    const u = u0 + ((u1 - u0) * i) / (samples - 1);
    pts.push(map(u, growth(u, mu, sigma)));
  }
  return pts;
}

// Counts of `values` falling in `bins` equal bins over [lo, hi]. Values at or
// below `floor` are skipped, so empty space does not swamp the picture.
export function histogram(values, bins, lo, hi, floor = 1e-3) {
  const counts = new Uint32Array(bins);
  const w = (hi - lo) / bins;
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v <= floor || v < lo || v > hi) continue;
    counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++;
    total++;
  }
  return { counts, total };
}

// Share of counted values whose bin lies inside the positive-growth band.
export function shareInBand(hist, lo, hi, mu, sigma) {
  if (hist.total === 0) return 0;
  const [b0, b1] = growthBand(mu, sigma);
  const bins = hist.counts.length;
  const w = (hi - lo) / bins;
  let inside = 0;
  for (let i = 0; i < bins; i++) {
    const mid = lo + (i + 0.5) * w;
    if (mid >= b0 && mid <= b1) inside += hist.counts[i];
  }
  return inside / hist.total;
}
