// Bézier curve geometry on plain {x, y} points. No DOM.
//
// A point may carry a weight `w` (default 1), which makes the curve rational.
// Every operation runs on homogeneous coordinates (x·w, y·w, w) and projects
// back, so with all weights 1 it is the ordinary polynomial curve.

const weight = (p) => (p.w === undefined ? 1 : p.w);
const toH = (p) => { const w = weight(p); return { x: p.x * w, y: p.y * w, w }; };
const fromH = (h) => ({ x: h.x / h.w, y: h.y / h.w, w: h.w });
const lerpH = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t });

export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export const isRational = (points) => points.some((p) => weight(p) !== 1);

function levelsH(points, t) {
  const levels = [points.map(toH)];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next = [];
    for (let i = 0; i < prev.length - 1; i++) next.push(lerpH(prev[i], prev[i + 1], t));
    levels.push(next);
  }
  return levels;
}

// Every level of de Casteljau's construction at t: levels[0] is the control
// polygon, each following level has one point fewer, the last holds the point
// on the curve. Points carry the weight they have at that level.
export function deCasteljau(points, t) {
  return levelsH(points, t).map((lv) => lv.map(fromH));
}

export function pointAt(points, t) {
  const levels = levelsH(points, t);
  return fromH(levels[levels.length - 1][0]);
}

// The two halves of the curve split at t, read off the edges of the
// construction triangle. Each half has as many control points as the whole.
export function split(points, t) {
  const levels = deCasteljau(points, t);
  return {
    left: levels.map((lv) => lv[0]),
    right: levels.map((lv) => lv[lv.length - 1]).reverse(),
  };
}

// Control points of the derivative of a polynomial curve, one degree less.
// For a rational curve this is the derivative of its homogeneous form.
export function hodograph(points) {
  const n = points.length - 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[i + 1];
    const d = { x: n * (b.x - a.x), y: n * (b.y - a.y) };
    if (a.w !== undefined || b.w !== undefined) d.w = n * (weight(b) - weight(a));
    out.push(d);
  }
  return out;
}

function evalH(hpoints, t) {
  if (hpoints.length === 0) return { x: 0, y: 0, w: 0 };
  const levels = [hpoints];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next = [];
    for (let i = 0; i < prev.length - 1; i++) next.push(lerpH(prev[i], prev[i + 1], t));
    levels.push(next);
  }
  return levels[levels.length - 1][0];
}

// Homogeneous value and first two derivatives at t.
function jets(points, t) {
  const h0 = points.map(toH);
  const h1 = hodograph(h0);
  const h2 = h1.length ? hodograph(h1) : [];
  return [evalH(h0, t), evalH(h1, t), evalH(h2, t)];
}

export function derivative(points, t) {
  if (points.length < 2) return { x: 0, y: 0 };
  const [H, D] = jets(points, t);
  const c = { x: H.x / H.w, y: H.y / H.w };
  return { x: (D.x - c.x * D.w) / H.w, y: (D.y - c.y * D.w) / H.w };
}

export function secondDerivative(points, t) {
  if (points.length < 3) return { x: 0, y: 0 };
  const [H, D, E] = jets(points, t);
  const c = { x: H.x / H.w, y: H.y / H.w };
  const d = { x: (D.x - c.x * D.w) / H.w, y: (D.y - c.y * D.w) / H.w };
  return {
    x: (E.x - 2 * d.x * D.w - c.x * E.w) / H.w,
    y: (E.y - 2 * d.y * D.w - c.y * E.w) / H.w,
  };
}

// Signed curvature: positive when the curve turns counter-clockwise in a
// y-up frame (clockwise on a y-down screen). Zero where the speed vanishes.
export function curvature(points, t) {
  const d1 = derivative(points, t);
  const d2 = secondDerivative(points, t);
  const speed2 = d1.x * d1.x + d1.y * d1.y;
  if (speed2 < 1e-18) return 0;
  return (d1.x * d2.y - d1.y * d2.x) / Math.pow(speed2, 1.5);
}

// Unit normal pointing to the left of the direction of travel (y-up frame).
export function normal(points, t) {
  const d = derivative(points, t);
  const len = Math.hypot(d.x, d.y);
  if (len < 1e-12) return { x: 0, y: 0 };
  return { x: -d.y / len, y: d.x / len };
}

// Same curve, one more control point.
export function elevate(points) {
  const h = points.map(toH);
  const n = h.length - 1;
  const out = [h[0]];
  for (let i = 1; i <= n; i++) out.push(lerpH(h[i], h[i - 1], i / (n + 1)));
  out.push(h[n]);
  const rational = isRational(points);
  return out.map((q) => {
    const p = fromH(q);
    return rational ? p : { x: p.x, y: p.y };
  });
}

export function sample(points, count) {
  const out = [];
  for (let i = 0; i <= count; i++) out.push(pointAt(points, i / count));
  return out;
}

// Arc length by Gauss-Legendre quadrature of the speed on `pieces` subintervals.
const GL_X = [-0.906179845938664, -0.538469310105683, 0, 0.538469310105683, 0.906179845938664];
const GL_W = [0.236926885056189, 0.478628670499366, 0.568888888888889, 0.478628670499366, 0.236926885056189];

export function arcLength(points, t0 = 0, t1 = 1, pieces = 16) {
  let total = 0;
  const h = (t1 - t0) / pieces;
  for (let k = 0; k < pieces; k++) {
    const a = t0 + k * h;
    for (let j = 0; j < GL_X.length; j++) {
      const d = derivative(points, a + (GL_X[j] + 1) * h / 2);
      total += GL_W[j] * Math.hypot(d.x, d.y) * h / 2;
    }
  }
  return total;
}

// A quadratic with end weights 1 is a conic, and the middle weight says which.
export function conicKind(points) {
  if (points.length !== 3 || weight(points[0]) !== 1 || weight(points[2]) !== 1) return null;
  const w = weight(points[1]);
  if (Math.abs(w - 1) < 1e-9) return 'parabola';
  return w < 1 ? 'ellipse' : 'hyperbola';
}

// The weight that turns a quadratic with equal legs into an exact circular arc.
export function circleWeight(points) {
  const [a, b, c] = points;
  const u = { x: a.x - b.x, y: a.y - b.y };
  const v = { x: c.x - b.x, y: c.y - b.y };
  const cosB = (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
  // The arc's half angle is (π − B)/2, and the weight is its cosine: sin(B/2).
  return Math.sqrt((1 - cosB) / 2);
}
