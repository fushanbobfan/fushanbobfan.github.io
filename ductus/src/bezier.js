// Bézier curve geometry on plain {x, y} points. No DOM.

export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// Every level of de Casteljau's construction at t: levels[0] is the control
// polygon, each following level has one point fewer, the last holds the point
// on the curve.
export function deCasteljau(points, t) {
  const levels = [points.map((p) => ({ x: p.x, y: p.y }))];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next = [];
    for (let i = 0; i < prev.length - 1; i++) next.push(lerp(prev[i], prev[i + 1], t));
    levels.push(next);
  }
  return levels;
}

export function pointAt(points, t) {
  const levels = deCasteljau(points, t);
  return levels[levels.length - 1][0];
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

// Control points of the derivative curve, a Bézier curve of one degree less.
export function hodograph(points) {
  const n = points.length - 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: n * (points[i + 1].x - points[i].x), y: n * (points[i + 1].y - points[i].y) });
  }
  return out;
}

export function derivative(points, t) {
  if (points.length < 2) return { x: 0, y: 0 };
  return pointAt(hodograph(points), t);
}

export function secondDerivative(points, t) {
  if (points.length < 3) return { x: 0, y: 0 };
  return pointAt(hodograph(hodograph(points)), t);
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
  const n = points.length - 1;
  const out = [{ ...points[0] }];
  for (let i = 1; i <= n; i++) {
    const a = i / (n + 1);
    out.push({
      x: a * points[i - 1].x + (1 - a) * points[i].x,
      y: a * points[i - 1].y + (1 - a) * points[i].y,
    });
  }
  out.push({ ...points[n] });
  return out;
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
