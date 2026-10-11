// Arranging starting ants: ready-made layouts, and clicking cells to add,
// turn and remove them. Square directions start at up; hexagonal ones at
// east (see colony.js).

import { MAX_ANTS } from './share.js';
import { hexRound } from './render.js';

const HEX_NORTH_EAST = 5;

// The cell nearest a world point (square cells are one unit, centred at
// integer coordinates here so layouts stay symmetric about the origin).
function cellNear(lattice, wx, wy) {
  return lattice === 'hex' ? hexRound(wx, wy) : { x: Math.round(wx) || 0, y: Math.round(wy) || 0 };
}

// Direction closest to a screen angle in radians, clockwise from east.
function dirToward(lattice, angle) {
  const turn = 2 * Math.PI;
  const a = ((angle % turn) + turn) % turn;
  if (lattice === 'hex') return Math.round(a / (Math.PI / 3)) % 6;
  return (Math.round(a / (Math.PI / 2)) + 1) % 4;
}

export const LAYOUTS = {
  single: () => [{ x: 0, y: 0, dir: 0 }],
  // Side by side along a row, `gap` cells apart, centred on the origin, all
  // facing up (north-east on hexagons).
  line: (n, lattice = 'square', gap = 6) =>
    Array.from({ length: n }, (_, i) => ({
      x: Math.round((i - (n - 1) / 2) * gap),
      y: 0,
      dir: lattice === 'hex' ? HEX_NORTH_EAST : 0,
    })),
  // Neighbours facing opposite ways: two ants on one cell would collide.
  pair: (_n, lattice = 'square') =>
    lattice === 'hex'
      ? [{ x: 0, y: 0, dir: HEX_NORTH_EAST }, { x: 1, y: 0, dir: 2 }]
      : [{ x: 0, y: 0, dir: 0 }, { x: 1, y: 0, dir: 2 }],
  // Evenly round a circle, each facing along it clockwise.
  ring: (n, lattice = 'square', radius = 10) =>
    Array.from({ length: n }, (_, i) => {
      const t = (2 * Math.PI * i) / n;
      const { x, y } = cellNear(lattice, radius * Math.sin(t), -radius * Math.cos(t));
      // Moving clockwise from angle t the tangent points at screen angle t.
      return { x, y, dir: dirToward(lattice, t) };
    }),
};

// Click on a cell: no ant there adds one facing the first direction; an ant
// there turns one step right, and after the last direction it is removed.
export function toggleAnt(ants, x, y, directions = 4) {
  const i = ants.findIndex((a) => a.x === x && a.y === y);
  if (i < 0) {
    return ants.length >= MAX_ANTS ? ants : [...ants, { x, y, dir: 0 }];
  }
  const a = ants[i];
  if (a.dir === directions - 1) return ants.filter((_, j) => j !== i);
  return ants.map((b, j) => (j === i ? { ...b, dir: b.dir + 1 } : b));
}
