// Timing decisions for drawing a design: how long to draw, how finely to
// sample, and how far along the pen should be after some wall-clock time.

import { settleTime } from './harmonograph.js';

export const SPEEDS = [1, 2, 4, 8, 16, 32, 64];

// Undamped designs never settle, so they get a fixed drawing length.
export const MAX_DURATION = 180;

export function planDrawing(design) {
  const settled = settleTime(design, 0.03, MAX_DURATION);
  const duration = Math.max(1, settled);
  const fastest = design.pendulums.reduce((m, p) => Math.max(m, p.freq), 0);
  // About 60 samples per cycle of the fastest swing keeps curves smooth
  // without generating millions of points for long, fast designs.
  const samplesPerSecond = Math.min(1200, Math.max(120, Math.ceil(fastest * 60)));
  return { duration, samplesPerSecond };
}

// Index of the last point the pen has reached after `seconds` of drawing.
export function pointIndexAt(seconds, samplesPerSecond, totalPoints) {
  if (totalPoints <= 0) return -1;
  const i = Math.floor(Math.max(0, seconds) * samplesPerSecond);
  return Math.min(totalPoints - 1, i);
}

export function formatSpeed(multiplier) {
  return `${multiplier}×`;
}
