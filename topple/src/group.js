import { createPile, setCells, stabilize, relax, THRESHOLD } from './sandpile.js';

// The recurrent configurations of a sandpile form a finite Abelian group
// under "add cell by cell, then stabilize". These helpers compute its
// identity and test membership. Each takes an optional mask of the cells
// that hold sand; switched-off cells always read zero.

// Stabilized sum of two configurations of the same size.
export function add(width, height, a, b, mask = null) {
  const pile = createPile(width, height, mask);
  const sum = new Uint32Array(a.length);
  for (let i = 0; i < a.length; i++) sum[i] = a[i] + b[i];
  setCells(pile, sum);
  stabilize(pile);
  return pile.cells;
}

function stabilized(width, height, values, mask) {
  const pile = createPile(width, height, mask);
  setCells(pile, values);
  stabilize(pile);
  return pile.cells;
}

// Identity element: e = stab(2m - stab(2m)) where m is the maximal stable
// configuration (three grains everywhere). 2m - stab(2m) is recurrent and
// equivalent to zero, so stabilizing it lands on the identity.
export function identity(width, height, mask = null) {
  const n = width * height;
  const twice = new Uint32Array(n);
  for (let i = 0; i < n; i++) twice[i] = !mask || mask[i] ? 2 * (THRESHOLD - 1) : 0;
  const s = stabilized(width, height, twice, mask);
  const diff = new Uint32Array(n);
  for (let i = 0; i < n; i++) diff[i] = twice[i] - s[i];
  return stabilized(width, height, diff, mask);
}

// Number of edges from each switched-on cell to the sink: neighbours past
// the grid edge or switched off (0 inside, 1 on a side, 2 at a corner).
export function sinkEdges(width, height, mask = null) {
  const on = (x, y) => x >= 0 && y >= 0 && x < width && y < height && (!mask || mask[y * width + x]);
  const out = new Uint32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!on(x, y)) continue;
      out[y * width + x] = !on(x - 1, y) + !on(x + 1, y) + !on(x, y - 1) + !on(x, y + 1);
    }
  }
  return out;
}

// Dhar's burning test: a stable configuration is recurrent exactly when
// adding the sink edges makes every cell topple once and returns the same
// configuration.
export function isRecurrent(width, height, cells, mask = null) {
  const n = width * height;
  let live = 0;
  for (let i = 0; i < n; i++) {
    if (cells[i] >= THRESHOLD) return false;
    if (!mask || mask[i]) live += 1;
    else if (cells[i] !== 0) return false;
  }
  const pile = createPile(width, height, mask);
  const burn = sinkEdges(width, height, mask);
  const start = new Uint32Array(n);
  for (let i = 0; i < n; i++) start[i] = cells[i] + burn[i];
  setCells(pile, start);
  const r = relax(pile);
  if (r.topplings !== live) return false;
  for (let i = 0; i < n; i++) if (pile.cells[i] !== cells[i]) return false;
  return true;
}
