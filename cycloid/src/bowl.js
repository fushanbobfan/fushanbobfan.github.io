// Two bowls with their rims level with A (y = 0) and their bottoms at y = 2r:
// an upturned cycloid, and the circle with the same curvature at the bottom
// (radius 4r). A position on a bowl is s in [-1, 1], with 0 at the bottom.

import { G } from './motion.js';

export const BOWL_R = 0.6;
export const BOWL_CX = 2;

export function bowlPoint(kind, s, r = BOWL_R, cx = BOWL_CX) {
  if (kind === 'circle') {
    const R = 4 * r;
    const phi = (s * Math.PI) / 3; // R (1 - cos(pi/3)) = 2r: the rim is level with A
    return [cx + R * Math.sin(phi), 2 * r - R * (1 - Math.cos(phi))];
  }
  const t = Math.PI * (1 + s);
  return [cx + r * (t - Math.PI - Math.sin(t)), r * (1 - Math.cos(t))];
}

export function bowlPoints(kind, n = 400, r = BOWL_R, cx = BOWL_CX) {
  const pts = new Float64Array(2 * n + 2);
  for (let i = 0; i <= n; i++) pts.set(bowlPoint(kind, -1 + (2 * i) / n, r, cx), 2 * i);
  return pts;
}

// From release at s0 down through the bottom and up to the mirror point
// -s0, which is at the same height. The bottom is vertex n.
export function swingPoints(kind, s0, n = 300, r = BOWL_R, cx = BOWL_CX) {
  const pts = new Float64Array(4 * n + 2);
  for (let i = 0; i <= 2 * n; i++) {
    const s = i <= n ? s0 * (1 - i / n) : (-s0 * (i - n)) / n;
    pts.set(bowlPoint(kind, s, r, cx), 2 * i);
  }
  return { pts, bottom: n };
}

// Complete elliptic integral of the first kind by the arithmetic-geometric mean.
export function ellipticK(k) {
  let a = 1, b = Math.sqrt(1 - k * k);
  for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15 * a; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return Math.PI / (2 * a);
}

// Time from rest at s0 to the bottom. On the cycloid it is pi sqrt(r/g) from
// every start; on the circle it is the quarter period of a pendulum of
// length 4r swung out to angle phi0, which grows with the amplitude.
export function timeToBottom(kind, s0, r = BOWL_R, g = G) {
  if (kind === 'circle') {
    const phi0 = (Math.abs(s0) * Math.PI) / 3;
    return Math.sqrt((4 * r) / g) * ellipticK(Math.sin(phi0 / 2));
  }
  return Math.PI * Math.sqrt(r / g);
}

// The position on the bowl nearest to a point, for placing beads by clicking.
export function nearestS(kind, x, y, r = BOWL_R, cx = BOWL_CX, n = 800) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i <= n; i++) {
    const s = -1 + (2 * i) / n;
    const [px, py] = bowlPoint(kind, s, r, cx);
    const d = Math.hypot(px - x, py - y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return { s: best, distance: bestD };
}
