// Position analysis of a planar four-bar linkage.
//
// A and D are the fixed pivots. The crank AB (length a) turns about A, the
// coupler BC (length b) joins it to the rocker DC (length c) that swings
// about D. The coupler point P is fixed to the coupler: P = B + u*e + v*n,
// where e is the unit vector from B to C and n is e turned a quarter turn
// anticlockwise. `branch` (+1 or -1) picks one of the two ways the loop can
// close for a given crank angle.

export function ground(link) {
  const dx = link.D.x - link.A.x;
  const dy = link.D.y - link.A.y;
  return { g: Math.hypot(dx, dy), phi: Math.atan2(dy, dx) };
}

export function solve(link, theta, branch = 1) {
  const { A, D, a, b, c, u = 0, v = 0 } = link;
  const B = { x: A.x + a * Math.cos(theta), y: A.y + a * Math.sin(theta) };
  const dx = D.x - B.x;
  const dy = D.y - B.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-12) return null;
  const x = (b * b - c * c + d * d) / (2 * d);
  let h2 = b * b - x * x;
  if (h2 < 0) {
    if (h2 < -1e-9 * b * b) return null;
    h2 = 0;
  }
  const h = branch * Math.sqrt(h2);
  const ux = dx / d;
  const uy = dy / d;
  const C = { x: B.x + x * ux - h * uy, y: B.y + x * uy + h * ux };
  const ex = (C.x - B.x) / b;
  const ey = (C.y - B.y) / b;
  const P = { x: B.x + u * ex - v * ey, y: B.y + u * ey + v * ex };
  // Transmission angle: the angle between coupler and rocker at C.
  const cosMu = Math.max(-1, Math.min(1, (b * b + c * c - d * d) / (2 * b * c)));
  return { theta, branch, B, C, P, mu: Math.acos(cosMu) };
}

// The coupler point offsets (u, v) that put P at a given place when the
// coupler runs from B to C.
export function couplerOffsets(B, C, P) {
  const b = Math.hypot(C.x - B.x, C.y - B.y);
  const ex = (C.x - B.x) / b;
  const ey = (C.y - B.y) / b;
  const px = P.x - B.x;
  const py = P.y - B.y;
  return { u: px * ex + py * ey, v: -px * ey + py * ex };
}

// The branch a solved pose belongs to: the sign of the turn from B->D to B->C.
export function branchOf(B, C, D) {
  const cross = (D.x - B.x) * (C.y - B.y) - (D.y - B.y) * (C.x - B.x);
  return cross >= 0 ? 1 : -1;
}

const TAU = 2 * Math.PI;

export function wrap(angle) {
  return ((angle % TAU) + TAU) % TAU;
}

// The crank angles the loop can close for, as the arc that contains theta.
// Returns { full: true } when the crank turns all the way round, otherwise
// { full: false, lo, hi } with lo <= theta <= hi (unwrapped around theta),
// or null when the loop cannot close at theta at all.
export function crankArc(link, theta) {
  const { a, b, c } = link;
  const { g, phi } = ground(link);
  const k1 = (a * a + g * g - (b + c) ** 2) / (2 * a * g);
  const k2 = (a * a + g * g - (b - c) ** 2) / (2 * a * g);
  if (k1 > 1 || k2 < -1) return null;
  if (k1 <= -1 && k2 >= 1) return { full: true };
  const alpha = k2 >= 1 ? 0 : Math.acos(k2);
  const beta = k1 <= -1 ? Math.PI : Math.acos(k1);
  // psi measured from the ground line, in (-pi, pi]
  let psi = wrap(theta - phi);
  if (psi > Math.PI) psi -= TAU;
  const eps = 1e-9;
  let lo;
  let hi;
  if (alpha === 0) {
    if (Math.abs(psi) > beta + eps) return null;
    lo = -beta;
    hi = beta;
  } else if (beta === Math.PI) {
    let q = wrap(psi);
    if (q < alpha - eps || q > TAU - alpha + eps) return null;
    lo = alpha;
    hi = TAU - alpha;
    psi = q;
  } else if (psi >= alpha - eps && psi <= beta + eps) {
    lo = alpha;
    hi = beta;
  } else if (psi <= -alpha + eps && psi >= -beta - eps) {
    lo = -beta;
    hi = -alpha;
  } else {
    return null;
  }
  const base = theta - psi;
  return { full: false, lo: base + lo, hi: base + hi };
}

// One full cycle of motion starting from (theta, branch), as n poses.
// A crank that turns fully stays on its branch. A crank that cannot turn
// reaches a toggle at each end of its arc, where coupler and rocker line up,
// and the loop carries on in the other branch on the way back.
export function cycle(link, theta, branch = 1, n = 720) {
  const arc = crankArc(link, theta);
  if (!arc) return null;
  const poses = [];
  if (arc.full) {
    for (let i = 0; i < n; i++) {
      const p = solve(link, theta + (TAU * i) / n, branch);
      if (p) poses.push(p);
    }
    return { full: true, poses };
  }
  const span = arc.hi - arc.lo;
  // Walk forward from theta to hi, back to lo on the other branch, and
  // forward again to theta. The coupler moves like sqrt(distance to the
  // toggle), so samples are spaced as cos(pi f) to stay even along the curve.
  const f0 = Math.acos(Math.max(-1, Math.min(1, 1 - (2 * (theta - arc.lo)) / span))) / Math.PI;
  for (let i = 0; i < n; i++) {
    const f = wrapLength(f0 + (2 * i) / n, 2);
    const onWayUp = f <= 1;
    const t = arc.lo + (span * (1 - Math.cos(Math.PI * f))) / 2;
    const p = solve(link, t, onWayUp ? branch : -branch);
    if (p) poses.push(p);
  }
  return { full: false, lo: arc.lo, hi: arc.hi, poses };
}

function wrapLength(x, len) {
  return ((x % len) + len) % len;
}

// Advance the input by dtheta, bouncing off the ends of the arc for a crank
// that cannot turn fully. The direction flips and so does the branch.
export function step(link, state, dtheta) {
  const arc = crankArc(link, state.theta);
  if (!arc) return state;
  if (arc.full) return { theta: wrap(state.theta + state.dir * dtheta), branch: state.branch, dir: state.dir };
  let { theta, branch, dir } = state;
  let left = dtheta;
  for (let guard = 0; guard < 8 && left > 0; guard++) {
    const room = dir > 0 ? arc.hi - theta : theta - arc.lo;
    if (left <= room) {
      theta += dir * left;
      left = 0;
    } else {
      theta += dir * room;
      left -= room;
      dir = -dir;
      branch = -branch;
    }
  }
  return { theta, branch, dir };
}
