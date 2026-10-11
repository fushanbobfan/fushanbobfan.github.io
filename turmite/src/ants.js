// Arranging starting ants: ready-made layouts, and clicking cells to add,
// turn and remove them.

import { MAX_ANTS } from './share.js';

export const LAYOUTS = {
  single: () => [{ x: 0, y: 0, dir: 0 }],
  // Side by side, all facing up, `gap` cells apart, centred on the origin.
  line: (n, gap = 6) =>
    Array.from({ length: n }, (_, i) => ({ x: Math.round((i - (n - 1) / 2) * gap), y: 0, dir: 0 })),
  // Back to back: two ants on one cell would collide, so they start one
  // cell apart facing away from each other.
  pair: () => [{ x: 0, y: 0, dir: 0 }, { x: 1, y: 0, dir: 2 }],
  // Evenly round a circle, each facing along it clockwise.
  ring: (n, radius = 10) =>
    Array.from({ length: n }, (_, i) => {
      const t = (2 * Math.PI * i) / n;
      const x = Math.round(radius * Math.sin(t)) || 0;
      const y = Math.round(-radius * Math.cos(t)) || 0;
      // Tangent (cos t, sin t) rounded to the nearest of the four directions.
      const dir = (Math.round(t / (Math.PI / 2)) + 1) % 4;
      return { x, y, dir };
    }),
};

// Click on a cell: no ant there adds one facing up; an ant there turns a
// quarter right, and after facing left it is removed.
export function toggleAnt(ants, x, y) {
  const i = ants.findIndex((a) => a.x === x && a.y === y);
  if (i < 0) {
    return ants.length >= MAX_ANTS ? ants : [...ants, { x, y, dir: 0 }];
  }
  const a = ants[i];
  if (a.dir === 3) return ants.filter((_, j) => j !== i);
  return ants.map((b, j) => (j === i ? { ...b, dir: b.dir + 1 } : b));
}
