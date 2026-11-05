// The whole equilibrium surface over the control plane, built from slices stacked
// side by side and turned with a plain orthographic rotation.

import { wrapAngle } from './machine.js';
import { sliceCurve } from './slice.js';

export const DEFAULT_TURN = Object.freeze({ yaw: -0.65, pitch: 0.42 });
const PITCH_MIN = -0.2;
const PITCH_MAX = 1.5;

export function clampPitch(pitch) {
  return Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitch));
}

// A box around the set, in control coordinates, with room to see the sheet go flat.
export function surfaceBox(chains) {
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = 0;
  for (const { points } of chains) {
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (Math.abs(p.y) > maxY) maxY = Math.abs(p.y);
    }
  }
  const padX = 0.3 * (maxX - minX) + 0.1;
  return { x0: minX - padX, x1: maxX + padX, yHalf: 1.35 * maxY + 0.1 };
}

// To a unit-sized scene: x and y along the floor, the pin angle upward.
export function toScene(box, x, y, theta) {
  const midX = 0.5 * (box.x0 + box.x1);
  return {
    x: (x - midX) / (0.5 * (box.x1 - box.x0)),
    y: (0.7 * y) / box.yHalf,
    z: (0.62 * wrapAngle(theta)) / Math.PI,
  };
}

// A rotation about the vertical, then a tilt towards the viewer. `up` is up the
// screen and `depth` grows away from the viewer.
export function rotate(p, { yaw, pitch }) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const across = p.x * cy - p.y * sy;
  const away = p.x * sy + p.y * cy;
  return {
    across,
    up: p.z * cp + away * sp,
    depth: away * cp - p.z * sp,
  };
}

// One rib per value of x, keeping the slice's marks for wells and hills. A segment
// that crosses the seam at +-180 degrees is dropped so no line runs across the scene.
export function buildRibs(m, box, count = 46) {
  const ribs = [];
  for (let i = 0; i < count; i += 1) {
    const x = box.x0 + ((i + 0.5) * (box.x1 - box.x0)) / count;
    const segments = sliceCurve(m, { axis: 'y', at: x }, [-box.yHalf, box.yHalf], { cols: 70, rows: 110 })
      .filter((seg) => Math.abs(wrapAngle(seg.ta) - wrapAngle(seg.tb)) < Math.PI);
    ribs.push({ x, segments });
  }
  return ribs;
}

// Ribs ordered back to front for painting.
export function ribOrder(ribs, box, turn) {
  return ribs
    .map((rib) => ({ rib, depth: rotate(toScene(box, rib.x, 0, 0), turn).depth }))
    .sort((a, b) => b.depth - a.depth)
    .map((entry) => entry.rib);
}

// The set lifted to its pin angle: the crease where the sheet folds over.
export function liftedCrease(chains, box) {
  return chains.map(({ points, closed }) => ({
    closed,
    points: points.map((p) => ({ ...toScene(box, p.x, p.y, p.theta), theta: p.theta })),
  }));
}
