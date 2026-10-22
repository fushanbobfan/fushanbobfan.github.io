// Counting tiles. Each substitution step turns a half kite into two half
// kites and a half dart, and a half dart into one of each (likewise thick
// and thin rhombi), so the counts are Fibonacci numbers and their ratio
// tends to the golden ratio.

import { PHI, SEEDS, SYSTEMS } from './tiling.js';

const RULES = {
  kite: { kite: 2, dart: 1 },
  dart: { kite: 1, dart: 1 },
  thick: { thick: 2, thin: 1 },
  thin: { thick: 1, thin: 1 },
};

// Half-tile counts in the whole patch after `generations` steps.
export function halfCounts(seedId, generations) {
  const seed = SEEDS[seedId];
  let counts = {};
  for (const k of SYSTEMS[seed.system].kinds) counts[k] = 0;
  for (const t of seed.build()) counts[t.kind]++;
  for (let g = 0; g < generations; g++) {
    const next = {};
    for (const k of Object.keys(counts)) next[k] = 0;
    for (const [k, n] of Object.entries(counts)) {
      for (const [child, m] of Object.entries(RULES[k])) next[child] += n * m;
    }
    counts = next;
  }
  return counts;
}

// The more common tile first: kites outnumber darts, thick rhombi outnumber
// thin ones.
export const MAJOR = { p2: ['kite', 'dart'], p3: ['thick', 'thin'] };

export function summarise({ tiles, halves = [] }, system) {
  const [major, minor] = MAJOR[system];
  const whole = { [major]: 0, [minor]: 0 };
  for (const t of tiles) whole[t.kind]++;
  const partial = { [major]: 0, [minor]: 0 };
  for (const h of halves) partial[h.kind]++;
  const ratio = whole[minor] > 0 ? whole[major] / whole[minor] : null;
  return {
    major,
    minor,
    whole,
    partial,
    ratio,
    error: ratio === null ? null : ratio - PHI,
  };
}

export function patchRatio(seedId, generations) {
  const [major, minor] = MAJOR[SEEDS[seedId].system];
  const c = halfCounts(seedId, generations);
  return c[minor] > 0 ? c[major] / c[minor] : null;
}
