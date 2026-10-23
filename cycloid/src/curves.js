// Curves from A = (0, 0) to B = (bx, by), y pointing down, as flat
// [x0, y0, x1, y1, ...] arrays, with the exact descent time where one exists.

import { G } from './motion.js';

// The cycloid x = r(t - sin t), y = r(1 - cos t) through B. The ratio
// x / y = (t - sin t) / (1 - cos t) climbs from 0 to infinity on (0, 2pi),
// so bisection finds the end parameter.
export function cycloidThrough(bx, by) {
  const target = bx / by;
  let lo = 0, hi = 2 * Math.PI;
  for (let i = 0; i < 200 && hi - lo > 1e-15; i++) {
    const mid = (lo + hi) / 2;
    if ((mid - Math.sin(mid)) / (1 - Math.cos(mid)) < target) lo = mid;
    else hi = mid;
  }
  const theta = (lo + hi) / 2;
  return { r: by / (1 - Math.cos(theta)), theta };
}

export function cycloidPoints(bx, by, n = 400) {
  const { r, theta } = cycloidThrough(bx, by);
  const pts = new Float64Array(2 * n + 2);
  for (let i = 0; i <= n; i++) {
    const t = (theta * i) / n;
    pts[2 * i] = r * (t - Math.sin(t));
    pts[2 * i + 1] = r * (1 - Math.cos(t));
  }
  pts[2 * n] = bx;
  pts[2 * n + 1] = by;
  return pts;
}

// Along the cycloid the bead's parameter grows at the steady rate sqrt(g / r).
export function cycloidTime(bx, by, g = G) {
  const { r, theta } = cycloidThrough(bx, by);
  return theta * Math.sqrt(r / g);
}

// How far below A the cycloid reaches: past t = pi it dips below B.
export function cycloidDepth(bx, by) {
  const { r, theta } = cycloidThrough(bx, by);
  return theta > Math.PI ? 2 * r : by;
}

export function linePoints(bx, by) {
  return Float64Array.of(0, 0, bx, by);
}

export function lineTime(bx, by, g = G) {
  return Math.sqrt((2 * (bx * bx + by * by)) / (g * by));
}

// Galileo's candidate: the circle through A and B that leaves A straight
// down, centred on the horizontal through A.
export function arcPoints(bx, by, n = 400) {
  const R = (bx * bx + by * by) / (2 * bx);
  const end = Math.atan2(by, R - bx);
  const pts = new Float64Array(2 * n + 2);
  for (let i = 0; i <= n; i++) {
    const t = (end * i) / n;
    pts[2 * i] = R - R * Math.cos(t);
    pts[2 * i + 1] = R * Math.sin(t);
  }
  pts[2 * n] = bx;
  pts[2 * n + 1] = by;
  return pts;
}

// A parabola on its side, x = bx (y / by)^2, also vertical at A.
export function parabolaPoints(bx, by, n = 400) {
  const pts = new Float64Array(2 * n + 2);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts[2 * i] = bx * u * u;
    pts[2 * i + 1] = by * u;
  }
  return pts;
}

export const CURVES = [
  { id: 'cycloid', name: 'Cycloid', points: cycloidPoints },
  { id: 'arc', name: 'Circular arc', points: arcPoints },
  { id: 'parabola', name: 'Parabola', points: parabolaPoints },
  { id: 'line', name: 'Straight ramp', points: linePoints },
];
