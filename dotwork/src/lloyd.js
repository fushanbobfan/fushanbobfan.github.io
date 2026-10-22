// Weighted Voronoi stippling (Secord, NPAR 2002). Dots start scattered in
// proportion to the ink density, then each round moves every dot to the
// density-weighted centroid of its Voronoi cell. Dark regions pull their dots
// together, pale regions let them drift apart, and the spacing settles into an
// even, blue-noise-like pattern whose local density follows the picture.

import { labelPixels } from './voronoi.js';

// Rejection sampling: pick a random pixel, keep it with probability
// density / max, and jitter the dot inside that pixel. A blank field falls back
// to an even scatter so there is always something to relax.
export function seedPoints(field, count, rng) {
  const { width, height, data } = field;
  let max = 0;
  for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
  const points = new Float64Array(2 * count);
  const limit = count * 2000;
  let tries = 0;
  for (let i = 0; i < count; ) {
    const px = Math.floor(rng.next() * width);
    const py = Math.floor(rng.next() * height);
    tries++;
    if (max > 0 && tries < limit && rng.next() * max >= data[py * width + px]) continue;
    points[2 * i] = px + rng.next();
    points[2 * i + 1] = py + rng.next();
    i++;
  }
  return points;
}

// Per-dot sums over its cell, kept for dot sizing and the readouts.
export function createStats(count) {
  return {
    mass: new Float64Array(count),
    area: new Float64Array(count),
    sx: new Float64Array(count),
    sy: new Float64Array(count),
  };
}

export function gatherCells(field, points, count, labels, stats) {
  const { width, height, data } = field;
  const s = stats && stats.mass.length === count ? stats : createStats(count);
  s.mass.fill(0);
  s.area.fill(0);
  s.sx.fill(0);
  s.sy.fill(0);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const p = py * width + px;
      const k = labels[p];
      if (k < 0) continue;
      const w = data[p];
      s.area[k] += 1;
      s.mass[k] += w;
      s.sx[k] += w * (px + 0.5);
      s.sy[k] += w * (py + 0.5);
    }
  }
  return s;
}

// One relaxation round. Dots whose cell holds no ink stay where they are.
// Returns the mean and largest move in pixels so callers can watch it settle.
export function relax(field, points, count, scratch = {}) {
  const labels = labelPixels(points, count, field.width, field.height, scratch.labels, field.data);
  const stats = gatherCells(field, points, count, labels, scratch.stats);
  let total = 0;
  let largest = 0;
  for (let i = 0; i < count; i++) {
    if (stats.mass[i] <= 0) continue;
    const nx = stats.sx[i] / stats.mass[i];
    const ny = stats.sy[i] / stats.mass[i];
    const d = Math.hypot(nx - points[2 * i], ny - points[2 * i + 1]);
    total += d;
    if (d > largest) largest = d;
    points[2 * i] = nx;
    points[2 * i + 1] = ny;
  }
  scratch.labels = labels;
  scratch.stats = stats;
  return { meanMove: count ? total / count : 0, maxMove: largest, labels, stats };
}
