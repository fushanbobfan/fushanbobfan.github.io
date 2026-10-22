// Streaklines: dye particles released from a rake of fixed points near the
// inlet and carried by the flow. Each particle remembers which rake point it
// came from, so every row draws as one streak.

import { sampleVelocity } from './field.js';

export function createTracers(capacity = 8000) {
  return {
    capacity,
    count: 0,
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    row: new Uint8Array(capacity),
  };
}

// Evenly spaced release heights, kept off the tunnel's top and bottom edges.
export function rakeRows(ny, rows) {
  const out = [];
  for (let k = 0; k < rows; k++) out.push(((k + 0.5) / rows) * (ny - 4) + 2);
  return out;
}

// Release one particle from each rake point at x0. When the store is full
// the oldest particles make room.
export function release(tr, rows, x0) {
  const need = rows.length;
  if (tr.count + need > tr.capacity) {
    const drop = tr.count + need - tr.capacity;
    tr.x.copyWithin(0, drop, tr.count);
    tr.y.copyWithin(0, drop, tr.count);
    tr.row.copyWithin(0, drop, tr.count);
    tr.count -= drop;
  }
  for (let k = 0; k < need; k++) {
    const i = tr.count++;
    tr.x[i] = x0;
    tr.y[i] = rows[k];
    tr.row[i] = k;
  }
}

// Move every particle through dt lattice steps with the midpoint rule, and
// drop the ones that leave the tunnel or end up inside a wall.
export function advect(tr, lat, dt) {
  const { nx, ny, solid } = lat;
  let keep = 0;
  for (let i = 0; i < tr.count; i++) {
    let x = tr.x[i], y = tr.y[i];
    const [u1, v1] = sampleVelocity(lat, x, y);
    const [u2, v2] = sampleVelocity(lat, x + 0.5 * dt * u1, y + 0.5 * dt * v1);
    x += dt * u2;
    y += dt * v2;
    if (!(x >= 0 && x < nx - 1 && y >= 0 && y < ny - 1)) continue;
    if (solid[Math.round(y) * nx + Math.round(x)]) continue;
    tr.x[keep] = x;
    tr.y[keep] = y;
    tr.row[keep] = tr.row[i];
    keep++;
  }
  tr.count = keep;
}

export function clearTracers(tr) {
  tr.count = 0;
}
