// The board: rows of pegs in a triangle, a ball's left/right path through
// them, and where on the canvas a ball sits at any moment of its fall.
//
// Row r (0-based) has r + 1 pegs. A ball that has gone right k times
// after row r is resting on peg k of row r + 1, so the bin a ball lands in
// is simply the number of times it went right.

export const MIN_ROWS = 1;
export const MAX_ROWS = 40;

// One step per row: 1 for right, 0 for left. `bias` is either a single
// probability of going right or an array with one probability per row.
export function dropPath(rows, bias, rng) {
  const path = new Uint8Array(rows);
  for (let r = 0; r < rows; r++) {
    const p = Array.isArray(bias) ? bias[r] : bias;
    path[r] = rng() < p ? 1 : 0;
  }
  return path;
}

export function binOf(path) {
  let k = 0;
  for (const step of path) k += step;
  return k;
}

// Drop `count` balls without animating them, adding to `counts` in place.
export function dropMany(counts, rows, bias, rng, count) {
  for (let i = 0; i < count; i++) {
    counts[binOf(dropPath(rows, bias, rng))]++;
  }
  return counts;
}

// Fit the triangle of pegs and the row of bins into a width × height box.
// The bins take the lower share of the height.
export function layout(rows, width, height, binShare = 0.42) {
  const pad = Math.max(8, Math.min(width, height) * 0.03);
  const boardHeight = height * (1 - binShare);
  const dx = Math.min((width - 2 * pad) / (rows + 1), 64);
  const dy = Math.min((boardHeight - 2 * pad) / (rows + 1), dx * 0.95);
  const top = pad + dy;
  const binTop = top + rows * dy;
  return {
    rows,
    width,
    height,
    cx: width / 2,
    dx,
    dy,
    top,
    binTop,
    binBottom: height - pad,
    pegRadius: Math.max(1.2, Math.min(5, dx * 0.12)),
    ballRadius: Math.max(1.5, Math.min(6, dx * 0.2)),
  };
}

export function pegPosition(L, row, index) {
  return { x: L.cx + (index - row / 2) * L.dx, y: L.top + row * L.dy };
}

export function binCentre(L, bin) {
  return L.cx + (bin - L.rows / 2) * L.dx;
}

// Where a ball is at time t, measured in rows: t = 0 is the drop point
// above the first peg, t = r + 1 is resting on top of row r + 1 (or in the
// bins once r + 1 = rows), and the ball keeps falling to `landY` after.
// Between pegs it hops up a little and drops, like a bounce.
export function ballPosition(L, path, t, landY = L.binBottom) {
  const lift = L.pegRadius + L.ballRadius;
  if (t <= 0) {
    return { x: L.cx, y: L.top - L.dy - lift };
  }
  if (t < 1) {
    return { x: L.cx, y: L.top - L.dy - lift + t * L.dy };
  }
  const rows = L.rows;
  if (t >= rows + 1) {
    const x = binCentre(L, binOf(path));
    const start = L.binTop - lift;
    const fall = (t - rows - 1) * L.dy * 1.5;
    return { x, y: Math.min(start + fall, landY), landed: start + fall >= landY };
  }
  const r = Math.floor(t) - 1;
  const s = t - Math.floor(t);
  let k = 0;
  for (let i = 0; i < r; i++) k += path[i];
  const from = pegPosition(L, r, k);
  const toX = from.x + (path[r] ? 0.5 : -0.5) * L.dx;
  const toY = from.y + L.dy;
  const hop = L.dy * 0.35;
  return {
    x: from.x + (toX - from.x) * s,
    y: from.y - lift + (toY - from.y) * s * s - hop * Math.sin(Math.PI * s) * (1 - s),
  };
}

// The horizontal span used to show and paint each row's chance: from the
// left edge of the first bin to the right edge of the last.
export function biasSpan(L) {
  return { left: binCentre(L, 0) - L.dx / 2, right: binCentre(L, L.rows) + L.dx / 2 };
}

// The row of pegs nearest a height on the canvas, or -1 outside the pegs.
export function rowAt(L, y) {
  const r = Math.round((y - L.top) / L.dy);
  return r >= 0 && r < L.rows ? r : -1;
}
