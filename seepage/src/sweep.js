// Threshold sweep after Newman and Ziff (2000): open the sites (or bonds) of one grid
// one at a time in order of their random numbers, merging clusters as they meet.
// A single pass gives the exact p at which this grid first spans and its largest
// cluster at every p, instead of relabelling the grid for each p separately.

import { createLattice } from './lattice.js';

export const SITE_THRESHOLD = 0.592746; // square-lattice site percolation (numerical estimate)
export const BOND_THRESHOLD = 0.5; // square-lattice bond percolation (exact, Kesten 1980)

const TOP = 1;
const BOTTOM = 2;

function sortedBy(values, count) {
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  order.sort((a, b) => values[a] - values[b]);
  return order;
}

// Returns { threshold, largest } where largest[b] is the largest cluster's share of
// all sites at p = b / (bins - 1), and threshold is the smallest p at which a
// cluster joins the top row to the bottom row.
export function sweepLattice(lat, bins = 101) {
  const { size, mode } = lat;
  const n = size * size;
  const parent = new Int32Array(n);
  const weight = new Int32Array(n);
  const edges = new Uint8Array(n);
  const open = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    parent[i] = i;
    weight[i] = 1;
    if (i < size) edges[i] |= TOP;
    if (i >= n - size) edges[i] |= BOTTOM;
  }
  const find = (i) => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    while (parent[i] !== r) { const next = parent[i]; parent[i] = r; i = next; }
    return r;
  };

  let largest = mode === 'bond' ? 1 : 0;
  let threshold = 1;
  let spanned = false;
  const union = (a, b, u) => {
    let ra = find(a);
    let rb = find(b);
    if (ra === rb) return;
    if (weight[ra] < weight[rb]) [ra, rb] = [rb, ra];
    parent[rb] = ra;
    weight[ra] += weight[rb];
    edges[ra] |= edges[rb];
    if (weight[ra] > largest) largest = weight[ra];
    if (!spanned && edges[ra] === (TOP | BOTTOM)) { spanned = true; threshold = u; }
  };

  // Each step opens one item with random number u; p crosses u just after it.
  const curve = new Float32Array(bins);
  let b = 0;
  const record = (u) => {
    while (b < bins && b / (bins - 1) <= u) curve[b++] = largest / n;
  };

  if (mode === 'site') {
    const order = sortedBy(lat.site, n);
    for (let k = 0; k < n; k++) {
      const i = order[k];
      const u = lat.site[i];
      record(u);
      open[i] = 1;
      if (largest === 0) largest = 1;
      const x = i % size;
      if (x > 0 && open[i - 1]) union(i, i - 1, u);
      if (x < size - 1 && open[i + 1]) union(i, i + 1, u);
      if (i >= size && open[i - size]) union(i, i - size, u);
      if (i < n - size && open[i + size]) union(i, i + size, u);
    }
  } else {
    // Bonds 0..n-1 are right[i], n..2n-1 are down[i]; bonds off the grid have u = 1.
    const values = new Float32Array(2 * n);
    values.set(lat.right, 0);
    values.set(lat.down, n);
    const order = sortedBy(values, 2 * n);
    for (let k = 0; k < 2 * n; k++) {
      const j = order[k];
      const u = values[j];
      if (u >= 1) break;
      record(u);
      if (j < n) union(j, j + 1, u);
      else union(j - n, j - n + size, u);
    }
  }
  while (b < bins) curve[b++] = largest / n;
  return { threshold, largest: curve };
}

// Seed of grid number t in a sweep that starts from `seed`.
export function trialSeed(seed, t) {
  return (seed + Math.imul(t + 1, 0x9e3779b1)) >>> 0;
}

// Runs `trials` independent grids. `onTrial` (optional) sees each result as it
// lands, so a page can show the estimate building up.
export function runSweep({ size, mode = 'site', trials, seed = 1, bins = 101 }, onTrial) {
  const acc = createAccumulator(bins);
  for (let t = 0; t < trials; t++) {
    const lat = createLattice({ size, mode, seed: trialSeed(seed, t) });
    const r = sweepLattice(lat, bins);
    addTrial(acc, r);
    if (onTrial) onTrial(r, t);
  }
  return summariseSweep(acc);
}

export function createAccumulator(bins = 101) {
  return { bins, trials: 0, thresholds: [], largest: new Float64Array(bins) };
}

export function addTrial(acc, { threshold, largest }) {
  acc.trials++;
  acc.thresholds.push(threshold);
  for (let b = 0; b < acc.bins; b++) acc.largest[b] += largest[b];
}

// Spanning probability R(p): the share of grids that already span at p.
export function summariseSweep(acc) {
  const { bins, trials, thresholds } = acc;
  const p = Array.from({ length: bins }, (_, b) => b / (bins - 1));
  const spanning = p.map((x) => (trials ? thresholds.filter((t) => t < x).length / trials : 0));
  const largest = p.map((_, b) => (trials ? acc.largest[b] / trials : 0));
  const mean = trials ? thresholds.reduce((s, t) => s + t, 0) / trials : NaN;
  const variance = trials > 1 ? thresholds.reduce((s, t) => s + (t - mean) ** 2, 0) / (trials - 1) : NaN;
  const sd = Math.sqrt(variance);
  return {
    trials,
    p,
    spanning,
    largest,
    mean,
    sd,
    stderr: trials > 1 ? sd / Math.sqrt(trials) : NaN,
    median: trials ? median(thresholds) : NaN,
  };
}

function median(values) {
  const s = values.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
