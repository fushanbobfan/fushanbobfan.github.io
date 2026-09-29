import { createPile, setCells, stabilize, relax, THRESHOLD } from './sandpile.js';

// The recurrent configurations of a sandpile form a finite Abelian group
// under "add cell by cell, then stabilize". These helpers compute its
// identity and test membership.

// Stabilized sum of two configurations of the same size.
export function add(width, height, a, b) {
  const pile = createPile(width, height);
  const sum = new Uint32Array(a.length);
  for (let i = 0; i < a.length; i++) sum[i] = a[i] + b[i];
  setCells(pile, sum);
  stabilize(pile);
  return pile.cells;
}

function stabilized(width, height, values) {
  const pile = createPile(width, height);
  setCells(pile, values);
  stabilize(pile);
  return pile.cells;
}

// Identity element: e = stab(2m - stab(2m)) where m is the maximal stable
// configuration (three grains everywhere). 2m - stab(2m) is recurrent and
// equivalent to zero, so stabilizing it lands on the identity.
export function identity(width, height) {
  const n = width * height;
  const twice = new Uint32Array(n).fill(2 * (THRESHOLD - 1));
  const s = stabilized(width, height, twice);
  const diff = new Uint32Array(n);
  for (let i = 0; i < n; i++) diff[i] = twice[i] - s[i];
  return stabilized(width, height, diff);
}

// Number of edges from each cell to the sink (0 inside, 1 on an edge, 2 at a
// corner; a 1-wide grid counts both sides).
export function sinkEdges(width, height) {
  const out = new Uint32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out[y * width + x] = (x === 0) + (x === width - 1) + (y === 0) + (y === height - 1);
    }
  }
  return out;
}

// Dhar's burning test: a stable configuration is recurrent exactly when
// adding the sink edges makes every cell topple once and returns the same
// configuration.
export function isRecurrent(width, height, cells) {
  const n = width * height;
  for (let i = 0; i < n; i++) if (cells[i] >= THRESHOLD) return false;
  const pile = createPile(width, height);
  const burn = sinkEdges(width, height);
  const start = new Uint32Array(n);
  for (let i = 0; i < n; i++) start[i] = cells[i] + burn[i];
  setCells(pile, start);
  const r = relax(pile);
  if (r.topplings !== n) return false;
  for (let i = 0; i < n; i++) if (pile.cells[i] !== cells[i]) return false;
  return true;
}
