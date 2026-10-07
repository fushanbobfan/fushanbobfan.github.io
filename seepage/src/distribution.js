// Cluster size distribution. n(s) is the number of finite clusters of size s per
// site; at the threshold of an infinite grid it falls off as s^-tau with
// tau = 187/91 (den Nijs 1979; Nienhuis 1982). Spanning clusters are left out.

export const TAU = 187 / 91;

// Logarithmic bins [2^k, 2^(k+1)): each point is the bin's geometric centre and the
// mean n(s) over the sizes it covers.
export function sizeDistribution(clusters, sites) {
  const bins = [];
  for (const c of clusters) {
    if (c.spans) continue;
    const k = Math.floor(Math.log2(c.size));
    bins[k] = (bins[k] || 0) + 1;
  }
  const points = [];
  bins.forEach((count, k) => {
    if (!count) return;
    const lo = 2 ** k;
    const width = lo; // sizes lo .. 2lo - 1
    points.push({ s: Math.sqrt(lo * (2 * lo - 1)), n: count / (width * sites), count, lo });
  });
  return points;
}

// Least-squares slope of log n against log s over points with s in [sMin, sMax].
export function fitSlope(points, sMin = 1, sMax = Infinity) {
  const use = points.filter((pt) => pt.lo >= sMin && pt.lo <= sMax && pt.n > 0);
  if (use.length < 2) return NaN;
  const xs = use.map((pt) => Math.log(pt.s));
  const ys = use.map((pt) => Math.log(pt.n));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  return sxy / sxx;
}
