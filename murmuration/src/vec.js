// Small 2D vector helpers. Every function returns a fresh {x, y} and never
// mutates its arguments, so callers can chain them without surprises.

export function vec(x = 0, y = 0) {
  return { x, y };
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a, s) {
  return { x: a.x * s, y: a.y * s };
}

export function length(a) {
  return Math.hypot(a.x, a.y);
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(a) {
  const len = length(a);
  return len === 0 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len };
}

// Rescale to exactly `mag`; the zero vector stays zero.
export function setMagnitude(a, mag) {
  return scale(normalize(a), mag);
}

// Clamp the length to at most `max`, preserving direction.
export function limit(a, max) {
  const len = length(a);
  return len > max ? scale(a, max / len) : { x: a.x, y: a.y };
}

export function heading(a) {
  return Math.atan2(a.y, a.x);
}

export function fromAngle(theta, mag = 1) {
  return { x: Math.cos(theta) * mag, y: Math.sin(theta) * mag };
}
