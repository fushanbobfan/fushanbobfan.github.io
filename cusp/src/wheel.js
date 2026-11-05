// The wheel as a damped rotor, and a tracker that notices when its well vanishes.

import { angleGap, torque } from './machine.js';
import { settle } from './equilibria.js';

// A jump of more than this between neighbouring control points counts as a snap.
export const SNAP_ANGLE = 0.3;
const CONTROL_STEP = 0.004;

// Light and lightly damped: the wheel tracks a slowly moving well closely, then
// visibly swings and rings when it falls into a new one.
export const DEFAULT_ROTOR = Object.freeze({ inertia: 0.003, damping: 0.025 });

export function stepWheel(state, m, cx, cy, dt, rotor = DEFAULT_ROTOR) {
  const substeps = Math.max(1, Math.ceil(dt / 0.002));
  const h = dt / substeps;
  for (let i = 0; i < substeps; i += 1) {
    const accel = (-torque(m, cx, cy, state.theta) - rotor.damping * state.omega) / rotor.inertia;
    state.omega += accel * h;
    state.theta += state.omega * h;
  }
  return state;
}

// Move the control point in small steps, following the well the wheel sits in.
// Returns the resting angle at the end and each snap on the way.
export function followRest(m, from, to, rest) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const n = Math.max(1, Math.ceil(dist / CONTROL_STEP));
  const snaps = [];
  let theta = rest;
  for (let i = 1; i <= n; i += 1) {
    const x = from.x + ((to.x - from.x) * i) / n;
    const y = from.y + ((to.y - from.y) * i) / n;
    const next = settle(m, x, y, theta);
    if (Math.abs(next - theta) > SNAP_ANGLE) {
      snaps.push({ x, y, from: theta, to: next });
    }
    theta = next;
  }
  return { rest: theta, snaps };
}

// One frame of the live machine: the control point moves, the rest tracker follows
// it, and the rotor chases the rest position. Returns the snaps of this frame.
export function driveWheel(state, m, to, dt, rotor = DEFAULT_ROTOR) {
  const leg = followRest(m, state.control, to, state.rest);
  state.control = to;
  state.rest = leg.rest;
  const snaps = leg.snaps;
  stepWheel(state, m, to.x, to.y, dt, rotor);
  const gap = Math.abs(angleGap(state.theta, state.rest));
  if (Math.abs(state.omega) < 0.02 && gap > 0.05) {
    const landed = settle(m, to.x, to.y, state.theta);
    if (Math.abs(angleGap(state.rest, landed)) > SNAP_ANGLE) {
      snaps.push({ x: to.x, y: to.y, from: state.rest, to: landed });
    }
    state.rest = landed;
  }
  return snaps;
}

// Run the control point along a polyline from a settled start.
export function sweepPath(m, path, startAngle) {
  let rest = settle(m, path[0].x, path[0].y, startAngle);
  const snaps = [];
  for (let i = 1; i < path.length; i += 1) {
    const leg = followRest(m, path[i - 1], path[i], rest);
    rest = leg.rest;
    snaps.push(...leg.snaps);
  }
  return { rest, snaps };
}
