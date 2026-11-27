// The sampled electron positions seen from any direction: an orthographic
// view, each point splatted into a light buffer for its sign of psi.

import { POSITIVE, NEGATIVE, MIXED } from './slice.js';

// Rotation that turns world coordinates (z up) into screen coordinates:
// yaw about the world z axis, then pitch about the screen's horizontal axis.
export function viewMatrix(yaw, pitch) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  // Screen right, screen up, towards the viewer.
  return [
    [cy, sy, 0],
    [-sy * sp, cy * sp, cp],
    [sy * cp, -cy * cp, sp],
  ];
}

export function project(M, x, y, z) {
  return [
    M[0][0] * x + M[0][1] * y + M[0][2] * z,
    M[1][0] * x + M[1][1] * y + M[1][2] * z,
    M[2][0] * x + M[2][1] * y + M[2][2] * z,
  ];
}

// Splats every point into a light buffer, one per sign of psi, each counted
// with its weight if there are weights. A sample without signs (a mix of two
// orbitals, whose psi is complex) goes wholly into the first buffer.
export function splat(sample, M, half, size, weights = null) {
  const pos = new Float32Array(size * size);
  const neg = new Float32Array(size * size);
  const scale = size / (2 * half);
  const { positions, signs, count } = sample;
  for (let k = 0; k < count; k++) {
    const x = positions[3 * k];
    const y = positions[3 * k + 1];
    const z = positions[3 * k + 2];
    const sx = (M[0][0] * x + M[0][1] * y + M[0][2] * z + half) * scale - 0.5;
    const sy = (half - (M[1][0] * x + M[1][1] * y + M[1][2] * z)) * scale - 0.5;
    const i0 = Math.floor(sx);
    const j0 = Math.floor(sy);
    if (i0 < 0 || j0 < 0 || i0 >= size - 1 || j0 >= size - 1) continue;
    const fx = sx - i0;
    const fy = sy - j0;
    const buf = !signs || signs[k] >= 0 ? pos : neg;
    const w = weights ? weights[k] : 1;
    const p = j0 * size + i0;
    buf[p] += w * (1 - fx) * (1 - fy);
    buf[p + 1] += w * fx * (1 - fy);
    buf[p + size] += w * (1 - fx) * fy;
    buf[p + size + 1] += w * fx * fy;
  }
  return { pos, neg };
}

// The exposure normally follows the picture. An animated mix passes the level
// of its time-averaged cloud instead, so the brightness does not pump.
export function renderCloud(sample, M, half, size, out = new Uint8ClampedArray(size * size * 4), weights = null, fixedLevel = null) {
  const { pos, neg } = splat(sample, M, half, size, weights);
  const level = fixedLevel ?? exposureLevel(pos, neg);
  const first = sample.signs ? POSITIVE : MIXED;
  for (let p = 0; p < size * size; p++) {
    const a = 1 - Math.exp(-pos[p] / level);
    const b = 1 - Math.exp(-neg[p] / level);
    out[4 * p] = first[0] * a + NEGATIVE[0] * b;
    out[4 * p + 1] = first[1] * a + NEGATIVE[1] * b;
    out[4 * p + 2] = first[2] * a + NEGATIVE[2] * b;
    out[4 * p + 3] = 255;
  }
  return out;
}

// Exposure from the brightest few per cent of lit pixels, so a cloud looks
// equally bright whatever its size or the number of points.
export function exposureLevel(pos, neg) {
  const lit = [];
  const stride = Math.max(1, Math.floor(pos.length / 20000));
  for (let p = 0; p < pos.length; p += stride) {
    const v = pos[p] + neg[p];
    if (v > 0) lit.push(v);
  }
  if (lit.length === 0) return 1;
  lit.sort((a, b) => a - b);
  return Math.max(1e-6, lit[Math.floor(lit.length * 0.97)] / 2);
}
