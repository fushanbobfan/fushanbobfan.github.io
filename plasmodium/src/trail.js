// The chemoattractant layer: one float per cell that particles deposit into,
// that spreads to its neighbours and that fades a little every step.

export function createTrail(width, height) {
  return {
    width,
    height,
    data: new Float32Array(width * height),
    scratch: new Float32Array(width * height),
    // 1 where a wall stands: no trail is laid there and none spreads into it.
    walls: new Uint8Array(width * height),
    wallCount: 0,
  };
}

export function setWall(trail, i, on) {
  const was = trail.walls[i];
  if (on && !was) {
    trail.walls[i] = 1;
    trail.wallCount++;
    trail.data[i] = 0;
  } else if (!on && was) {
    trail.walls[i] = 0;
    trail.wallCount--;
  }
}

export function clearWalls(trail) {
  trail.walls.fill(0);
  trail.wallCount = 0;
}

export function isWall(trail, x, y, wrap) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (wrap) return trail.walls[wrapIndex(trail, ix, iy)] === 1;
  if (ix < 0 || iy < 0 || ix >= trail.width || iy >= trail.height) return false;
  return trail.walls[iy * trail.width + ix] === 1;
}

export function clearTrail(trail) {
  trail.data.fill(0);
}

export function wrapIndex(trail, x, y) {
  const { width, height } = trail;
  let ix = Math.floor(x) % width;
  let iy = Math.floor(y) % height;
  if (ix < 0) ix += width;
  if (iy < 0) iy += height;
  return iy * width + ix;
}

// Reads the trail at a point. Off-grid points read 0 unless the world wraps.
export function sample(trail, x, y, wrap) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (wrap) return trail.data[wrapIndex(trail, ix, iy)];
  if (ix < 0 || iy < 0 || ix >= trail.width || iy >= trail.height) return 0;
  return trail.data[iy * trail.width + ix];
}

export function deposit(trail, x, y, amount, wrap) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let i;
  if (wrap) {
    i = wrapIndex(trail, ix, iy);
  } else {
    if (ix < 0 || iy < 0 || ix >= trail.width || iy >= trail.height) return;
    i = iy * trail.width + ix;
  }
  if (!trail.walls[i]) trail.data[i] += amount;
}

// One diffuse-and-decay pass. Each cell moves `spread` of the way towards the
// mean of its 3x3 neighbourhood, then keeps `1 - decay` of what it has.
// With spread = 1 this is Jones's plain 3x3 mean filter. In a closed world
// edge cells average only the neighbours that exist, and next to a wall
// cells average only the open neighbours.
export function diffuseDecay(trail, spread, decay, wrap) {
  if (trail.wallCount > 0) {
    diffuseAroundWalls(trail, spread, decay, wrap);
    return;
  }
  const { width: w, height: h, data: src, scratch: dst } = trail;
  const keep = 1 - decay;
  for (let y = 0; y < h; y++) {
    const ym = y - 1;
    const yp = y + 1;
    for (let x = 0; x < w; x++) {
      const xm = x - 1;
      const xp = x + 1;
      let sum = 0;
      let n = 0;
      if (wrap) {
        const r0 = ((ym + h) % h) * w;
        const r1 = y * w;
        const r2 = (yp % h) * w;
        const c0 = (xm + w) % w;
        const c2 = xp % w;
        sum =
          src[r0 + c0] + src[r0 + x] + src[r0 + c2] +
          src[r1 + c0] + src[r1 + x] + src[r1 + c2] +
          src[r2 + c0] + src[r2 + x] + src[r2 + c2];
        n = 9;
      } else {
        for (let yy = ym; yy <= yp; yy++) {
          if (yy < 0 || yy >= h) continue;
          const row = yy * w;
          for (let xx = xm; xx <= xp; xx++) {
            if (xx < 0 || xx >= w) continue;
            sum += src[row + xx];
            n++;
          }
        }
      }
      const i = y * w + x;
      const v = src[i] + spread * (sum / n - src[i]);
      dst[i] = v * keep;
    }
  }
  trail.data = dst;
  trail.scratch = src;
}

function diffuseAroundWalls(trail, spread, decay, wrap) {
  const { width: w, height: h, data: src, scratch: dst, walls } = trail;
  const keep = 1 - decay;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (walls[i]) {
        dst[i] = 0;
        continue;
      }
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        let yy = y + dy;
        if (yy < 0 || yy >= h) {
          if (!wrap) continue;
          yy = (yy + h) % h;
        }
        for (let dx = -1; dx <= 1; dx++) {
          let xx = x + dx;
          if (xx < 0 || xx >= w) {
            if (!wrap) continue;
            xx = (xx + w) % w;
          }
          const j = yy * w + xx;
          if (walls[j]) continue;
          sum += src[j];
          n++;
        }
      }
      dst[i] = (src[i] + spread * (sum / n - src[i])) * keep;
    }
  }
  trail.data = dst;
  trail.scratch = src;
}

export function totalTrail(trail) {
  let s = 0;
  for (let i = 0; i < trail.data.length; i++) s += trail.data[i];
  return s;
}

export function maxTrail(trail) {
  let m = 0;
  for (let i = 0; i < trail.data.length; i++) if (trail.data[i] > m) m = trail.data[i];
  return m;
}

// Adds `amount` to every cell within `radius` of (x, y): the attractant brush.
export function stamp(trail, x, y, radius, amount, wrap) {
  const r = Math.ceil(radius);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      deposit(trail, x + dx, y + dy, amount, wrap);
    }
  }
}
