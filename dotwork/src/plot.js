// Plotting a stipple with a pen plotter: how big it comes out on paper, how
// long the pen takes, and where the pen is at any point of the drawing.

export const PAPERS = {
  a4: { label: 'A4', long: 297, short: 210 },
  a3: { label: 'A3', long: 420, short: 297 },
  letter: { label: 'Letter', long: 279.4, short: 215.9 },
};

// Millimetres per picture pixel when the picture is fitted inside the paper,
// turned to match the picture's orientation, with `margin` mm on every side.
export function mmPerPixel(width, height, paper, margin = 15) {
  const p = PAPERS[paper];
  if (!p) throw new Error(`unknown paper: ${paper}`);
  const landscape = width >= height;
  const pw = (landscape ? p.long : p.short) - 2 * margin;
  const ph = (landscape ? p.short : p.long) - 2 * margin;
  return Math.min(pw / width, ph / height);
}

// Running distance along a closed tour: entry n is the length up to dot n,
// and the last entry is the whole loop back to the start.
export function cumulativeLengths(points, tour) {
  const n = tour.length;
  const cum = new Float64Array(n + 1);
  for (let k = 1; k <= n; k++) {
    const a = tour[k - 1];
    const b = tour[k % n];
    cum[k] = cum[k - 1] + Math.hypot(points[2 * b] - points[2 * a], points[2 * b + 1] - points[2 * a + 1]);
  }
  return cum;
}

// Where the pen is after travelling `distance` along the tour: the number of
// dots fully passed and the pen position between them.
export function penAt(points, tour, cum, distance) {
  const n = tour.length;
  if (n === 0) return { passed: 0, x: 0, y: 0 };
  const total = cum[n];
  const d = Math.min(Math.max(0, distance), total);
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid - 1;
  }
  if (lo === n) return { passed: n, x: points[2 * tour[0]], y: points[2 * tour[0] + 1] };
  const a = tour[lo];
  const b = tour[(lo + 1) % n];
  const seg = cum[lo + 1] - cum[lo];
  const t = seg > 0 ? (d - cum[lo]) / seg : 0;
  return {
    passed: lo + 1,
    x: points[2 * a] + (points[2 * b] - points[2 * a]) * t,
    y: points[2 * a + 1] + (points[2 * b + 1] - points[2 * a + 1]) * t,
  };
}

// Seconds of plotting. The line is drawn pen-down end to end at `drawSpeed`.
// Dots are visited in tour order with the pen up at `travelSpeed`, plus
// `dotTime` per dot to lower, mark and lift.
export function plotSeconds({ mode, length, dots, mmPerPx, drawSpeed = 40, travelSpeed = 120, dotTime = 0.25 }) {
  const mm = length * mmPerPx;
  if (mode === 'line') return mm / drawSpeed;
  return mm / travelSpeed + dots * dotTime;
}

export function formatDuration(seconds) {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
