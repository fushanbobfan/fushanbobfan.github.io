// Geometry of the Tonnetz. Nodes sit on a triangular lattice addressed by
// axial coordinates (q, r). One step in q is a perfect fifth, one step in r a
// major third, so the third direction, (q + 1, r - 1), is a minor third.
//
//        E ---- B
//       / \ Em / \
//      /  C \ /    \        up triangle (q, r):    major triad on pc(q, r)
//     C ---- G ---- D       down triangle (q, r):  minor triad on pc(q, r) + 4
//
// Every triangle is a triad and two triangles share an edge exactly when the
// triads are related by P, L or R.

import { mod12 } from './pitch.js';
import { triad } from './chords.js';

const H = Math.sqrt(3) / 2;

export function pcAt(q, r) {
  return mod12(7 * q + 4 * r);
}

// Lattice to screen: unit edge length, y grows downward, so major thirds
// climb up and to the right.
export function toScreen(q, r) {
  return { x: q + r / 2, y: -r * H };
}

export function toLattice(x, y) {
  const r = -y / H;
  return { q: x - r / 2, r };
}

export function triangleVertices(tri) {
  const { q, r, up } = tri;
  return up
    ? [[q, r], [q + 1, r], [q, r + 1]]
    : [[q + 1, r], [q, r + 1], [q + 1, r + 1]];
}

export function triangleTriad(tri) {
  return tri.up ? triad(pcAt(tri.q, tri.r), 'M') : triad(pcAt(tri.q, tri.r) + 4, 'm');
}

export function triangleCentroid(tri) {
  const v = triangleVertices(tri).map(([q, r]) => toScreen(q, r));
  return { x: (v[0].x + v[1].x + v[2].x) / 3, y: (v[0].y + v[1].y + v[2].y) / 3 };
}

export function sameTriangle(a, b) {
  return a.q === b.q && a.r === b.r && a.up === b.up;
}

// The triangle across the edge that P, L or R keeps.
export function neighbour(tri, move) {
  const { q, r, up } = tri;
  if (up) {
    if (move === 'P') return { q, r: r - 1, up: false };
    if (move === 'L') return { q, r, up: false };
    if (move === 'R') return { q: q - 1, r, up: false };
  } else {
    if (move === 'P') return { q, r: r + 1, up: true };
    if (move === 'L') return { q, r, up: true };
    if (move === 'R') return { q: q + 1, r, up: true };
  }
  throw new Error(`unknown move ${move}`);
}

// Walks a P/L/R word from a triangle, returning every triangle visited
// including the start.
export function walk(tri, word) {
  const out = [tri];
  for (const ch of word) out.push(neighbour(out[out.length - 1], ch));
  return out;
}

// The triangle containing a screen point.
export function triangleAt(x, y) {
  const { q, r } = toLattice(x, y);
  const fq = Math.floor(q);
  const fr = Math.floor(r);
  const up = q - fq + (r - fr) < 1;
  return { q: fq, r: fr, up };
}

// The node nearest a screen point and its distance.
export function nodeAt(x, y) {
  const { q, r } = toLattice(x, y);
  let best = null;
  for (const dq of [0, 1]) {
    for (const dr of [0, 1]) {
      const nq = Math.floor(q) + dq;
      const nr = Math.floor(r) + dr;
      const p = toScreen(nq, nr);
      const d = Math.hypot(p.x - x, p.y - y);
      if (!best || d < best.distance) best = { q: nq, r: nr, distance: d };
    }
  }
  return best;
}

// All triangles whose triad matches `t` and whose centroid falls inside the
// screen-space box. Each triad recurs every 12 steps of fifths and every 3
// steps of major thirds, so the copies form their own lattice.
export function trianglesOf(t, box) {
  const out = [];
  const corners = [
    toLattice(box.x0, box.y0), toLattice(box.x1, box.y0),
    toLattice(box.x0, box.y1), toLattice(box.x1, box.y1),
  ];
  const qs = corners.map((c) => c.q);
  const rs = corners.map((c) => c.r);
  const r0 = Math.floor(Math.min(...rs)) - 1;
  const r1 = Math.ceil(Math.max(...rs)) + 1;
  const q0 = Math.floor(Math.min(...qs)) - 1;
  const q1 = Math.ceil(Math.max(...qs)) + 1;
  const up = t.quality === 'M';
  for (let r = r0; r <= r1; r++) {
    for (let q = q0; q <= q1; q++) {
      const tri = { q, r, up };
      const u = triangleTriad(tri);
      if (u.root !== t.root) continue;
      const c = triangleCentroid(tri);
      if (c.x >= box.x0 && c.x <= box.x1 && c.y >= box.y0 && c.y <= box.y1) out.push(tri);
    }
  }
  return out;
}

// The copy of triad `t` whose centroid is closest to the screen point.
export function nearestTriangleOf(t, x, y) {
  const span = 8;
  const all = trianglesOf(t, { x0: x - span, x1: x + span, y0: y - span, y1: y + span });
  let best = null;
  let bestD = Infinity;
  for (const tri of all) {
    const c = triangleCentroid(tri);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) {
      bestD = d;
      best = tri;
    }
  }
  return best;
}
