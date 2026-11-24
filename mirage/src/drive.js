// Driving towards the board: the board comes nearer while the shine, fixed by
// angle, keeps its distance ahead of the car.

import { viewRows, describeView } from './view.js';

export const DRIVE_SPEED = 25; // metres a second, 90 km/h
export const NEAREST = 50;
export const FURTHEST = 1500;

export function nextDistance(distance, seconds, speed = DRIVE_SPEED) {
  return Math.max(NEAREST, distance - speed * seconds);
}

function hasCopy(air, eye, distance, rows) {
  return describeView(viewRows(air, { eye, distance }, rows)).invertedRows > 0;
}

// The distance below which the board no longer shows an upside-down copy,
// found by bisection between the nearest and furthest board positions. Null
// if there is no copy even at the furthest; NEAREST if one remains at the
// nearest.
export function copyVanishes(air, eye, rows = 80) {
  if (!hasCopy(air, eye, FURTHEST, rows)) return null;
  if (hasCopy(air, eye, NEAREST, rows)) return NEAREST;
  let lo = NEAREST;
  let hi = FURTHEST;
  while (hi - lo > 2) {
    const mid = (lo + hi) / 2;
    if (hasCopy(air, eye, mid, rows)) hi = mid;
    else lo = mid;
  }
  return hi;
}
