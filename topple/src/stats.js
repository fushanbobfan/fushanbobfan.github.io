// Avalanche-size statistics: logarithmic binning and a straight-line fit on
// log-log axes, the usual way to read off a power-law exponent.

export function createHistogram(binsPerDecade = 5, maxDecades = 8) {
  return {
    binsPerDecade,
    counts: new Float64Array(binsPerDecade * maxDecades),
    total: 0,
    zeros: 0,
    largest: 0,
  };
}

// Bin k covers sizes [10^(k/b), 10^((k+1)/b)).
export function binOf(hist, size) {
  const k = Math.floor(Math.log10(size) * hist.binsPerDecade + 1e-9);
  return Math.min(hist.counts.length - 1, Math.max(0, k));
}

export function record(hist, size) {
  hist.total += 1;
  if (size <= 0) {
    hist.zeros += 1;
    return;
  }
  hist.counts[binOf(hist, size)] += 1;
  if (size > hist.largest) hist.largest = size;
}

export function reset(hist) {
  hist.counts.fill(0);
  hist.total = 0;
  hist.zeros = 0;
  hist.largest = 0;
}

// Probability density per unit size for each non-empty bin, as points
// { size, density } with size at the bin's geometric centre. Bin widths
// count only the integers inside each bin.
export function densities(hist) {
  const out = [];
  const nonzero = hist.total - hist.zeros;
  if (nonzero === 0) return out;
  const b = hist.binsPerDecade;
  for (let k = 0; k < hist.counts.length; k++) {
    const c = hist.counts[k];
    if (c === 0) continue;
    const lo = 10 ** (k / b);
    const hi = 10 ** ((k + 1) / b);
    const width = Math.ceil(hi - 1e-9) - Math.ceil(lo - 1e-9);
    if (width <= 0) continue;
    out.push({ size: Math.sqrt(lo * hi), density: c / (nonzero * width), count: c });
  }
  return out;
}

// Least-squares fit of log10(density) = a + slope * log10(size) over the
// points with size in [from, to] and at least `minCount` events.
export function fitSlope(points, { from = 1, to = Infinity, minCount = 5 } = {}) {
  const use = points.filter((p) => p.size >= from && p.size <= to && p.count >= minCount);
  if (use.length < 3) return null;
  let sx = 0; let sy = 0; let sxx = 0; let sxy = 0;
  for (const p of use) {
    const x = Math.log10(p.size);
    const y = Math.log10(p.density);
    sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const n = use.length;
  const den = n * sxx - sx * sx;
  if (den === 0) return null;
  const slope = (n * sxy - sx * sy) / den;
  return { slope, intercept: (sy - slope * sx) / n, points: n };
}
