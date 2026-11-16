// Special relativity in one space dimension, in units where c = 1.
// An event is { t, x }: time in seconds, position in light-seconds.
// A frame is named by its velocity beta relative to the lab, -1 < beta < 1.

export const MAX_BETA = 0.99;

export function clampBeta(beta) {
  return Math.max(-MAX_BETA, Math.min(MAX_BETA, beta));
}

export function gamma(beta) {
  if (!(Math.abs(beta) < 1)) throw new RangeError(`|beta| must be below 1, got ${beta}`);
  return 1 / Math.sqrt(1 - beta * beta);
}

export function rapidity(beta) {
  return Math.atanh(beta);
}

export function betaFromRapidity(phi) {
  return Math.tanh(phi);
}

// Lab coordinates -> coordinates measured by an observer moving at beta.
export function boost(event, beta) {
  const g = gamma(beta);
  return { t: g * (event.t - beta * event.x), x: g * (event.x - beta * event.t) };
}

// Coordinates in the frame moving at beta -> lab coordinates.
export function unboost(event, beta) {
  return boost(event, -beta);
}

// Velocity u (lab) as seen from a frame moving at beta.
export function relativeVelocity(u, beta) {
  return (u - beta) / (1 - u * beta);
}

// Combine velocities: an object moving at u inside a frame that moves at v.
export function addVelocities(u, v) {
  return (u + v) / (1 + u * v);
}

const EPS = 1e-9;

// Squared interval with signature (+, -): positive for timelike separations.
export function interval(a, b) {
  const dt = b.t - a.t;
  const dx = b.x - a.x;
  return dt * dt - dx * dx;
}

export function separation(a, b) {
  const s2 = interval(a, b);
  const scale = Math.max(1, (b.t - a.t) ** 2 + (b.x - a.x) ** 2);
  if (Math.abs(s2) <= EPS * scale) return 'lightlike';
  return s2 > 0 ? 'timelike' : 'spacelike';
}

// Time a clock carried straight from a to b would show, or null if no clock can make the trip.
export function properTime(a, b) {
  return separation(a, b) === 'timelike' ? Math.sqrt(interval(a, b)) : null;
}

// Distance between a and b in the frame where they happen at the same moment.
export function properDistance(a, b) {
  return separation(a, b) === 'spacelike' ? Math.sqrt(-interval(a, b)) : null;
}

// The frame in which two spacelike-separated events are simultaneous.
export function simultaneousFrame(a, b) {
  if (separation(a, b) !== 'spacelike') return null;
  return (b.t - a.t) / (b.x - a.x);
}

// The frame in which two timelike-separated events happen at the same place.
export function colocatedFrame(a, b) {
  if (separation(a, b) !== 'timelike') return null;
  return (b.x - a.x) / (b.t - a.t);
}

// Which event comes first for an observer at beta: -1 if a, 1 if b, 0 if together.
export function order(a, b, beta) {
  const dt = boost(b, beta).t - boost(a, beta).t;
  if (Math.abs(dt) < EPS) return 0;
  return dt > 0 ? 1 : -1;
}

// Can some observer see the order of a and b reversed? Only when they are spacelike apart.
export function orderCanFlip(a, b) {
  return separation(a, b) === 'spacelike';
}

// Range of beta values for which b happens after a (as an open interval within (-1, 1)).
// Timelike or lightlike: every observer agrees, so the range is all of (-1, 1) or empty.
export function betaRangeWhereLater(a, b) {
  const dt = b.t - a.t;
  const dx = b.x - a.x;
  if (separation(a, b) !== 'spacelike') {
    return dt > 0 ? { from: -1, to: 1 } : null;
  }
  const flip = dt / dx; // order(...) changes sign here
  // dt' > 0  <=>  dt - beta dx > 0
  return dx > 0 ? { from: -1, to: flip } : { from: flip, to: 1 };
}
