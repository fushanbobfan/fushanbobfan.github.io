// Scenes: what hangs, where it is pinned, and the weather it hangs in.
// The world is WORLD.width x WORLD.height metres with the floor near the bottom.

import { createCloth } from './cloth.js';

export const WORLD = { width: 3.2, height: 2.2, floor: 2.12 };

export const PRESETS = {
  curtain: {
    label: 'Curtain on rings',
    cols: 46, rows: 30, spacing: 0.045,
    pins: (i, j, cols) => j === 0 && (i % 5 === 0 || i === cols - 1),
    gather: 0.7,
    wind: 0,
  },
  banner: {
    label: 'Banner on four hooks',
    cols: 40, rows: 22, spacing: 0.05,
    pins: (i, j, cols) => j === 0 && i % 13 === 0,
    wind: 0,
  },
  flag: {
    label: 'Flag in the wind',
    cols: 40, rows: 24, spacing: 0.04,
    pins: (i) => i === 0,
    wind: 16,
  },
  chain: {
    label: 'Chain between two pins',
    cols: 61, rows: 1, spacing: 0.04,
    pins: (i, j, cols) => i === 0 || i === cols - 1,
    gather: 0.7,
    wind: 0,
  },
  sheet: {
    label: 'Sheet on a line',
    cols: 44, rows: 26, spacing: 0.045,
    pins: (i, j) => j === 0,
    wind: 2,
  },
};

// A ball resting on the floor to the right of every scene: drag it into the
// cloth to push it around.
export const BALL = { x: 2.75, y: 1.84, r: 0.28 };

export function newBall() {
  return { ...BALL };
}

export function buildScene(name) {
  const p = PRESETS[name];
  if (!p) throw new Error(`unknown scene: ${name}`);
  const gather = p.gather ?? 1;
  const w = (p.cols - 1) * p.spacing * gather;
  const left = name === 'flag' ? 0.5 : (WORLD.width - w) / 2;
  const top = 0.18;
  const c = createCloth({ cols: p.cols, rows: p.rows, spacing: p.spacing, left, top, pins: p.pins });
  // A gathered curtain hangs from a rod shorter than the cloth is wide, so the
  // whole cloth starts squeezed sideways and falls into folds.
  if (gather !== 1) {
    for (let k = 0; k < c.n; k++) {
      c.x[k] = left + (c.x[k] - left) * gather;
      c.px[k] = c.x[k];
    }
  }
  return c;
}
