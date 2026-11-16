// Worldlines: the paths of things through spacetime, as lists of lab events joined by straight pieces.

import { separation, properTime } from './lorentz.js';

// True when every piece could be travelled slower than light (pieces at exactly light speed allowed).
export function isCausalPath(points) {
  for (let k = 1; k < points.length; k++) {
    if (points[k].t <= points[k - 1].t) return false;
    if (separation(points[k - 1], points[k]) === 'spacelike') return false;
  }
  return true;
}

// Time shown by a clock carried along the path.
export function properTimeAlong(points) {
  if (!isCausalPath(points)) throw new RangeError('path goes faster than light or back in time');
  let total = 0;
  for (let k = 1; k < points.length; k++) total += properTime(points[k - 1], points[k]) ?? 0;
  return total;
}

// Where along the path the carried clock reads start, start + step, start + 2 step, ...
export function clockTicks(points, step = 1, start = 0) {
  if (!(step > 0)) throw new RangeError('step must be positive');
  if (!isCausalPath(points)) throw new RangeError('path goes faster than light or back in time');
  const ticks = [{ ...points[0], reading: start }];
  let reading = start;
  let next = start + step;
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1];
    const b = points[k];
    const tau = properTime(a, b) ?? 0;
    if (tau === 0) continue;
    while (next <= reading + tau + 1e-9) {
      const f = (next - reading) / tau;
      ticks.push({ t: a.t + f * (b.t - a.t), x: a.x + f * (b.x - a.x), reading: next });
      next += step;
    }
    reading += tau;
  }
  return ticks;
}

// Where something moving along the path is at lab time t, or null outside the path's span.
export function positionAt(points, t) {
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1];
    const b = points[k];
    if (t >= a.t && t <= b.t) return a.x + ((t - a.t) / (b.t - a.t)) * (b.x - a.x);
  }
  return null;
}

// A straight worldline at constant velocity through the event (t0, x0), between lab times t1 and t2.
export function uniform(velocity, x0, t1, t2, t0 = 0) {
  return [
    { t: t1, x: x0 + velocity * (t1 - t0) },
    { t: t2, x: x0 + velocity * (t2 - t0) },
  ];
}

// The event where a flash sent from `from` (dir +1 rightward, -1 leftward) meets a straight
// worldline x = x0 + v t. Returns null if it never catches up.
export function lightMeets(from, dir, v, x0) {
  // from.x + dir (t - from.t) = x0 + v t
  const denom = dir - v;
  if (Math.abs(denom) < 1e-12) return null;
  const t = (x0 - from.x + dir * from.t) / denom;
  if (t < from.t - 1e-12) return null;
  return { t, x: x0 + v * t };
}
