// Hand tools: find the particle under the pointer, slice links with a stroke,
// toggle pins.

export function nearest(c, x, y, radius = Infinity) {
  let best = -1;
  let bestD = radius * radius;
  for (let k = 0; k < c.n; k++) {
    const d = (c.x[k] - x) ** 2 + (c.y[k] - y) ** 2;
    if (d <= bestD) { bestD = d; best = k; }
  }
  return best;
}

function cross(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

// True when segments p1p2 and q1q2 cross at a point interior to both.
export function segmentsCross(p1x, p1y, p2x, p2y, q1x, q1y, q2x, q2y) {
  const d1 = cross(q1x, q1y, q2x, q2y, p1x, p1y);
  const d2 = cross(q1x, q1y, q2x, q2y, p2x, p2y);
  const d3 = cross(p1x, p1y, p2x, p2y, q1x, q1y);
  const d4 = cross(p1x, p1y, p2x, p2y, q2x, q2y);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// Break every intact link the stroke from (x1, y1) to (x2, y2) passes through.
export function cut(c, x1, y1, x2, y2) {
  const { a, b, broken, count } = c.links;
  let n = 0;
  for (let m = 0; m < count; m++) {
    if (broken[m]) continue;
    const i = a[m];
    const j = b[m];
    if (segmentsCross(x1, y1, x2, y2, c.x[i], c.y[i], c.x[j], c.y[j])) {
      broken[m] = 1;
      n++;
    }
  }
  c.brokenCount += n;
  return n;
}

export function togglePin(c, k) {
  c.pinned[k] = c.pinned[k] ? 0 : 1;
  c.px[k] = c.x[k];
  c.py[k] = c.y[k];
  return c.pinned[k] === 1;
}

// A grabbed particle is pinned to the pointer while held, so the solver treats
// the hand as an anchor. Letting go restores its old pin and, if it was free,
// gives it the pointer's velocity so a flick throws the cloth.
export function grab(c, k) {
  const g = { k, wasPinned: c.pinned[k] === 1 };
  c.pinned[k] = 1;
  return g;
}

export function drag(c, g, x, y) {
  c.x[g.k] = c.px[g.k] = x;
  c.y[g.k] = c.py[g.k] = y;
}

export function release(c, g, vx = 0, vy = 0, dt = 0) {
  if (g.wasPinned) return;
  c.pinned[g.k] = 0;
  c.px[g.k] = c.x[g.k] - vx * dt;
  c.py[g.k] = c.y[g.k] - vy * dt;
}

export function pinCount(c) {
  let n = 0;
  for (let k = 0; k < c.n; k++) n += c.pinned[k];
  return n;
}
