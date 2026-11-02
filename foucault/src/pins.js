// The ring of little pins that museum pendulums knock over one by one as the
// floor turns under the swing.

// n pins on a circle, set half a step either side of the starting plane so
// the first swing passes between them.
export function pinRing(n, radius, plane0 = Math.PI / 2) {
  const pins = [];
  for (let k = 0; k < n; k++) {
    const angle = plane0 + ((k + 0.5) * 2 * Math.PI) / n;
    pins.push({ angle, x: radius * Math.cos(angle), y: radius * Math.sin(angle), down: false, at: null });
  }
  return pins;
}

export function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Knock over every standing pin the bob came within `reach` of while moving
// from a to b. Returns the pins that fell.
export function knock(pins, ax, ay, bx, by, reach, time) {
  const fell = [];
  for (const p of pins) {
    if (p.down) continue;
    if (segmentDistance(p.x, p.y, ax, ay, bx, by) < reach) {
      p.down = true;
      p.at = time;
      fell.push(p);
    }
  }
  return fell;
}

// When a pin `offset` radians ahead of the starting plane (in the direction
// the plane turns) should fall, for a swing that runs out to the unit rim:
// once the swing line passes within reach of it.
export function fallTime(offset, radius, reach, omegaZ) {
  const lead = Math.asin(Math.min(1, reach / radius));
  const ahead = ((offset % Math.PI) + Math.PI) % Math.PI;
  return Math.max(0, ahead - lead) / Math.abs(omegaZ);
}

// Offset of a pin ahead of the starting plane, in the turning direction.
export function pinOffset(pin, plane0, omegaZ) {
  const d = omegaZ >= 0 ? plane0 - pin.angle : pin.angle - plane0;
  return ((d % Math.PI) + Math.PI) % Math.PI;
}
