// A Lenia world: an n x n torus of cell values in [0, 1]. Each step every
// cell senses U = K * A (the kernel-weighted average of its neighbourhood,
// computed as a product of Fourier transforms) and moves by dt * G(U).

import { isPowerOfTwo } from './fft.js';
import { RealConvolver } from './convolve.js';
import { kernelShell, growth } from './rules.js';

export const DEFAULT_RULE = Object.freeze({ R: 13, T: 10, mu: 0.15, sigma: 0.015, rings: [1] });

export function validateRule(rule) {
  const { R, T, mu, sigma, rings } = rule;
  if (!(Number.isFinite(R) && R >= 2 && R <= 64)) throw new RangeError(`R must be in [2, 64], got ${R}`);
  if (!(Number.isFinite(T) && T >= 1 && T <= 1000)) throw new RangeError(`T must be in [1, 1000], got ${T}`);
  if (!(Number.isFinite(mu) && mu > 0 && mu < 1)) throw new RangeError(`mu must be in (0, 1), got ${mu}`);
  if (!(Number.isFinite(sigma) && sigma > 0 && sigma < 1)) throw new RangeError(`sigma must be in (0, 1), got ${sigma}`);
  if (!Array.isArray(rings) || rings.length < 1 || rings.length > 4) throw new RangeError('rings must hold 1 to 4 heights');
  return { R, T, mu, sigma, rings: rings.slice() };
}

// Kernel laid out for periodic convolution: weight for offset (dx, dy) sits at
// ((dx mod n), (dy mod n)). Weights sum to 1.
export function kernelGrid(n, R, rings) {
  const k = new Float64Array(n * n);
  const reach = Math.min(Math.ceil(R), Math.floor(n / 2) - 1);
  let sum = 0;
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const w = kernelShell(Math.hypot(dx, dy), R, rings);
      if (w === 0) continue;
      k[((dy + n) % n) * n + ((dx + n) % n)] = w;
      sum += w;
    }
  }
  if (sum > 0) for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}

export class World {
  constructor(n = 256, rule = DEFAULT_RULE) {
    if (!isPowerOfTwo(n) || n < 32) throw new RangeError(`grid size must be a power of two >= 32, got ${n}`);
    this.n = n;
    this.cells = new Float64Array(n * n);
    this.potential = new Float64Array(n * n);
    this.change = new Float64Array(n * n);
    this.conv = new RealConvolver(n);
    this.time = 0;
    this.setRule(rule);
  }

  setRule(rule) {
    this.rule = validateRule(rule);
    this.conv.setKernel(kernelGrid(this.n, this.rule.R, this.rule.rings));
  }

  clear() {
    this.cells.fill(0);
    this.potential.fill(0);
    this.change.fill(0);
    this.time = 0;
  }

  // Fills this.potential with K * A.
  sense() {
    return this.conv.convolve(this.cells, this.potential);
  }

  step() {
    const { cells, potential, change } = this;
    const { T, mu, sigma } = this.rule;
    this.sense();
    const dt = 1 / T;
    for (let i = 0; i < cells.length; i++) {
      const g = growth(potential[i], mu, sigma);
      change[i] = g;
      const v = cells[i] + dt * g;
      cells[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
    this.time += dt;
  }

  // Adds a pattern with its top-left corner at (x, y), wrapping round the torus.
  // `rotate` turns it by quarter turns clockwise.
  place(pattern, x, y, { rotate = 0, mode = 'max' } = {}) {
    const { n, cells } = this;
    const { width: w, height: h, data } = pattern;
    const q = ((rotate % 4) + 4) % 4;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const v = data[py * w + px];
        let ox = px;
        let oy = py;
        if (q === 1) { ox = h - 1 - py; oy = px; }
        else if (q === 2) { ox = w - 1 - px; oy = h - 1 - py; }
        else if (q === 3) { ox = py; oy = w - 1 - px; }
        const i = (((y + oy) % n) + n) % n * n + ((((x + ox) % n) + n) % n);
        cells[i] = mode === 'set' ? v : Math.max(cells[i], v);
      }
    }
  }

  mass() {
    let s = 0;
    for (let i = 0; i < this.cells.length; i++) s += this.cells[i];
    return s;
  }

  // Centre of mass on the torus, by averaging each axis as an angle.
  centroid() {
    const { n, cells } = this;
    if (!this.cosTable) {
      const k = (2 * Math.PI) / n;
      this.cosTable = Float64Array.from({ length: n }, (_, i) => Math.cos(k * i));
      this.sinTable = Float64Array.from({ length: n }, (_, i) => Math.sin(k * i));
    }
    const { cosTable: C, sinTable: S } = this;
    let cx = 0, sx = 0, cy = 0, sy = 0, m = 0;
    for (let y = 0; y < n; y++) {
      let row = 0, rc = 0, rs = 0;
      const o = y * n;
      for (let x = 0; x < n; x++) {
        const v = cells[o + x];
        if (v === 0) continue;
        rc += v * C[x];
        rs += v * S[x];
        row += v;
      }
      cx += rc;
      sx += rs;
      cy += row * C[y];
      sy += row * S[y];
      m += row;
    }
    if (m === 0) return null;
    const k = (2 * Math.PI) / n;
    const wrap = (c, s) => (((Math.atan2(s, c) / k) % n) + n) % n;
    return { x: wrap(cx, sx), y: wrap(cy, sy) };
  }
}

// Shortest displacement between two points on an n-torus.
export function torusDelta(a, b, n) {
  const d = (u, v) => {
    let t = (v - u) % n;
    if (t > n / 2) t -= n;
    if (t < -n / 2) t += n;
    return t;
  };
  return { dx: d(a.x, b.x), dy: d(a.y, b.y) };
}
