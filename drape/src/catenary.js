// The catenary: the curve a uniform chain hangs in between two supports,
// Y = a cosh((x - x0) / a) + C with Y pointing up. Screen coordinates point
// down, so callers pass and receive y-down values and the flip happens here.

// Solve L_h = 2a sinh(h / 2a) for a, where L_h = sqrt(L^2 - v^2) is the chain
// length with the height difference taken out. The left side falls from
// infinity to h as a grows, so bisection on log a always brackets the root.
export function solveA(h, lh) {
  if (!(lh > h) || h <= 0) return NaN;
  const f = (a) => 2 * a * Math.sinh(h / (2 * a)) - lh;
  let lo = h * 1e-4;
  let hi = h * 1e4;
  while (f(lo) === Infinity) lo *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi);
    if (f(mid) > 0) lo = mid; else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

// The catenary of length `length` through (x1, y1) and (x2, y2), y down.
// Returns null when the chain is too short to reach or the supports stand
// one above the other.
export function catenary(x1, y1, x2, y2, length) {
  if (x2 < x1) [x1, y1, x2, y2] = [x2, y2, x1, y1];
  const h = x2 - x1;
  const v = y1 - y2;
  if (h <= 0 || length * length <= h * h + v * v) return null;
  const a = solveA(h, Math.sqrt(length * length - v * v));
  if (!Number.isFinite(a)) return null;
  const x0 = (x1 + x2) / 2 - a * Math.atanh(v / length);
  const c = -y1 - a * Math.cosh((x1 - x0) / a);
  const yAt = (x) => -(a * Math.cosh((x - x0) / a) + c);
  const lowest = x0 > x1 && x0 < x2 ? { x: x0, y: yAt(x0) } : y1 > y2 ? { x: x1, y: y1 } : { x: x2, y: y2 };
  return { a, x0, x1, x2, yAt, lowest };
}

// Root-mean-square vertical gap between the chain's particles and the curve.
export function rmsGap(curve, xs, ys) {
  let sum = 0;
  for (let i = 0; i < xs.length; i++) sum += (ys[i] - curve.yAt(xs[i])) ** 2;
  return Math.sqrt(sum / xs.length);
}
