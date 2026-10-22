// The p/q bulbs of the main cardioid.
//
// The main cardioid is where f_c has an attracting fixed point. On its
// boundary that fixed point's multiplier is e^{2 pi i t}, which happens at
// c(t) = e^{2 pi i t}/2 - e^{4 pi i t}/4. At every rational t = p/q a bulb of
// period q is attached; at irrational t nothing is attached.

import { nucleus, attractingCycle } from './cycle.js';

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

// Reduced fractions p/q in (0, 1) with q <= maxQ, in increasing order.
export function fractions(maxQ) {
  const list = [];
  for (let q = 2; q <= maxQ; q++) {
    for (let p = 1; p < q; p++) if (gcd(p, q) === 1) list.push([p, q]);
  }
  return list.sort((a, b) => a[0] * b[1] - b[0] * a[1]);
}

export function cardioidPoint(t) {
  const a = 2 * Math.PI * t;
  return [Math.cos(a) / 2 - Math.cos(2 * a) / 4, Math.sin(a) / 2 - Math.sin(2 * a) / 4];
}

// Unit normal pointing out of the cardioid at angle t (undefined at the cusp).
export function cardioidNormal(t) {
  const a = 2 * Math.PI * t;
  // (1/2) e^{ia} (1 - e^{ia}), the tangent turned a quarter clockwise
  const x = (Math.cos(a) - Math.cos(2 * a)) / 2;
  const y = (Math.sin(a) - Math.sin(2 * a)) / 2;
  const n = Math.hypot(x, y);
  return [x / n, y / n];
}

// Rough radius of the p/q bulb; good enough to aim Newton's method at its
// centre.
export function bulbRadiusEstimate(p, q) {
  return Math.sin((Math.PI * p) / q) / (q * q);
}

// Centre of the p/q bulb, found by Newton's method from a point one radius
// out from the root along the normal. The answer is checked: halfway between
// the root and the centre the period must still be q, otherwise Newton has
// wandered to some other period-q component and null is returned.
export function bulbNucleus(p, q) {
  const root = cardioidPoint(p / q);
  const nrm = cardioidNormal(p / q);
  const r = bulbRadiusEstimate(p, q);
  const n = nucleus(root[0] + nrm[0] * r, root[1] + nrm[1] * r, q);
  if (!n) return null;
  const mid = attractingCycle((root[0] + n.re) / 2, (root[1] + n.im) / 2, 200000);
  if (!mid || mid.period !== q) return null;
  return n;
}
