// Rest positions of the wheel: the zeros of the torque dV/dtheta.

import { curvature, energy, torque, wrapAngle } from './machine.js';

const TAU = Math.PI * 2;

function bisectTorque(m, cx, cy, lo, hi) {
  let gLo = torque(m, cx, cy, lo);
  for (let i = 0; i < 48; i += 1) {
    const mid = 0.5 * (lo + hi);
    const g = torque(m, cx, cy, mid);
    if ((g > 0) === (gLo > 0)) {
      lo = mid;
      gLo = g;
    } else {
      hi = mid;
    }
  }
  return 0.5 * (lo + hi);
}

// All equilibria for a control point, found by scanning one turn of the wheel.
// The scan starts off the symmetric angles 0 and pi, which are exact zeros on the axis.
export function restPoints(m, cx, cy, n = 360) {
  const minima = [];
  const maxima = [];
  const start = -Math.PI + 0.00137;
  const dt = TAU / n;
  let t0 = start;
  let g0 = torque(m, cx, cy, t0);
  for (let i = 1; i <= n; i += 1) {
    const t1 = start + i * dt;
    const g1 = torque(m, cx, cy, t1);
    if ((g0 > 0) !== (g1 > 0)) {
      const theta = wrapAngle(bisectTorque(m, cx, cy, t0, t1));
      const point = {
        theta,
        energy: energy(m, cx, cy, theta),
        curvature: curvature(m, cx, cy, theta),
      };
      (g1 > 0 ? minima : maxima).push(point);
    }
    t0 = t1;
    g0 = g1;
  }
  return { minima, maxima };
}

// The number of wells alone, for shading the control plane quickly.
export function countWells(m, cx, cy, n = 180) {
  const start = -Math.PI + 0.00137;
  const dt = TAU / n;
  let g0 = torque(m, cx, cy, start);
  let wells = 0;
  for (let i = 1; i <= n; i += 1) {
    const g1 = torque(m, cx, cy, start + i * dt);
    if (g0 <= 0 && g1 > 0) wells += 1;
    g0 = g1;
  }
  return wells;
}

// Roll downhill from theta to the bottom of its well. The result keeps the
// wheel's winding: it is theta plus the distance rolled, without wrapping.
export function settle(m, cx, cy, theta, step = 0.015) {
  let g = torque(m, cx, cy, theta);
  if (g === 0) {
    if (curvature(m, cx, cy, theta) >= 0) return theta;
    theta += 1e-6;
    g = torque(m, cx, cy, theta);
  }
  const dir = g > 0 ? -1 : 1;
  let t0 = theta;
  for (let i = 0; i < Math.ceil(TAU / step); i += 1) {
    const t1 = t0 + dir * step;
    const g1 = torque(m, cx, cy, t1);
    if ((g1 > 0) !== (g > 0)) {
      return bisectTorque(m, cx, cy, Math.min(t0, t1), Math.max(t0, t1));
    }
    t0 = t1;
  }
  return theta;
}
