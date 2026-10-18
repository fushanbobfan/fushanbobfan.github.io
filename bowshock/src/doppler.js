// Doppler shifts and the Mach cone for a source moving through still air,
// heard by a listener at rest.

// Half-angle of the Mach cone, sin(mu) = 1/M, or null below the speed of sound.
export function machAngle(mach) {
  return mach > 1 ? Math.asin(1 / mach) : null;
}

const ZERO = Object.freeze({ x: 0, y: 0 });

// Ratio of heard to emitted frequency for sound leaving a source with
// velocity (vx, vy) and travelling through the air in the unit direction
// (ux, uy), with a wind carrying the air and a moving listener:
//   (c + w.u - o.u) / (c + w.u - v.u).
// In still air with the listener at rest this is 1 / (1 - v.u / c). It is
// negative when the source outruns its own sound in that direction, which
// means the listener hears that stretch of the signal backwards.
export function dopplerRatio(vx, vy, ux, uy, c, wind = ZERO, obs = ZERO) {
  const wu = wind.x * ux + wind.y * uy;
  return (c + wu - (obs.x * ux + obs.y * uy)) / (c + wu - (vx * ux + vy * uy));
}

// The textbook cases along the line of motion.
export const approaching = (mach) => 1 / (1 - mach);
export const receding = (mach) => 1 / (1 + mach);

// Every moment tau on the recorded track whose sound reaches the listener at
// (lx, ly) exactly at time t, i.e. every root of
//   g(tau) = |L - s(tau)| - c (t - tau).
// Below Mach 1, g only rises, so there is one root. A supersonic source can
// have none (the listener is outside the cone, nothing has arrived yet) or
// several (inside it, sound from the approach and from the retreat arrive
// together). Each image carries its Doppler ratio, its distance and whether
// it plays backwards.
export function images(history, lx, ly, t, c) {
  const out = [];
  const n = history.length;
  const g = (p) => Math.hypot(lx - p.x, ly - p.y) - c * (t - p.t);
  let prev = n > 0 ? history.at(0) : null;
  let gPrev = prev ? g(prev) : 0;
  for (let i = 1; i < n; i++) {
    const cur = history.at(i);
    const gCur = g(cur);
    if (!cur.brk && (gPrev < 0) !== (gCur < 0)) {
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if ((g(history.lerp(i, mid)) < 0) === (gPrev < 0)) lo = mid;
        else hi = mid;
      }
      const p = history.lerp(i, (lo + hi) / 2);
      const dist = Math.hypot(lx - p.x, ly - p.y);
      const ux = dist > 0 ? (lx - p.x) / dist : 0;
      const uy = dist > 0 ? (ly - p.y) / dist : 0;
      const ratio = dopplerRatio(p.vx, p.vy, ux, uy, c);
      out.push({ tau: p.t, x: p.x, y: p.y, dist, ratio, reversed: ratio < 0 });
    }
    prev = cur;
    gPrev = gCur;
  }
  // Newest sound first.
  return out.reverse();
}
