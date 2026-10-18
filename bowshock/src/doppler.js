// Doppler shifts and the Mach cone for a source moving through still air,
// heard by a listener at rest.

// Half-angle of the Mach cone, sin(mu) = 1/M, or null below the speed of sound.
export function machAngle(mach) {
  return mach > 1 ? Math.asin(1 / mach) : null;
}

// Ratio of heard to emitted frequency for sound leaving a source with
// velocity (vx, vy) in the unit direction (ux, uy): 1 / (1 - v.u / c).
// It is negative when the source outruns its own sound in that direction,
// which means the listener hears that stretch of the signal backwards.
export function dopplerRatio(vx, vy, ux, uy, c) {
  return 1 / (1 - (vx * ux + vy * uy) / c);
}

// The textbook cases along the line of motion.
export const approaching = (mach) => 1 / (1 - mach);
export const receding = (mach) => 1 / (1 + mach);
