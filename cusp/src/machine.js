// Zeeman's catastrophe machine: a wheel on a fixed pivot at the origin, with a
// pin at radius r. One elastic band runs from the pin to a fixed point A at
// (a, 0), the other from the pin to the control point C that the hand moves.
//
// A band of natural length l pulls only when stretched, so its energy is
// 1/2 k (L - l)^2 for L > l and 0 when slack. Everything is in units where the
// first band's stiffness is 1; s is the second band's stiffness relative to it.

export const CLASSICAL = Object.freeze({ r: 0.5, a: 2, l: 1, s: 1 });

const TAU = Math.PI * 2;

export function wrapAngle(theta) {
  const t = (theta + Math.PI) % TAU;
  return (t < 0 ? t + TAU : t) - Math.PI;
}

export function angleGap(from, to) {
  return wrapAngle(to - from);
}

export function pinPosition(m, theta) {
  return { x: m.r * Math.cos(theta), y: m.r * Math.sin(theta) };
}

function bandLength(r, qx, qy, c, sn) {
  return Math.hypot(qx - r * c, qy - r * sn);
}

// V(theta) for the control point at (cx, cy).
export function energy(m, cx, cy, theta) {
  const c = Math.cos(theta);
  const sn = Math.sin(theta);
  const stretchA = Math.max(0, bandLength(m.r, m.a, 0, c, sn) - m.l);
  const stretchC = Math.max(0, bandLength(m.r, cx, cy, c, sn) - m.l);
  return 0.5 * stretchA * stretchA + 0.5 * m.s * stretchC * stretchC;
}

// dV/dtheta. With u = r (qx sin - qy cos) a band's torque is (1 - l/L) u, zero
// while it is slack.
export function torque(m, cx, cy, theta) {
  const c = Math.cos(theta);
  const sn = Math.sin(theta);
  const la = bandLength(m.r, m.a, 0, c, sn);
  const lc = bandLength(m.r, cx, cy, c, sn);
  const ta = la > m.l ? (1 - m.l / la) * m.r * m.a * sn : 0;
  const tc = lc > m.l ? (1 - m.l / lc) * m.r * (cx * sn - cy * c) : 0;
  return ta + m.s * tc;
}

function bandDerivatives(m, qx, qy, c, sn) {
  const L = bandLength(m.r, qx, qy, c, sn);
  if (L <= m.l) return [0, 0];
  const u = m.r * (qx * sn - qy * c);
  const du = m.r * (qx * c + qy * sn);
  const f = 1 - m.l / L;
  const L3 = L * L * L;
  const second = (m.l * u * u) / L3 + f * du;
  const third = (3 * m.l * u * du) / L3 - (3 * m.l * u * u * u) / (L3 * L * L) - f * u;
  return [second, third];
}

// d2V/dtheta2, which jumps where a band goes slack.
export function curvature(m, cx, cy, theta) {
  const c = Math.cos(theta);
  const sn = Math.sin(theta);
  return bandDerivatives(m, m.a, 0, c, sn)[0] + m.s * bandDerivatives(m, cx, cy, c, sn)[0];
}

// d3V/dtheta3, used to pin down cusps, where the first three derivatives vanish.
export function thirdDerivative(m, cx, cy, theta) {
  const c = Math.cos(theta);
  const sn = Math.sin(theta);
  return bandDerivatives(m, m.a, 0, c, sn)[1] + m.s * bandDerivatives(m, cx, cy, c, sn)[1];
}

// Torque and curvature of the fixed band alone, at pin angle theta.
export function fixedBand(m, theta) {
  const c = Math.cos(theta);
  const sn = Math.sin(theta);
  const la = bandLength(m.r, m.a, 0, c, sn);
  const torqueA = la > m.l ? (1 - m.l / la) * m.r * m.a * sn : 0;
  return { torque: torqueA, curvature: bandDerivatives(m, m.a, 0, c, sn)[0] };
}

// The fixed band must stay taut all the way round, or the wheel has flat stretches.
export function isValidMachine(m) {
  return m.r > 0 && m.a > m.r && m.l > 0 && m.l < m.a - m.r && m.s > 0;
}
