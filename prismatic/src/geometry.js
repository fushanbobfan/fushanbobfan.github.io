// Plane geometry for the tracer: vectors, boundary pieces and ray intersections.
// A boundary piece is either a straight segment or a circular arc, and carries
// the outward normal of the shape it belongs to.

export const EPS = 1e-9;
const TAU = Math.PI * 2;

export const vec = (x, y) => ({ x, y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const length = (a) => Math.hypot(a.x, a.y);

export function normalize(a) {
  const l = length(a);
  return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}

export function rotate(a, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

export function fromAngle(angle) {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function wrapAngle(a) {
  const w = a % TAU;
  return w < 0 ? w + TAU : w;
}

// A straight boundary from a to b. `normal` is the outward unit normal.
export function segment(a, b, normal) {
  return { type: 'segment', a, b, normal };
}

// A circular boundary centred on c with radius r, covering the angles from a0
// counter-clockwise through `span`. With sign +1 the shape lies inside the
// circle (convex face); with -1 it lies outside (concave face).
export function arc(c, r, a0, span, sign = 1) {
  return { type: 'arc', c, r, a0: wrapAngle(a0), span, sign };
}

// Distance along a ray (origin o, unit direction d) to a segment, or Infinity.
export function hitSegment(o, d, seg) {
  const e = sub(seg.b, seg.a);
  const denom = cross(d, e);
  if (Math.abs(denom) < EPS) return Infinity;
  const w = sub(seg.a, o);
  const t = cross(w, e) / denom;
  const u = cross(w, d) / denom;
  if (t <= EPS || u < -EPS || u > 1 + EPS) return Infinity;
  return t;
}

function onArc(p, a) {
  const ang = Math.atan2(p.y - a.c.y, p.x - a.c.x);
  return wrapAngle(ang - a.a0) <= a.span + 1e-12;
}

// Distance along a ray to the nearest point of an arc, or Infinity.
export function hitArc(o, d, a) {
  const oc = sub(o, a.c);
  const b = dot(oc, d);
  const c = dot(oc, oc) - a.r * a.r;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const root = Math.sqrt(disc);
  for (const t of [-b - root, -b + root]) {
    if (t > EPS && onArc(add(o, scale(d, t)), a)) return t;
  }
  return Infinity;
}

export function hitPiece(o, d, piece) {
  return piece.type === 'segment' ? hitSegment(o, d, piece) : hitArc(o, d, piece);
}

// Outward unit normal of a piece at a point on it.
export function normalAt(piece, p) {
  if (piece.type === 'segment') return piece.normal;
  return scale(normalize(sub(p, piece.c)), piece.sign);
}

// Closed polygon as segments with outward normals. Works for any vertex order.
export function polygon(points) {
  let area2 = 0;
  for (let i = 0; i < points.length; i++) {
    area2 += cross(points[i], points[(i + 1) % points.length]);
  }
  const orient = area2 >= 0 ? 1 : -1;
  return points.map((a, i) => {
    const b = points[(i + 1) % points.length];
    const e = normalize(sub(b, a));
    return segment(a, b, { x: e.y * orient, y: -e.x * orient });
  });
}
