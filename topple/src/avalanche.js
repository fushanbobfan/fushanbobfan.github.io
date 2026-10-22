import { addGrains, relax } from './sandpile.js';

// Avalanche bookkeeping for the slowly driven pile: drop one grain, let the
// pile settle completely, and record how big the response was.

export function createTracker(pile) {
  return { mark: new Uint32Array(pile.cells.length), gen: 0, count: 0 };
}

// size: number of topplings; area: distinct cells that toppled at least once;
// lost: grains that left over the edge.
export function dropGrain(pile, i, tracker) {
  tracker.gen += 1;
  if (tracker.gen === 0xffffffff) {
    tracker.mark.fill(0);
    tracker.gen = 1;
  }
  tracker.count = 0;
  addGrains(pile, i, 1);
  const r = relax(pile, Infinity, tracker);
  return { size: r.topplings, area: tracker.count, lost: r.lost };
}

// Deterministic pseudo-random site picker (mulberry32) so a run can be
// replayed from its seed.
export function siteRandom(seed) {
  let a = seed >>> 0;
  return function next(n) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(u * n);
  };
}
