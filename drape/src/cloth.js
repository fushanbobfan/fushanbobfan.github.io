// A cloth as a grid of point masses joined by distance links, integrated with
// position Verlet and held together by iterative constraint relaxation
// (Jakobsen, "Advanced Character Physics", 2001). y points down.

export function createCloth({ cols, rows, spacing, left = 0, top = 0, pins = () => false }) {
  const n = cols * rows;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const pinned = new Uint8Array(n);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      x[k] = left + i * spacing;
      y[k] = top + j * spacing;
      if (pins(i, j, cols, rows)) pinned[k] = 1;
    }
  }

  const count = (cols - 1) * rows + cols * (rows - 1);
  const a = new Int32Array(count);
  const b = new Int32Array(count);
  let m = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      if (i < cols - 1) { a[m] = k; b[m] = k + 1; m++; }
      if (j < rows - 1) { a[m] = k; b[m] = k + cols; m++; }
    }
  }

  return {
    cols, rows, spacing, n,
    x, y,
    px: Float64Array.from(x),
    py: Float64Array.from(y),
    pinned,
    links: { a, b, rest: new Float64Array(count).fill(spacing), broken: new Uint8Array(count), count },
    brokenCount: 0,
    time: 0,
  };
}

export const DEFAULTS = {
  gravity: 9.81,
  wind: 0,
  damping: 0.01,
  iterations: 16,
  tearAt: Infinity,
  floor: Infinity,
  friction: 0.6,
};

// Horizontal wind acceleration felt at (x, y) at time t: a steady push plus
// a travelling gust, so a flag ripples rather than just leaning.
export function windAt(wind, x, y, t) {
  if (wind === 0) return 0;
  const gust = 0.5 + 0.5 * Math.sin(2.3 * t - 3.1 * x + 1.7 * y) * Math.sin(0.9 * t + 2.2 * y);
  return wind * (0.35 + 0.65 * gust);
}

export function integrate(c, dt, o) {
  const { x, y, px, py, pinned } = c;
  const keep = 1 - o.damping;
  const dt2 = dt * dt;
  for (let k = 0; k < c.n; k++) {
    if (pinned[k]) { px[k] = x[k]; py[k] = y[k]; continue; }
    const vx = (x[k] - px[k]) * keep;
    const vy = (y[k] - py[k]) * keep;
    px[k] = x[k];
    py[k] = y[k];
    x[k] += vx + windAt(o.wind, x[k], y[k], c.time) * dt2;
    y[k] += vy + o.gravity * dt2;
  }
}

// One relaxation sweep over every intact link. Returns the number of links
// that snapped during the sweep.
export function relax(c, tearAt = Infinity) {
  const { x, y, pinned } = c;
  const { a, b, rest, broken, count } = c.links;
  let snapped = 0;
  for (let m = 0; m < count; m++) {
    if (broken[m]) continue;
    const i = a[m];
    const j = b[m];
    const dx = x[j] - x[i];
    const dy = y[j] - y[i];
    const d = Math.hypot(dx, dy);
    if (d > tearAt * rest[m]) {
      broken[m] = 1;
      snapped++;
      continue;
    }
    const wi = pinned[i] ? 0 : 1;
    const wj = pinned[j] ? 0 : 1;
    const w = wi + wj;
    if (w === 0 || d === 0) continue;
    const s = (d - rest[m]) / (d * w);
    x[i] += dx * s * wi;
    y[i] += dy * s * wi;
    x[j] -= dx * s * wj;
    y[j] -= dy * s * wj;
  }
  c.brokenCount += snapped;
  return snapped;
}

export function collideFloor(c, floor, friction) {
  if (!Number.isFinite(floor)) return;
  const { x, y, px, py } = c;
  for (let k = 0; k < c.n; k++) {
    if (y[k] > floor) {
      y[k] = floor;
      py[k] = floor;
      px[k] = x[k] - (x[k] - px[k]) * (1 - friction);
    }
  }
}

export function step(c, dt, options = {}) {
  const o = { ...DEFAULTS, ...options };
  integrate(c, dt, o);
  let snapped = 0;
  for (let it = 0; it < o.iterations; it++) {
    snapped += relax(c, o.tearAt);
    collideFloor(c, o.floor, o.friction);
  }
  c.time += dt;
  return snapped;
}

// Stretch of link m relative to its rest length: 0 at rest, 0.1 at 10% longer.
export function strain(c, m) {
  const { a, b, rest } = c.links;
  const d = Math.hypot(c.x[b[m]] - c.x[a[m]], c.y[b[m]] - c.y[a[m]]);
  return d / rest[m] - 1;
}

export function maxStrain(c) {
  let best = 0;
  for (let m = 0; m < c.links.count; m++) {
    if (!c.links.broken[m]) best = Math.max(best, strain(c, m));
  }
  return best;
}
