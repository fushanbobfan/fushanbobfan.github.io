// Time-stepped hard-disk dynamics. Each step moves every disk in a straight
// line, bounces disks off the walls, then finds overlapping pairs through a
// cell grid. An overlapping pair that is still approaching is wound back to
// the moment of contact, given the elastic impulse along the line of
// centres and carried forward again, so kinetic energy and momentum are
// conserved exactly by every collision.

export function createGrid(gas) {
  let rmax = 0;
  for (let i = 0; i < gas.n; i++) rmax = Math.max(rmax, gas.r[i]);
  const size = Math.max(2 * rmax, 1e-9);
  const cols = Math.max(1, Math.floor(gas.width / size));
  const rows = Math.max(1, Math.floor(gas.height / size));
  return {
    cols,
    rows,
    cw: gas.width / cols,
    ch: gas.height / rows,
    head: new Int32Array(cols * rows),
    next: new Int32Array(gas.n),
  };
}

function fillGrid(grid, gas) {
  const { cols, rows, cw, ch, head, next } = grid;
  head.fill(-1);
  for (let i = 0; i < gas.n; i++) {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(gas.x[i] / cw)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(gas.y[i] / ch)));
    const c = cy * cols + cx;
    next[i] = head[c];
    head[c] = i;
  }
}

// Bounce a disk off the four walls. Returns the impulse handed to the walls.
export function bounceWalls(gas, i) {
  const r = gas.r[i];
  const m = gas.m[i];
  let impulse = 0;
  if (gas.x[i] < r) {
    gas.x[i] = 2 * r - gas.x[i];
    if (gas.vx[i] < 0) { impulse += -2 * m * gas.vx[i]; gas.vx[i] = -gas.vx[i]; }
  } else if (gas.x[i] > gas.width - r) {
    gas.x[i] = 2 * (gas.width - r) - gas.x[i];
    if (gas.vx[i] > 0) { impulse += 2 * m * gas.vx[i]; gas.vx[i] = -gas.vx[i]; }
  }
  if (gas.y[i] < r) {
    gas.y[i] = 2 * r - gas.y[i];
    if (gas.vy[i] < 0) { impulse += -2 * m * gas.vy[i]; gas.vy[i] = -gas.vy[i]; }
  } else if (gas.y[i] > gas.height - r) {
    gas.y[i] = 2 * (gas.height - r) - gas.y[i];
    if (gas.vy[i] > 0) { impulse += 2 * m * gas.vy[i]; gas.vy[i] = -gas.vy[i]; }
  }
  return impulse;
}

// A partition is a thin vertical wall at x = gas.partition.x with a hole of
// height gas.partition.hole centred on the box. Its two pieces are line
// segments; a disk touching one bounces off the nearest point on it, which
// handles the flat faces and the rim of the hole alike.
export function partitionSegments(gas) {
  const p = gas.partition;
  if (!p) return [];
  const y1 = Math.max(0, (gas.height - p.hole) / 2);
  const y2 = Math.min(gas.height, (gas.height + p.hole) / 2);
  const segs = [];
  if (y1 > 0) segs.push([0, y1]);
  if (y2 < gas.height) segs.push([y2, gas.height]);
  return segs;
}

// Bounce disk i off the partition. Returns the impulse it receives.
export function bouncePartition(gas, i, segs = partitionSegments(gas)) {
  const px = gas.partition.x;
  const r = gas.r[i];
  if (Math.abs(gas.x[i] - px) >= r) return 0;
  let impulse = 0;
  for (const [a, b] of segs) {
    const qy = Math.min(b, Math.max(a, gas.y[i]));
    let nx = gas.x[i] - px;
    let ny = gas.y[i] - qy;
    const d = Math.hypot(nx, ny);
    if (d >= r) continue;
    if (d === 0) {
      // Centre exactly on the wall: push back the way it came.
      nx = gas.vx[i] > 0 ? -1 : 1;
      ny = 0;
    } else {
      nx /= d;
      ny /= d;
    }
    gas.x[i] = px + nx * r;
    gas.y[i] = qy + ny * r;
    const vn = gas.vx[i] * nx + gas.vy[i] * ny;
    if (vn < 0) {
      gas.vx[i] -= 2 * vn * nx;
      gas.vy[i] -= 2 * vn * ny;
      impulse += -2 * gas.m[i] * vn;
    }
  }
  return impulse;
}

