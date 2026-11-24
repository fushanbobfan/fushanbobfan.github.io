// Driving towards the board: the board comes nearer while the shine, fixed by
// angle, keeps its distance ahead of the car.

import { viewRows, describeView } from './view.js';
import { criticalAngle } from './rays.js';

export const DRIVE_SPEED = 25; // metres a second, 90 km/h
export const NEAREST = 50;
export const FURTHEST = 1500;
export const VIEW_ROWS = 240;

export function nextDistance(distance, seconds, speed = DRIVE_SPEED) {
  return Math.max(NEAREST, distance - speed * seconds);
}

function hasCopy(air, eye, distance, rows) {
  return describeView(viewRows(air, { eye, distance }, rows)).invertedRows > 0;
}

// The nearest board distance at which the picture (VIEW_ROWS rows, as on the
// page) shows an upside-down copy; nearer than this the copy is gone. The
// copy need not stay at every greater distance (a very distant board can sink
// out of sight altogether), so the search walks outwards from the nearest
// position in coarse steps and then narrows the first step that has a copy.
// Null if no distance up to FURTHEST shows one; NEAREST if the nearest does.
export function copyVanishes(air, eye, { step = 25, rows = VIEW_ROWS } = {}) {
  // With no ray turning back up there is no fold, so no copy anywhere.
  if (criticalAngle(air, eye) === null) return null;
  if (hasCopy(air, eye, NEAREST, rows)) return NEAREST;
  let lo = NEAREST;
  let hi = null;
  for (let d = NEAREST + step; d <= FURTHEST; d += step) {
    if (hasCopy(air, eye, d, rows)) {
      hi = d;
      break;
    }
    lo = d;
  }
  if (hi === null) return null;
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    if (hasCopy(air, eye, mid, rows)) hi = mid;
    else lo = mid;
  }
  return hi;
}
