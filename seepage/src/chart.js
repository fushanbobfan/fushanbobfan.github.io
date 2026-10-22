// Plain SVG path strings for the sweep charts: x runs over p in [0, 1], y over [0, 1].

export function linePath(xs, ys, { width, height, pad = 0 }) {
  const w = width - 2 * pad;
  const h = height - 2 * pad;
  return xs
    .map((x, i) => `${i ? 'L' : 'M'}${(pad + x * w).toFixed(1)},${(pad + (1 - ys[i]) * h).toFixed(1)}`)
    .join('');
}

// Counts of values in `bins` equal-width bins over [lo, hi); values outside are dropped.
export function histogram(values, bins, lo = 0, hi = 1) {
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    if (!(v >= lo && v < hi)) continue;
    counts[Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins))]++;
  }
  return counts;
}

export function barsPath(counts, { width, height, pad = 0, lo = 0, hi = 1 }) {
  const max = Math.max(1, ...counts);
  const w = width - 2 * pad;
  const h = height - 2 * pad;
  const bw = ((hi - lo) * w) / counts.length;
  return counts
    .map((c, i) => {
      if (!c) return '';
      const x = pad + lo * w + i * bw;
      const bh = (c / max) * h * 0.9;
      return `M${x.toFixed(1)},${(pad + h).toFixed(1)}h${bw.toFixed(1)}v${(-bh).toFixed(1)}h${(-bw).toFixed(1)}Z`;
    })
    .join('');
}
