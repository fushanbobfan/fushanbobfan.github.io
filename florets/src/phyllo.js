// Vogel's model of a sunflower head and the arithmetic behind its spirals.
// Angles are kept in turns (1 turn = 360 degrees) unless a name says Deg.

export const PHI = (1 + Math.sqrt(5)) / 2;
export const GOLDEN_TURNS = 2 - PHI; // 0.381966..., the smaller golden angle
export const GOLDEN_DEG = 360 * GOLDEN_TURNS; // 137.5077...

// Floret n sits at radius c * sqrt(n) and angle n * d. The square root keeps
// the area per floret constant, so the head fills evenly as it grows.
export function floretPosition(n, turns, spacing = 1) {
  const r = spacing * Math.sqrt(n);
  const a = 2 * Math.PI * n * turns;
  return { x: r * Math.cos(a), y: r * Math.sin(a), r };
}

export function florets(count, turns, spacing = 1) {
  const pts = new Array(count);
  for (let n = 0; n < count; n++) pts[n] = floretPosition(n, turns, spacing);
  return pts;
}

// Continued fraction [a0; a1, a2, ...] of x, stopping when the remainder is
// within eps of an integer (so rational angles give finite expansions).
export function continuedFraction(x, maxTerms = 12, eps = 1e-9) {
  const terms = [];
  let v = x;
  for (let i = 0; i < maxTerms; i++) {
    const a = Math.floor(v + eps);
    terms.push(a);
    const rest = v - a;
    if (Math.abs(rest) < eps) break;
    v = 1 / rest;
    if (!Number.isFinite(v) || v > 1 / eps) break;
  }
  return terms;
}

// Convergents p/q of a continued fraction. Their denominators are the
// candidate parastichy numbers: floret n and n + q sit almost on the same ray.
export function convergents(terms) {
  const out = [];
  let p0 = 1, q0 = 0, p1 = terms[0], q1 = 1;
  out.push({ p: p1, q: q1 });
  for (let i = 1; i < terms.length; i++) {
    const a = terms[i];
    const p = a * p1 + p0;
    const q = a * q1 + q0;
    out.push({ p, q });
    p0 = p1; q0 = q1; p1 = p; q1 = q;
  }
  return out;
}

export function distance(n, m, turns) {
  const a = floretPosition(n, turns);
  const b = floretPosition(m, turns);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Index steps k ordered by how close floret n + k (or n - k) lies to floret n.
export function neighbourSteps(n, turns, kMax = 400) {
  const steps = [];
  for (let k = 1; k <= kMax; k++) {
    let d = distance(n, n + k, turns);
    if (k <= n) d = Math.min(d, distance(n, n - k, turns));
    steps.push({ k, d });
  }
  steps.sort((s, t) => s.d - t.d);
  return steps;
}

// The contact parastichies at floret n: the two nearest index steps that point
// in different directions. A multiple of the first step lies on the same line,
// so it is skipped. Returns [smaller, larger].
export function contactPair(n, turns, kMax = 400) {
  const steps = neighbourSteps(n, turns, Math.max(2, kMax));
  const k1 = steps[0].k;
  const second = steps.find((s) => s.k % k1 !== 0);
  const k2 = second ? second.k : 2 * k1;
  return k1 < k2 ? [k1, k2] : [k2, k1];
}

// Which way a family of spirals winds, seen with y pointing up: stepping from
// n to n + k turns by k * d, wrapped into (-1/2, 1/2].
export function winding(k, turns) {
  let w = (k * turns) % 1;
  if (w > 0.5) w -= 1;
  if (w <= -0.5) w += 1;
  return w >= 0 ? 'counterclockwise' : 'clockwise';
}

// Each floret owns an area of pi * c^2. Packed as a hexagonal lattice, that
// area gives neighbours this far apart (in units of c).
export const HEX_SPACING = Math.sqrt((2 * Math.PI) / Math.sqrt(3));

// The tightest squeeze anywhere in the head: the smallest nearest-neighbour
// gap over the hexagonal spacing, skipping the first few florets at the centre.
// 1 would be a perfect hexagonal lattice everywhere; florets crowding onto
// spokes or rings at some radius pull it down.
export function packing(points, skip = 10) {
  const count = points.length;
  const kMax = Math.ceil(4 * Math.sqrt(count)) + 8;
  let worst = Infinity;
  for (let n = skip; n < count; n++) {
    const p = points[n];
    let best = Infinity;
    for (let k = 1; k <= kMax; k++) {
      if (n + k < count) {
        const q = points[n + k];
        best = Math.min(best, (p.x - q.x) ** 2 + (p.y - q.y) ** 2);
      }
      if (k <= n) {
        const q = points[n - k];
        best = Math.min(best, (p.x - q.x) ** 2 + (p.y - q.y) ** 2);
      }
    }
    worst = Math.min(worst, best);
  }
  return Number.isFinite(worst) ? Math.sqrt(worst) / HEX_SPACING : 0;
}

export function fibonacciUpTo(limit) {
  const f = [1, 2];
  while (f[f.length - 1] + f[f.length - 2] <= limit) f.push(f[f.length - 1] + f[f.length - 2]);
  return f;
}
