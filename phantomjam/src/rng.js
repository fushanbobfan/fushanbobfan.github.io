// mulberry32: a tiny seeded PRNG so a given seed always lays out the same
// road and dawdles at the same moments. Returns a function yielding floats
// in [0, 1).
export function createRng(seed = 1) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [0, n). */
export function randomInt(rng, n) {
  return Math.floor(rng() * n);
}

/** Fisher–Yates shuffle in place, driven by the given generator. */
export function shuffle(rng, items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}
