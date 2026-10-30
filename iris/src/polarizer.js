// Looking at the bow through a linear polarizer.
//
// Light scattered by a drop is split into a component polarized across the
// plane of scattering (s) and one in it (p). That plane holds the sun, the
// drop and the eye, so on the sky it runs along the great circle through the
// antisolar point: s light is polarized along the bow, p light across it.

import { project } from './sky.js';

// Direction, on the page (y up), from a point of the sky toward the
// antisolar point. The stereographic projection is conformal, so a small
// step along the great circle gives the true angle on the page.
export function radialAngle(az, el, sunEl, el0) {
  const d = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
  const a = [Math.cos(sunEl), 0, -Math.sin(sunEl)];
  const dot = d[0] * a[0] + d[1] * a[1] + d[2] * a[2];
  const t = [a[0] - dot * d[0], a[1] - dot * d[1], a[2] - dot * d[2]];
  const len = Math.hypot(t[0], t[1], t[2]);
  if (len < 1e-9) return 0;
  const h = 1e-4 / len;
  const q = [d[0] + h * t[0], d[1] + h * t[1], d[2] + h * t[2]];
  const qel = Math.asin(q[2] / Math.hypot(q[0], q[1], q[2]));
  const qaz = Math.atan2(q[1], q[0]);
  const [x0, y0] = project(az, el, el0);
  const [x1, y1] = project(qaz, qel, el0);
  return Math.atan2(y1 - y0, x1 - x0);
}

// Fractions of s and p light an ideal polarizer passes when its axis makes
// angle `axis` with the page's x axis and the antisolar point lies in
// direction `radial`.
export function filterWeights(radial, axis) {
  const c = Math.cos(axis - radial);
  return { s: 1 - c * c, p: c * c };
}

// Degree of polarization, (S - P) / (S + P), of light given as linear RGB
// for each component, weighted by luminance.
export function polarizationDegree(rgbS, rgbP) {
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const s = lum(rgbS);
  const p = lum(rgbP);
  return s + p > 0 ? (s - p) / (s + p) : 0;
}
