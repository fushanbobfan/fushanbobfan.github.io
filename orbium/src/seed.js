// Seeded random starts, so a share link reproduces the same soup.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Scatters `count` square patches of uniform noise, each `size` cells wide,
// with values up to `level`. Patches add with max, so overlaps stay in [0, 1].
export function soup(world, { seed = 1, count = 12, size = 2 * world.rule.R, level = 1 } = {}) {
  const rand = mulberry32(seed);
  const { n, cells } = world;
  const side = Math.max(1, Math.round(size));
  for (let k = 0; k < count; k++) {
    const x0 = Math.floor(rand() * n);
    const y0 = Math.floor(rand() * n);
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const i = ((y0 + y) % n) * n + ((x0 + x) % n);
        const v = rand() * level;
        if (v > cells[i]) cells[i] = v;
      }
    }
  }
}

// Soft round brush: adds (or with negative amount, removes) up to `amount`
// at (cx, cy), fading to zero at `radius`. Wraps round the torus.
export function brush(world, cx, cy, radius, amount) {
  const { n, cells } = world;
  const r = Math.max(0.5, radius);
  const reach = Math.ceil(r);
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const d = Math.hypot(dx, dy) / r;
      if (d >= 1) continue;
      const fall = 1 - d * d;
      const x = (((Math.round(cx) + dx) % n) + n) % n;
      const y = (((Math.round(cy) + dy) % n) + n) % n;
      const i = y * n + x;
      const v = cells[i] + amount * fall;
      cells[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }
}
