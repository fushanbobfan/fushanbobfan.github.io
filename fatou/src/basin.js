// Phases of an attracting basin.
//
// When f_c has an attracting cycle z*_0 -> z*_1 -> ... -> z*_{p-1} -> z*_0,
// its immediate basin is p Fatou components, one around each cycle point,
// and f carries each onto the next. Every other bounded Fatou component is
// eventually mapped into one of them. A starting point's *phase* is the index
// j of the immediate component its orbit is in at times 0, p, 2p, ...: if
// z_n lies near z*_k then z_0 has phase (k - n) mod p.

// Index of the cycle point nearest (x, y). `points` is flat [x0, y0, x1, ...].
export function nearestCyclePoint(points, x, y) {
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < points.length; k += 2) {
    const dx = points[k] - x;
    const dy = points[k + 1] - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = k / 2;
    }
  }
  return best;
}

export function phaseOf(points, steps, x, y) {
  const p = points.length / 2;
  const k = nearestCyclePoint(points, x, y);
  return (((k - steps) % p) + p) % p;
}
