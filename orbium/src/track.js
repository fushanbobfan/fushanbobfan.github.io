// Follows the world's centre of mass through time. Positions are unwrapped
// across the torus seam: a creature that leaves the right edge and comes back
// on the left keeps adding to its distance.

import { torusDelta } from './world.js';

export class Tracker {
  constructor(n, capacity = 600) {
    this.n = n;
    this.capacity = capacity;
    this.samples = [];
  }

  reset() {
    this.samples = [];
  }

  // Adds the centroid seen at `time`. A null centroid (empty world) or a
  // time that went backwards starts a fresh track.
  push(time, c) {
    if (!c) {
      this.reset();
      return;
    }
    const last = this.samples[this.samples.length - 1];
    if (!last || time < last.t) {
      this.samples = [{ t: time, x: c.x, y: c.y, wx: c.x, wy: c.y }];
      return;
    }
    if (time === last.t) return;
    const d = torusDelta({ x: last.wx, y: last.wy }, c, this.n);
    this.samples.push({ t: time, x: last.x + d.dx, y: last.y + d.dy, wx: c.x, wy: c.y });
    if (this.samples.length > this.capacity) this.samples.shift();
  }

  // Mean velocity over the most recent `window` time units, in cells per
  // time unit, with y pointing down the screen as in the world grid.
  velocity(window = 2) {
    const s = this.samples;
    if (s.length < 2) return null;
    const end = s[s.length - 1];
    let i = s.length - 2;
    while (i > 0 && end.t - s[i].t < window) i--;
    const start = s[i];
    const dt = end.t - start.t;
    if (dt <= 0) return null;
    return { vx: (end.x - start.x) / dt, vy: (end.y - start.y) / dt };
  }

  // Speed in cells per time unit and heading in degrees, 0 = right, 90 = up.
  motion(window = 2) {
    const v = this.velocity(window);
    if (!v) return null;
    const speed = Math.hypot(v.vx, v.vy);
    const heading = (((Math.atan2(-v.vy, v.vx) * 180) / Math.PI) + 360) % 360;
    return { speed, heading };
  }

  // Trail as runs of on-screen points, split where the path crosses the seam.
  segments() {
    const out = [];
    let run = [];
    let prev = null;
    for (const p of this.samples) {
      if (prev && (Math.abs(p.wx - prev.wx) > this.n / 2 || Math.abs(p.wy - prev.wy) > this.n / 2)) {
        if (run.length > 1) out.push(run);
        run = [];
      }
      run.push([p.wx, p.wy]);
      prev = p;
    }
    if (run.length > 1) out.push(run);
    return out;
  }
}

// Compass word for a heading in degrees (0 = right/east, 90 = up/north).
export function compass(deg) {
  const names = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}
