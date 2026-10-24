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

// A hand closes on every particle within `radius` of the pointer (at least the
// nearest one) and pins them to it while held, so the pull is spread over a
// patch of threads instead of one. Letting go restores each particle's old pin
// and gives the free ones the hand's velocity, so a flick throws the cloth.
export function grab(c, x, y, radius) {
  const k0 = nearest(c, x, y, radius);
  if (k0 < 0) return null;
  const cx = c.x[k0];
  const cy = c.y[k0];
  const members = [];
  for (let k = 0; k < c.n; k++) {
    const dx = c.x[k] - cx;
    const dy = c.y[k] - cy;
    if (k !== k0 && dx * dx + dy * dy > radius * radius) continue;
    members.push({ k, dx, dy, wasPinned: c.pinned[k] === 1 });
    c.pinned[k] = 1;
  }
  return { k: k0, members };
}

// Move the hand so that the particle it first closed on sits at (x, y).
export function drag(c, g, x, y) {
  for (const { k, dx, dy } of g.members) {
    c.x[k] = c.px[k] = x + dx;
    c.y[k] = c.py[k] = y + dy;
  }
}

export function release(c, g, vx = 0, vy = 0, dt = 0) {
  for (const { k, wasPinned } of g.members) {
    if (wasPinned) continue;
    c.pinned[k] = 0;
    c.px[k] = c.x[k] - vx * dt;
    c.py[k] = c.y[k] - vy * dt;
  }
}

export function pinCount(c) {
  let n = 0;
  for (let k = 0; k < c.n; k++) n += c.pinned[k];
  return n;
}
