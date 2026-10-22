// Row patterns: the chance of bouncing right at each row of pegs. `p`
// sets the strength of each pattern; the hand-set pattern keeps whatever
// was painted on the board.

import { mulberry32 } from './rng.js';

export const PATTERNS = ['same', 'alternate', 'ramp', 'random', 'hand'];

export function rowBiases(pattern, rows, p, { seed = 1, custom = [] } = {}) {
  const out = new Array(rows);
  switch (pattern) {
    case 'alternate':
      for (let r = 0; r < rows; r++) out[r] = r % 2 ? 1 - p : p;
      break;
    case 'ramp':
      for (let r = 0; r < rows; r++) out[r] = rows === 1 ? p : p + ((1 - 2 * p) * r) / (rows - 1);
      break;
    case 'random': {
      // Its own stream, so the row chances don't shift the balls' sequence.
      const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
      for (let r = 0; r < rows; r++) out[r] = Math.round(rng() * 100) / 100;
      break;
    }
    case 'hand':
      for (let r = 0; r < rows; r++) out[r] = Number.isFinite(custom[r]) ? custom[r] : p;
      break;
    default:
      out.fill(p);
  }
  return out.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 100) / 100);
}

export function isUniform(biases) {
  return biases.every((x) => x === biases[0]);
}

// Paint one row's chance from where the pointer is across the board:
// the left edge of the triangle's widest row is 0, the right edge is 1.
export function biasFromX(x, left, right) {
  if (right <= left) return 0.5;
  return Math.round(Math.min(1, Math.max(0, (x - left) / (right - left))) * 100) / 100;
}
