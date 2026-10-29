// Velocity analysis for a solved pose, per unit crank speed.
//
// Differentiating the loop A + r2 + r3 = D + r4 (crank r2 = B - A,
// coupler r3 = C - B, rocker r4 = C - D) gives
//   w2 r2' + w3 r3' = w4 r4',   where r' is r turned a quarter turn.
// Dotting with r4 removes w4 and dotting with r3 removes w3:
//   w3 = -w2 (r2 x r4) / (r3 x r4),   w4 = w2 (r2 x r3) / (r4 x r3).
// Both blow up at a toggle, where coupler and rocker line up.

const cross = (p, q) => p.x * q.y - p.y * q.x;
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const perp = (p, w) => ({ x: -w * p.y, y: w * p.x });

export function velocities(link, pose, w2 = 1) {
  const r2 = sub(pose.B, link.A);
  const r3 = sub(pose.C, pose.B);
  const r4 = sub(pose.C, link.D);
  const den = cross(r3, r4);
  if (Math.abs(den) < 1e-12 * Math.hypot(r3.x, r3.y) * Math.hypot(r4.x, r4.y)) return null;
  const w3 = (-w2 * cross(r2, r4)) / den;
  const w4 = (w2 * cross(r2, r3)) / -den;
  const vB = perp(r2, w2);
  const bp = perp(sub(pose.P, pose.B), w3);
  const vP = { x: vB.x + bp.x, y: vB.y + bp.y };
  return { w3, w4, vB, vC: perp(r4, w4), vP, speed: Math.hypot(vP.x, vP.y) };
}

// A colour for a speed between lo and hi, running from deep blue through
// teal and green to yellow.
const RAMP = [
  [36, 46, 120],
  [33, 113, 181],
  [32, 170, 160],
  [120, 205, 90],
  [253, 231, 37],
];

export function speedColor(speed, lo, hi) {
  const t = hi > lo ? Math.max(0, Math.min(1, (speed - lo) / (hi - lo))) : 0.5;
  const x = t * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const f = x - i;
  const c = RAMP[i].map((v, k) => Math.round(v + (RAMP[i + 1][k] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Speed limits for colouring a sampled curve. The top end is a high
// percentile, so the near-infinite speeds next to a toggle do not wash out
// the rest of the curve.
export function speedRange(speeds, q = 0.95) {
  const s = speeds.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return { lo: 0, hi: 1 };
  return { lo: s[0], hi: s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] };
}
