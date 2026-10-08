// Balls in the air. New balls wait in a queue and are released one at a
// time, spaced out so they don't overlap at the top; each one falls row by
// row and is added to the bin counts when it lands.

import { binOf, dropMany, dropPath } from './board.js';

export const MAX_IN_FLIGHT = 600;
const SPACING = 0.45; // rows between successive releases

export function createFlight(rows, bias, rng) {
  return { rows, bias, rng, balls: [], queued: 0, sinceRelease: SPACING, counts: new Array(rows + 1).fill(0) };
}

// Queue `n` balls. Whatever would push the queue past what can sensibly be
// animated is dropped straight into the bins instead.
export function enqueue(f, n) {
  const room = Math.max(0, MAX_IN_FLIGHT - f.balls.length - f.queued);
  const animated = Math.min(n, room);
  f.queued += animated;
  if (n > animated) dropMany(f.counts, f.rows, f.bias, f.rng, n - animated);
  return animated;
}

// Advance by `rowsElapsed` (time measured in rows fallen). `isLanded`
// decides when a ball has reached the top of its pile; the default is the
// moment it passes the last row plus a short fall.
export function step(f, rowsElapsed, isLanded = (b) => b.t >= f.rows + 2) {
  for (const b of f.balls) b.t += rowsElapsed;
  f.sinceRelease += rowsElapsed;
  while (f.queued > 0 && f.sinceRelease >= SPACING) {
    const path = dropPath(f.rows, f.bias, f.rng);
    f.sinceRelease -= SPACING;
    f.balls.push({ path, bin: binOf(path), t: f.sinceRelease });
    f.queued--;
  }
  if (f.queued === 0) f.sinceRelease = Math.min(f.sinceRelease, SPACING);
  let landed = 0;
  const still = [];
  for (const b of f.balls) {
    if (isLanded(b)) {
      f.counts[b.bin]++;
      landed++;
    } else {
      still.push(b);
    }
  }
  f.balls = still;
  return landed;
}

export function busy(f) {
  return f.balls.length > 0 || f.queued > 0;
}
