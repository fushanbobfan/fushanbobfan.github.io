// Light rays through air whose refractive index changes only with height.
//
// A ray is followed by its height z and its elevation angle theta (positive
// upwards) as it travels a horizontal distance x. In a layered medium
//   dz/dx = tan(theta),   dtheta/dx = n'(z) / n(z),
// which keeps n(z) cos(theta) constant along the ray (Snell's law for layers).
// The ground is flat; over a few hundred metres the Earth's curvature drops
// the surface by millimetres, small beside the heights drawn here.

import { index, dndz } from './air.js';

const BASE_STEP = 0.5;
const MAX_STEP = 10;

// Step length: half a metre in and near the warm layer, longer higher up
// where the index hardly changes, and never so long that a descending ray
// drops more than about a third of its height in one step.
function stepLength(air, z, theta) {
  const away = BASE_STEP * Math.exp(Math.min(z / air.layer, 6) / 2);
  const fall = BASE_STEP + (0.3 * z) / Math.max(Math.abs(Math.tan(theta)), 1e-9);
  return Math.min(MAX_STEP, away, fall);
}

function slope(air, z, theta) {
  return [Math.tan(theta), dndz(air, z) / index(air, z)];
}

// Follows a ray leaving height `eye` at elevation `angle` (radians).
// `stops` are increasing distances at which the ray's height is recorded.
// Returns { groundX, heights, angles, path }: groundX is where the ray meets
// the ground (null if it never does before the last stop); heights[i] is the
// height at stops[i], or null if the ray hit the ground first.
export function trace(air, eye, angle, { stops, path = false, pathEvery = 4 } = {}) {
  const last = stops[stops.length - 1];
  const cap = Math.min(BASE_STEP, last / 2000);
  const heights = new Array(stops.length).fill(null);
  const angles = new Array(stops.length).fill(null);
  const points = path ? [[0, eye]] : null;
  let x = 0;
  let z = eye;
  let t = angle;
  let next = 0;
  let step = 0;
  while (next < stops.length) {
    const h = Math.min((stepLength(air, z, t) * cap) / BASE_STEP, stops[next] - x);
    const [a1, b1] = slope(air, z, t);
    const [a2, b2] = slope(air, z + (h / 2) * a1, t + (h / 2) * b1);
    const [a3, b3] = slope(air, z + (h / 2) * a2, t + (h / 2) * b2);
    const [a4, b4] = slope(air, z + h * a3, t + h * b3);
    const nz = z + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    const nt = t + (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
    if (nz <= 0) {
      const groundX = x + (h * z) / (z - nz);
      if (points) points.push([groundX, 0]);
      return { groundX, heights, angles, path: points };
    }
    x += h;
    z = nz;
    t = nt;
    step++;
    if (points && step % pathEvery === 0) points.push([x, z]);
    while (next < stops.length && x >= stops[next] - 1e-9) {
      heights[next] = z;
      angles[next] = t;
      next++;
    }
  }
  if (points && points[points.length - 1][0] !== x) points.push([x, z]);
  return { groundX: null, heights, angles, path: points };
}

// The steepest downward angle at which a ray from `eye` still turns back up
// before reaching the ground: n(0) = n(eye) cos(theta). Null when the air at
// the ground bends nothing upwards (a cool or equal surface).
export function criticalAngle(air, eye) {
  const ratio = index(air, 0) / index(air, eye);
  if (ratio >= 1) return null;
  return Math.acos(ratio);
}

// The height at which a ray leaving `eye` at `angle` levels out, from the
// invariant n(z) cos(theta) = const; null if it reaches the ground first or
// never levels out below the eye.
export function turningHeight(air, eye, angle) {
  if (angle >= 0) return null;
  const target = index(air, eye) * Math.cos(angle);
  if (index(air, 0) >= target) return null;
  if (index(air, eye) <= target) return null;
  let lo = 0;
  let hi = eye;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (index(air, mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Where the lowest ray that misses the ground comes closest to it: the near
// edge of the patch where the road seems to shine. Null without a mirage.
export function shineStart(air, eye, until = 5000) {
  const c = criticalAngle(air, eye);
  if (c === null) return null;
  const r = trace(air, eye, -c * (1 - 1e-6), { stops: [until], path: true, pathEvery: 1 });
  if (r.groundX !== null) return r.groundX;
  let best = r.path[0];
  for (const p of r.path) if (p[1] < best[1]) best = p;
  return best[0] >= until ? null : best[0];
}
