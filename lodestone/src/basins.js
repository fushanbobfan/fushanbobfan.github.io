// The basin map: for every starting point on a grid, which magnet catches a
// bob released there at rest, and how long it takes. Rows are filled coarse to
// fine (every 8th row, then every 4th, ...) so a rough picture appears at once.

import { fate } from './model.js';

export function rowOrder(size) {
  const order = [];
  const seen = new Uint8Array(size);
  for (let stride = 8; stride >= 1; stride >>= 1) {
    for (let r = 0; r < size; r += stride) {
      if (!seen[r]) {
        seen[r] = 1;
        order.push(r);
      }
    }
  }
  return order;
}

export class BasinMap {
  // view: the square of starting points, centred at (cx, cy) with half-width half.
  constructor(sys, size, view = { cx: 0, cy: 0, half: 2.5 }) {
    this.sys = sys;
    this.size = size;
    this.view = { ...view };
    this.magnet = new Int8Array(size * size).fill(-2); // -2: not computed yet
    this.time = new Float32Array(size * size);
    this.order = rowOrder(size);
    this.next = 0;
    this.done = new Uint8Array(size);
  }

  get complete() {
    return this.next >= this.order.length;
  }

  get progress() {
    return this.next / this.order.length;
  }

  // Pixel column/row to the plane; row 0 is the top, so y grows upward.
  toWorld(col, row) {
    const { cx, cy, half } = this.view;
    const s = this.size;
    return [cx - half + (2 * half * (col + 0.5)) / s, cy + half - (2 * half * (row + 0.5)) / s];
  }

  toPixel(x, y) {
    const { cx, cy, half } = this.view;
    const s = this.size;
    return [((x - cx + half) / (2 * half)) * s - 0.5, ((cy + half - y) / (2 * half)) * s - 0.5];
  }

  computeRow(row) {
    const s = this.size;
    for (let col = 0; col < s; col++) {
      const [x, y] = this.toWorld(col, row);
      const r = fate(this.sys, x, y);
      this.magnet[row * s + col] = r.magnet;
      this.time[row * s + col] = r.time;
    }
    this.done[row] = 1;
  }

  // Compute rows until the budget (in ms) runs out; returns the rows done.
  work(budgetMs = 12, now = () => performance.now()) {
    const start = now();
    let rows = 0;
    while (!this.complete) {
      this.computeRow(this.order[this.next++]);
      rows++;
      if (now() - start >= budgetMs) break;
    }
    return rows;
  }

  // The nearest finished row at or above `row`, to stand in for one not yet computed.
  sourceRow(row) {
    for (let r = row; r >= 0; r--) if (this.done[r]) return r;
    for (let r = row + 1; r < this.size; r++) if (this.done[r]) return r;
    return -1;
  }

  // Share of the finished starting points caught by each magnet, plus the uncaught.
  shares() {
    const n = this.sys.magnets.length;
    const counts = new Array(n + 1).fill(0);
    let total = 0;
    for (const m of this.magnet) {
      if (m === -2) continue;
      counts[m < 0 ? n : m]++;
      total++;
    }
    return { counts, total, fractions: counts.map((c) => (total ? c / total : 0)) };
  }
}

// Darker means slower: a bob caught at once keeps the magnet's full colour,
// one that wandered for `slow` time units or more is shaded to a third.
export function shade(rgb, time, slow = 40) {
  const t = Math.min(1, Math.log1p(time) / Math.log1p(slow));
  const k = 1 - 0.66 * t;
  return [Math.round(rgb[0] * k), Math.round(rgb[1] * k), Math.round(rgb[2] * k)];
}

export function paint(map, data, colors, uncaught = [60, 60, 60], showTime = true) {
  const s = map.size;
  for (let row = 0; row < s; row++) {
    const src = map.sourceRow(row);
    for (let col = 0; col < s; col++) {
      const o = 4 * (row * s + col);
      if (src < 0) {
        data[o + 3] = 0;
        continue;
      }
      const i = src * s + col;
      const m = map.magnet[i];
      const base = m >= 0 ? colors[m % colors.length] : uncaught;
      const c = showTime ? shade(base, map.time[i]) : base;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
  }
}

export function hexToRgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
