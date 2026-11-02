// The full spherical pendulum, without the small-swing approximation, on a
// turning Earth. Used to show why a short wire is a poor Foucault pendulum.
//
// The bob sits at r from the pivot (x east, y north, z up, |r| = L). It feels
// gravity, the Coriolis force −2Ω×v of the whole spin vector
// Ω = Ω(0, cos φ, sin φ), and the wire's pull −λr, with λ chosen so the bob
// stays on the sphere. A swing that is slightly elliptical precesses on its
// own, in the sense it goes round, at Airy's rate (3/8) ω0 a b / L² for
// semi-axes a and b, and on a short wire that can swamp the Earth's effect.

import { G, EARTH_SPIN } from './pendulum.js';

const RAD = Math.PI / 180;

export function spinVector(latDeg, factor = 1) {
  const w = EARTH_SPIN * factor;
  return [0, w * Math.cos(latDeg * RAD), w * Math.sin(latDeg * RAD)];
}

function accel(s, L, g, om) {
  const [x, y, z, vx, vy, vz] = s;
  // −2 Ω × v
  const cx = -2 * (om[1] * vz - om[2] * vy);
  const cy = -2 * (om[2] * vx - om[0] * vz);
  const cz = -2 * (om[0] * vy - om[1] * vx);
  const fx = cx, fy = cy, fz = cz - g;
  const lam = (vx * vx + vy * vy + vz * vz + x * fx + y * fy + z * fz) / (L * L);
  return [vx, vy, vz, fx - lam * x, fy - lam * y, fz - lam * z];
}

// One Runge–Kutta step, then put the bob back on the sphere and drop any
// velocity along the wire, which the step lets creep in.
export function step(s, dt, L, g, om) {
  const k1 = accel(s, L, g, om);
  const k2 = accel(s.map((v, i) => v + 0.5 * dt * k1[i]), L, g, om);
  const k3 = accel(s.map((v, i) => v + 0.5 * dt * k2[i]), L, g, om);
  const k4 = accel(s.map((v, i) => v + dt * k3[i]), L, g, om);
  const n = s.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  const r = Math.hypot(n[0], n[1], n[2]);
  for (let i = 0; i < 3; i++) n[i] *= L / r;
  const radial = (n[0] * n[3] + n[1] * n[4] + n[2] * n[5]) / (L * L);
  for (let i = 0; i < 3; i++) n[i + 3] -= radial * n[i];
  return n;
}

// Drawn aside a horizontal distance `amplitude` along `direction` and let go
// with a small sideways speed, enough for a swing about `sideways` wide.
export function start(L, amplitude, sideways = 0, direction = Math.PI / 2, g = G) {
  const ux = Math.cos(direction), uy = Math.sin(direction);
  const z = -Math.sqrt(L * L - amplitude * amplitude);
  const v = sideways * Math.sqrt(g / L);
  // sideways is square to the swing and to the wire
  return [amplitude * ux, amplitude * uy, z, uy * v, -ux * v, 0];
}

export function energy(s, g = G) {
  const [, , z, vx, vy, vz] = s;
  return 0.5 * (vx * vx + vy * vy + vz * vz) + g * z;
}

export function airyRate(L, a, b, g = G) {
  return (3 / 8) * Math.sqrt(g / L) * (a * b) / (L * L);
}

// Run for `duration` seconds and record the direction of each far end of the
// swing: the times the bob is furthest out, with the angle of its horizontal
// position (reduced to a half turn and unwrapped).
export function apsides(s0, { L, g = G, om = [0, 0, 0], duration, stepsPerSwing = 400 }) {
  const T = 2 * Math.PI * Math.sqrt(L / g);
  const dt = T / stepsPerSwing;
  const out = [];
  let s = s0, r2a = -1, r2b = s0[0] ** 2 + s0[1] ** 2;
  let unwrap = null;
  const n = Math.ceil(duration / dt);
  for (let i = 1; i <= n; i++) {
    const next = step(s, dt, L, g, om);
    const r2c = next[0] ** 2 + next[1] ** 2;
    if (r2b > r2a && r2b >= r2c && i > 1) {
      // fit a parabola through the last three radii for the moment of the peak
      const den = r2a - 2 * r2b + r2c;
      const frac = den !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (r2a - r2c)) / den)) : 0;
      let ang = Math.atan2(s[1], s[0]);
      ang = ((ang % Math.PI) + Math.PI) % Math.PI;
      if (unwrap !== null) {
        while (ang - unwrap > Math.PI / 2) ang -= Math.PI;
        while (ang - unwrap < -Math.PI / 2) ang += Math.PI;
      }
      unwrap = ang;
      out.push({ t: (i - 1 + frac) * dt, angle: ang });
    }
    s = next;
    r2a = r2b;
    r2b = r2c;
  }
  return { apsides: out, end: s };
}

// Least-squares slope of angle against time: the rate the swing turns.
export function turnRate(points) {
  const n = points.length;
  if (n < 2) return 0;
  let st = 0, sa = 0;
  for (const p of points) { st += p.t; sa += p.angle; }
  const mt = st / n, ma = sa / n;
  let num = 0, den = 0;
  for (const p of points) { num += (p.t - mt) * (p.angle - ma); den += (p.t - mt) ** 2; }
  return den > 0 ? num / den : 0;
}
