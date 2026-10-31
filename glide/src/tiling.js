import { cellOps, cartesian, toFrac, toCart } from './groups.js';

// Move a stroke by a whole lattice vector so that its first point lies in the
// unit cell. Copies then only need translations near the view.
export function anchor(points, B) {
  if (!points.length) return points;
  const [u, v] = toFrac(points[0], B);
  const s = toCart([Math.floor(u), Math.floor(v)], B);
  return points.map(([x, y]) => [x - s[0], y - s[1]]);
}

// Fractional bounding box of a rectangle in the plane.
function fracBox(rect, B) {
  const corners = [
    [rect.x0, rect.y0], [rect.x1, rect.y0], [rect.x0, rect.y1], [rect.x1, rect.y1],
  ].map((p) => toFrac(p, B));
  const us = corners.map((c) => c[0]);
  const vs = corners.map((c) => c[1]);
  return { u0: Math.min(...us), u1: Math.max(...us), v0: Math.min(...vs), v1: Math.max(...vs) };
}

// Every Cartesian copy [a, b, c, d, e, f] of a stroke anchored in the unit
// cell that can reach the view. `reach` is how far, in plane units, the stroke
// extends from its anchor cell.
export function copies(group, B, view, reach = 0) {
  const box = fracBox({ x0: view.x0 - reach, y0: view.y0 - reach, x1: view.x1 + reach, y1: view.y1 + reach }, B);
  const out = [];
  for (const o of cellOps(group)) {
    const base = cartesian(o, B);
    // The image of the unit cell under o lies within two cells of its origin.
    for (let i = Math.floor(box.u0) - 2; i <= Math.ceil(box.u1) + 1; i++) {
      for (let j = Math.floor(box.v0) - 2; j <= Math.ceil(box.v1) + 1; j++) {
        const [dx, dy] = toCart([i, j], B);
        out.push([base[0], base[1], base[2], base[3], base[4] + dx, base[5] + dy]);
      }
    }
  }
  return out;
}

// Plane units a stroke spans beyond its anchor cell.
export function reachOf(points, B) {
  let r = 0;
  const cell = [toCart([0, 0], B), toCart([1, 0], B), toCart([0, 1], B), toCart([1, 1], B)];
  const xs = cell.map((p) => p[0]);
  const ys = cell.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (const [x, y] of points) {
    r = Math.max(r, x0 - x, x - x1, y0 - y, y - y1);
  }
  return r;
}

export const applyAffine = (t, [x, y]) => [t[0] * x + t[2] * y + t[4], t[1] * x + t[3] * y + t[5]];
