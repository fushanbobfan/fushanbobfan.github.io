// Discrete Voronoi diagram on the pixel grid: every pixel is labelled with the
// index of its nearest dot. Points are a flat array [x0, y0, x1, y1, ...] in
// pixel units, with pixel (px, py) sampled at its centre (px + 0.5, py + 0.5).
//
// The search buckets the dots into a uniform grid about one dot per bucket and
// walks outwards ring by ring from the pixel's own bucket. After ring r, every
// unvisited bucket lies at least r bucket widths away, so the walk stops as soon
// as the best distance found is within that bound.

export function createBuckets(points, count, width, height) {
  const size = Math.max(1, Math.sqrt((width * height) / Math.max(1, count)));
  const cols = Math.max(1, Math.ceil(width / size));
  const rows = Math.max(1, Math.ceil(height / size));
  const start = new Int32Array(cols * rows + 1);
  const cellOf = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(points[2 * i] / size)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(points[2 * i + 1] / size)));
    const c = cy * cols + cx;
    cellOf[i] = c;
    start[c + 1]++;
  }
  for (let c = 0; c < cols * rows; c++) start[c + 1] += start[c];
  const items = new Int32Array(count);
  const fillAt = start.slice(0, cols * rows);
  for (let i = 0; i < count; i++) items[fillAt[cellOf[i]]++] = i;
  return { size, cols, rows, start, items };
}

// Index of the dot nearest to (x, y), or -1 when there are no dots.
export function nearest(buckets, points, x, y) {
  const { size, cols, rows, start, items } = buckets;
  const gx = Math.min(cols - 1, Math.max(0, Math.floor(x / size)));
  const gy = Math.min(rows - 1, Math.max(0, Math.floor(y / size)));
  const maxRing = Math.max(cols, rows);
  let best = -1;
  let bestD2 = Infinity;
  for (let r = 0; r <= maxRing; r++) {
    const y0 = gy - r;
    const y1 = gy + r;
    for (let cy = Math.max(0, y0); cy <= Math.min(rows - 1, y1); cy++) {
      const edgeRow = cy === y0 || cy === y1;
      const step = edgeRow ? 1 : 2 * r;
      for (let cx = gx - r; cx <= gx + r; cx += step) {
        if (cx < 0 || cx >= cols) continue;
        const c = cy * cols + cx;
        for (let k = start[c]; k < start[c + 1]; k++) {
          const i = items[k];
          const dx = points[2 * i] - x;
          const dy = points[2 * i + 1] - y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2 || (d2 === bestD2 && i < best)) {
            bestD2 = d2;
            best = i;
          }
        }
      }
    }
    const reach = r * size;
    if (best >= 0 && bestD2 <= reach * reach) break;
  }
  return best;
}

// Label every pixel of a width x height grid with its nearest dot. With a
// mask, pixels where the mask is zero are skipped and labelled -1: blank paper
// adds nothing to any centroid, and it is where searches run longest.
export function labelPixels(points, count, width, height, out, mask) {
  const labels = out && out.length === width * height ? out : new Int32Array(width * height);
  if (count === 0) {
    labels.fill(-1);
    return labels;
  }
  const buckets = createBuckets(points, count, width, height);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = py * width + px;
      labels[i] = mask && !(mask[i] > 0) ? -1 : nearest(buckets, points, px + 0.5, py + 0.5);
    }
  }
  return labels;
}
