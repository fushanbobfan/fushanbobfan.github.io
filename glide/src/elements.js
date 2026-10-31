import { cellOps, cartesian, det, toFrac, toCart } from './groups.js';

const EPS = 1e-7;
const frac = (v) => {
  const f = v - Math.floor(v);
  return f > 1 - EPS ? 0 : f;
};

// Smallest k with M^k = I, for the integer matrices of a wallpaper group.
export function orderOf(m) {
  let p = [1, 0, 0, 1];
  for (let k = 1; k <= 6; k++) {
    p = [m[0] * p[0] + m[1] * p[2], m[0] * p[1] + m[1] * p[3], m[2] * p[0] + m[3] * p[2], m[2] * p[1] + m[3] * p[3]];
    if (p[0] === 1 && p[1] === 0 && p[2] === 0 && p[3] === 1) return k;
  }
  return Infinity;
}

// Fixed point of a rotation x -> M x + t in fractional coordinates: (I - M) c = t.
function centreOf(m, t) {
  const a = 1 - m[0], b = -m[1], c = -m[2], d = 1 - m[3];
  const D = a * d - b * c;
  return [(d * t[0] - b * t[1]) / D, (a * t[1] - c * t[0]) / D];
}

// Rotation centres in the unit cell [0, 1)^2, each with the largest order of
// rotation about it.
export function cellCentres(group) {
  const found = new Map();
  for (const o of cellOps(group)) {
    if (det(o) !== 1) continue;
    const k = orderOf(o.m);
    if (k === 1) continue;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const [u, v] = centreOf(o.m, [o.t[0] + i, o.t[1] + j]).map(frac);
        const key = `${u.toFixed(5)},${v.toFixed(5)}`;
        const prev = found.get(key);
        if (!prev || prev.order < k) found.set(key, { u, v, order: k });
      }
    }
  }
  return [...found.values()];
}

// A reflection-type map x -> A x + w in the plane fixes the line through
// (w - A w) / 4 along its axis, and slides along it by (w + A w) / 2.
export function reflectionLine(t) {
  const [a, b, c, d, e, f] = t;
  const Aw = [a * e + c * f, b * e + d * f];
  const p = [(e - Aw[0]) / 4, (f - Aw[1]) / 4];
  const s = [(e + Aw[0]) / 2, (f + Aw[1]) / 2];
  // axis: eigenvector of A for eigenvalue 1
  let dir = Math.abs(a - 1) + Math.abs(b) > EPS ? [c, 1 - a] : [1 - d, b];
  if (Math.abs(dir[0]) + Math.abs(dir[1]) < EPS) dir = [1, 0];
  const n = Math.hypot(dir[0], dir[1]);
  return { p, d: [dir[0] / n, dir[1] / n], s };
}

// Symmetry elements that meet a view rectangle, in plane coordinates: rotation
// centres with their order, and mirror and glide lines.
export function elements(group, B, view) {
  const corners = [[view.x0, view.y0], [view.x1, view.y0], [view.x0, view.y1], [view.x1, view.y1]].map((q) => toFrac(q, B));
  const u0 = Math.floor(Math.min(...corners.map((c) => c[0]))) - 1;
  const u1 = Math.ceil(Math.max(...corners.map((c) => c[0]))) + 1;
  const v0 = Math.floor(Math.min(...corners.map((c) => c[1]))) - 1;
  const v1 = Math.ceil(Math.max(...corners.map((c) => c[1]))) + 1;
  const inside = ([x, y]) => x >= view.x0 - EPS && x <= view.x1 + EPS && y >= view.y0 - EPS && y <= view.y1 + EPS;

  const centres = [];
  for (const c of cellCentres(group)) {
    for (let i = u0; i <= u1; i++) {
      for (let j = v0; j <= v1; j++) {
        const [x, y] = toCart([c.u + i, c.v + j], B);
        if (inside([x, y])) centres.push({ x, y, order: c.order });
      }
    }
  }

  const lines = new Map();
  for (const o of cellOps(group)) {
    if (det(o) !== -1) continue;
    const base = cartesian(o, B);
    for (let i = u0; i <= u1; i++) {
      for (let j = v0; j <= v1; j++) {
        const [dx, dy] = toCart([i, j], B);
        const L = reflectionLine([base[0], base[1], base[2], base[3], base[4] + dx, base[5] + dy]);
        let [ex, ey] = L.d;
        if (ey < -EPS || (Math.abs(ey) < EPS && ex < 0)) [ex, ey] = [-ex, -ey];
        const rho = L.p[0] * -ey + L.p[1] * ex;
        // the line must cross the view
        const ds = [[view.x0, view.y0], [view.x1, view.y0], [view.x0, view.y1], [view.x1, view.y1]].map(([x, y]) => x * -ey + y * ex - rho);
        if (Math.min(...ds) > EPS || Math.max(...ds) < -EPS) continue;
        const key = `${Math.atan2(ey, ex).toFixed(5)}|${rho.toFixed(5)}`;
        const sf = toFrac(L.s, B);
        const mirror = sf.every((v) => Math.abs(v - Math.round(v)) < 1e-6);
        const prev = lines.get(key);
        if (!prev) lines.set(key, { px: L.p[0], py: L.p[1], dx: ex, dy: ey, mirror });
        else prev.mirror ||= mirror;
      }
    }
  }
  return { centres, lines: [...lines.values()] };
}
