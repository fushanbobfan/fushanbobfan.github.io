// Reads the trail as a network: cells whose trail is above a threshold count
// as tube, and tube cells that touch (4-neighbour, across the edge in a
// wrapping world) form one connected piece.

export function threshold(trail, factor) {
  let sum = 0;
  const d = trail.data;
  for (let i = 0; i < d.length; i++) sum += d[i];
  return (sum / d.length) * factor;
}

// Labels every tube cell with its component id (1, 2, ...); other cells get 0.
export function labelTubes(trail, level, wrap) {
  const { width: w, height: h, data } = trail;
  const labels = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  const sizes = [0];
  let next = 0;
  for (let start = 0; start < data.length; start++) {
    if (labels[start] || data[start] <= level) continue;
    next++;
    let top = 0;
    let size = 0;
    stack[top++] = start;
    labels[start] = next;
    while (top > 0) {
      const i = stack[--top];
      size++;
      const x = i % w;
      const y = (i - x) / w;
      for (let k = 0; k < 4; k++) {
        let nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
        let ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (wrap) {
          nx = (nx + w) % w;
          ny = (ny + h) % h;
        } else if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
          continue;
        }
        const j = ny * w + nx;
        if (!labels[j] && data[j] > level) {
          labels[j] = next;
          stack[top++] = j;
        }
      }
    }
    sizes.push(size);
  }
  return { labels, sizes, count: next };
}

// Summary used by the readout: share of cells that are tube, number of
// separate pieces, and how many food sources sit on the largest shared piece.
export function analyse(trail, foods, wrap, factor = 1.5) {
  const level = threshold(trail, factor);
  const { labels, sizes, count } = labelTubes(trail, level, wrap);
  let tube = 0;
  for (let k = 1; k < sizes.length; k++) tube += sizes[k];
  const total = trail.width * trail.height;

  const foodLabels = foods.map((f) => {
    const x = Math.round(f.x);
    const y = Math.round(f.y);
    if (x < 0 || y < 0 || x >= trail.width || y >= trail.height) return 0;
    return labels[y * trail.width + x];
  });
  const tally = new Map();
  for (const l of foodLabels) if (l) tally.set(l, (tally.get(l) || 0) + 1);
  const linked = tally.size ? Math.max(...tally.values()) : 0;

  return {
    level,
    coverage: tube / total,
    pieces: count,
    largest: Math.max(0, ...sizes.slice(1)) / total,
    foodLinked: linked,
    foodTotal: foods.length,
  };
}
