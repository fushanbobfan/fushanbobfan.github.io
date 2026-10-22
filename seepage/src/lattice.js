// A square grid where every site (or every bond) gets one random number u in [0, 1).
// A site or bond is open at probability p when u < p, so raising p only ever opens
// more of the same grid: clusters grow and merge instead of being redrawn.

import { mulberry32 } from './rng.js';

export const MODES = ['site', 'bond'];
export const MIN_SIZE = 8;
export const MAX_SIZE = 512;

export function createLattice({ size, mode = 'site', seed = 1 }) {
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    throw new RangeError(`size must be a whole number from ${MIN_SIZE} to ${MAX_SIZE}`);
  }
  if (!MODES.includes(mode)) throw new RangeError(`unknown mode ${mode}`);
  const rand = mulberry32(seed);
  const n = size * size;
  if (mode === 'site') {
    const site = new Float32Array(n);
    for (let i = 0; i < n; i++) site[i] = rand();
    return { size, mode, seed, site, right: null, down: null };
  }
  // Bond i -> i + 1 is right[i]; bond i -> i + size is down[i]. Bonds that would
  // leave the grid get u = 1 and so never open.
  const right = new Float32Array(n);
  const down = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % size;
    const y = (i - x) / size;
    right[i] = x < size - 1 ? rand() : 1;
    down[i] = y < size - 1 ? rand() : 1;
  }
  return { size, mode, seed, site: null, right, down };
}

export function siteOpen(lat, i, p) {
  return lat.mode === 'bond' || lat.site[i] < p;
}

export function rightOpen(lat, i, p) {
  if (lat.mode === 'bond') return lat.right[i] < p;
  const x = i % lat.size;
  return x < lat.size - 1 && lat.site[i] < p && lat.site[i + 1] < p;
}

export function downOpen(lat, i, p) {
  if (lat.mode === 'bond') return lat.down[i] < p;
  return i + lat.size < lat.site.length && lat.site[i] < p && lat.site[i + lat.size] < p;
}

export function openFraction(lat, p) {
  if (lat.mode === 'site') {
    let k = 0;
    for (const u of lat.site) if (u < p) k++;
    return k / lat.site.length;
  }
  let k = 0;
  let total = 0;
  for (let i = 0; i < lat.right.length; i++) {
    if (lat.right[i] < 1) { total++; if (lat.right[i] < p) k++; }
    if (lat.down[i] < 1) { total++; if (lat.down[i] < p) k++; }
  }
  return k / total;
}
