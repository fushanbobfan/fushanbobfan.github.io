// A bead released from rest slides without friction along a polyline.
// Coordinates are metres with y pointing down, so height fallen is y - y0.
// Along a straight piece the acceleration is constant, which makes the time
// over each piece exact: with entry and exit speeds v1 and v2 from energy
// conservation, the piece of length L takes 2L / (v1 + v2).

export const G = 9.81;

function seg(pts, i) {
  const x1 = pts[2 * i], y1 = pts[2 * i + 1];
  const x2 = pts[2 * i + 2], y2 = pts[2 * i + 3];
  return { x1, y1, x2, y2, L: Math.hypot(x2 - x1, y2 - y1) };
}

// Arrival time and speed at every vertex. If the path climbs back to the
// release height the bead stops there and slides back: `turn` records where
// and when, and the motion repeats with period 2 * turn.time.
export function traverse(pts, g = G) {
  const n = pts.length / 2;
  const y0 = pts[1];
  const times = new Float64Array(n).fill(NaN);
  const speeds = new Float64Array(n).fill(NaN);
  times[0] = 0;
  speeds[0] = 0;
  let turn = null;
  for (let i = 0; i < n - 1; i++) {
    const { y1, y2, L } = seg(pts, i);
    const v1 = speeds[i];
    if (L === 0) {
      times[i + 1] = times[i];
      speeds[i + 1] = v1;
      continue;
    }
    const h2 = y2 - y0;
    if (h2 < 0 || (h2 === 0 && v1 === 0)) {
      const s = y2 === y1 ? 0 : (L * (y0 - y1)) / (y2 - y1);
      turn = { seg: i, s: Math.max(0, s), time: times[i] + (v1 > 0 ? (2 * s) / v1 : 0) };
      break;
    }
    const v2 = Math.sqrt(2 * g * h2);
    times[i + 1] = times[i] + (2 * L) / (v1 + v2);
    speeds[i + 1] = v2;
  }
  return { pts, g, times, speeds, turn, total: turn ? Infinity : times[n - 1] };
}

function pointOnSegment(path, k, tau) {
  const { pts, g, speeds } = path;
  const { x1, y1, x2, y2, L } = seg(pts, k);
  if (L === 0) return { x: x1, y: y1, v: speeds[k], seg: k };
  const a = (g * (y2 - y1)) / L;
  const s = Math.min(L, Math.max(0, speeds[k] * tau + 0.5 * a * tau * tau));
  const f = s / L;
  return {
    x: x1 + f * (x2 - x1),
    y: y1 + f * (y2 - y1),
    v: Math.sqrt(Math.max(0, 2 * g * (y1 + f * (y2 - y1) - pts[1]))),
    seg: k,
  };
}

// Where the bead is at time t, how fast it moves and whether it has arrived.
export function stateAt(path, t) {
  const { pts, times, turn } = path;
  const n = pts.length / 2;
  let last = n - 2;
  if (turn) {
    if (turn.time === 0) return { x: pts[0], y: pts[1], v: 0, seg: 0, done: false };
    const period = 2 * turn.time;
    t %= period;
    if (t > turn.time) t = period - t;
    last = turn.seg;
  } else if (t >= path.total) {
    return { x: pts[2 * n - 2], y: pts[2 * n - 1], v: path.speeds[n - 1], seg: n - 2, done: true };
  }
  let lo = 0, hi = last;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return { ...pointOnSegment(path, lo, t - times[lo]), done: false };
}

export function pathLength(pts) {
  let s = 0;
  for (let i = 0; i < pts.length / 2 - 1; i++) s += seg(pts, i).L;
  return s;
}
