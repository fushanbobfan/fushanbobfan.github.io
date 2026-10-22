// Turning catalogue entries into runnable rules and cell grids.

import { decode } from './rle.js';
import { parseRings } from './rules.js';
import { SPECIES } from './species.js';

export function speciesById(id) {
  return SPECIES.find((s) => s.id === id) || null;
}

// Nearest-neighbour enlargement (or reduction) of a pattern by `factor`.
export function zoom(pattern, factor) {
  if (!(factor > 0)) throw new RangeError(`zoom factor must be positive, got ${factor}`);
  const { width, height, data } = pattern;
  const w = Math.max(1, Math.round(width * factor));
  const h = Math.max(1, Math.round(height * factor));
  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(height - 1, Math.floor(y / factor));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(width - 1, Math.floor(x / factor));
      out[y * w + x] = data[sy * width + sx];
    }
  }
  return { width: w, height: h, data: out };
}

// The species' rule with its radius multiplied by `scale`.
export function speciesRule(species, scale = 1) {
  const { R, T, mu, sigma, rings } = species.rule;
  return { R: Math.round(R * scale), T, mu, sigma, rings: parseRings(rings) };
}

const decoded = new Map();

export function speciesPattern(species, scale = 1) {
  let p = decoded.get(species.id);
  if (!p) {
    p = decode(species.cells);
    decoded.set(species.id, p);
  }
  if (scale === 1) return p;
  return zoom(p, Math.round(species.rule.R * scale) / species.rule.R);
}

// The largest whole scale at which the species still fits a quarter of the grid.
export function fitScale(species, n) {
  const p = speciesPattern(species);
  const side = Math.max(p.width, p.height);
  return Math.max(1, Math.min(4, Math.floor(n / 4 / side)));
}