// Resolve one overlapping pair. Returns true if they collided.
export function collidePair(gas, i, j, dt) {
  let dx = gas.x[i] - gas.x[j];
  let dy = gas.y[i] - gas.y[j];
  const R = gas.r[i] + gas.r[j];
  const d2 = dx * dx + dy * dy;
  if (d2 >= R * R) return false;
  const dvx = gas.vx[i] - gas.vx[j];
  const dvy = gas.vy[i] - gas.vy[j];
  const dot = dx * dvx + dy * dvy;
  if (dot >= 0) return false;
  // How long ago were the centres exactly R apart?
  const a = dvx * dvx + dvy * dvy;
  const c = d2 - R * R;
  let back = (dot + Math.sqrt(dot * dot - a * c)) / a;
  if (!(back > 0)) back = 0;
  if (back > dt) back = dt;
  gas.x[i] -= gas.vx[i] * back; gas.y[i] -= gas.vy[i] * back;
  gas.x[j] -= gas.vx[j] * back; gas.y[j] -= gas.vy[j] * back;
  dx = gas.x[i] - gas.x[j];
  dy = gas.y[i] - gas.y[j];
  const dist = Math.hypot(dx, dy) || R;
  const nx = dx / dist;
  const ny = dy / dist;
  const vn = dvx * nx + dvy * ny;
  const mi = gas.m[i];
  const mj = gas.m[j];
  const J = (2 * mi * mj * vn) / (mi + mj);
  gas.vx[i] -= (J / mi) * nx; gas.vy[i] -= (J / mi) * ny;
  gas.vx[j] += (J / mj) * nx; gas.vy[j] += (J / mj) * ny;
  gas.x[i] += gas.vx[i] * back; gas.y[i] += gas.vy[i] * back;
  gas.x[j] += gas.vx[j] * back; gas.y[j] += gas.vy[j] * back;
  return true;
}

const NEIGHBOURS = [[1, 0], [-1, 1], [0, 1], [1, 1]];

export function step(gas, dt, grid = createGrid(gas)) {
  const { n } = gas;
  for (let i = 0; i < n; i++) {
    gas.x[i] += gas.vx[i] * dt;
    gas.y[i] += gas.vy[i] * dt;
  }
  let impulse = 0;
  for (let i = 0; i < n; i++) impulse += bounceWalls(gas, i);

  fillGrid(grid, gas);
  const { cols, rows, head, next } = grid;
  let hits = 0;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      for (let i = head[cy * cols + cx]; i !== -1; i = next[i]) {
        // Same cell (later disks only) and four forward neighbours, so
        // each pair is visited once.
        for (let j = next[i]; j !== -1; j = next[j]) {
          if (collidePair(gas, i, j, dt)) hits++;
        }
        for (const [ox, oy] of NEIGHBOURS) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || nx >= cols || ny >= rows) continue;
          for (let j = head[ny * cols + nx]; j !== -1; j = next[j]) {
            if (collidePair(gas, i, j, dt)) hits++;
          }
        }
      }
    }
  }
  // A collision near a wall can push a disk past it; bounce once more.
  for (let i = 0; i < n; i++) impulse += bounceWalls(gas, i);
  if (gas.partition) {
    const segs = partitionSegments(gas);
    for (let i = 0; i < n; i++) bouncePartition(gas, i, segs);
  }

  gas.time += dt;
  gas.collisions += hits;
  gas.wallImpulse = (gas.wallImpulse || 0) + impulse;
  return { hits, impulse };
}

// A step size that keeps the fastest disk from moving more than a fraction
// of the smallest radius, so collisions are never skipped.
export function safeStep(gas, fraction = 0.25) {
  let vmax = 0;
  let rmin = Infinity;
  for (let i = 0; i < gas.n; i++) {
    vmax = Math.max(vmax, Math.hypot(gas.vx[i], gas.vy[i]));
    rmin = Math.min(rmin, gas.r[i]);
  }
  if (vmax === 0 || !Number.isFinite(rmin)) return 0.1;
  return (fraction * rmin) / vmax;
}
