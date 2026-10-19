// Geometry for the force chart: value ranges that hold the data with a
// little room and snap to tidy numbers, and the mapping to canvas points.

// Smallest of 1, 2 or 5 times a power of ten that is at least x.
export function niceCeil(x) {
  if (!(x > 0)) return 0;
  const p = 10 ** Math.floor(Math.log10(x));
  for (const m of [1, 2, 5, 10]) if (m * p >= x - 1e-12 * p) return m * p;
  return 10 * p;
}

// Range for lift: symmetric about zero, at least +-0.2.
export function liftRange(values) {
  let m = 0;
  for (const v of values) m = Math.max(m, Math.abs(v));
  const top = Math.max(0.2, niceCeil(m * 1.1));
  return [-top, top];
}

// Range for drag: from zero (or below, if the drag goes negative) to a tidy
// top, at least 0.5.
export function dragRange(values) {
  let lo = 0, hi = 0;
  for (const v of values) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return [lo < 0 ? -niceCeil(-lo * 1.1) : 0, Math.max(0.5, niceCeil(hi * 1.1))];
}

// Canvas points for samples (t, v) in a box {x, y, w, h}, with time running
// over [t0, t1] and values over [lo, hi] bottom to top.
export function toPoints(t, v, box, [t0, t1], [lo, hi]) {
  const out = [];
  const span = t1 - t0 || 1, range = hi - lo || 1;
  for (let k = 0; k < t.length; k++) {
    out.push([box.x + ((t[k] - t0) / span) * box.w, box.y + box.h - ((v[k] - lo) / range) * box.h]);
  }
  return out;
}
