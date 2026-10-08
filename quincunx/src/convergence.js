// How far the bins are from the exact distribution as balls accumulate,
// and the log-log chart that shows it.

// Record a point when the ball count has grown by at least `factor` since
// the last one, so the history stays short and evenly spread on a log axis.
export function recordPoint(history, total, distance, factor = 1.12) {
  if (!(total > 0) || !Number.isFinite(distance)) return false;
  const last = history[history.length - 1];
  if (last && total < last.total * factor) return false;
  history.push({ total, distance });
  return true;
}

// Axis ranges in decades: x from 1 ball to the decade above the latest
// count (at least 10 000), y from the decade below the smallest value
// shown (at least 0.001) up to 1.
export function chartRange(history, expected) {
  const maxN = Math.max(10000, ...history.map((p) => p.total));
  const xmax = 10 ** Math.ceil(Math.log10(maxN));
  const values = [...history.map((p) => p.distance), expected(xmax)].filter((v) => v > 0);
  const ymin = Math.min(0.001, 10 ** Math.floor(Math.log10(Math.min(...values))));
  return { xmin: 1, xmax, ymin, ymax: 1 };
}

export function toChart(range, box) {
  const lx = Math.log10(range.xmax / range.xmin);
  const ly = Math.log10(range.ymax / range.ymin);
  return (n, v) => {
    const x = box.left + (Math.log10(n / range.xmin) / lx) * (box.right - box.left);
    const clamped = Math.min(range.ymax, Math.max(range.ymin, v));
    const y = box.top + (Math.log10(range.ymax / clamped) / ly) * (box.bottom - box.top);
    return [x, y];
  };
}

export function pathFrom(points) {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
}

// Evenly spaced on the log axis, for drawing a smooth curve.
export function logSamples(lo, hi, count = 60) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(lo * (hi / lo) ** (i / (count - 1)));
  return out;
}

export function decades(lo, hi) {
  const out = [];
  for (let e = Math.round(Math.log10(lo)); e <= Math.round(Math.log10(hi)); e++) out.push(10 ** e);
  return out;
}

const fmtTick = (v) => (v >= 1000 ? `${v / 1000}k` : String(v));

// The chart as an SVG fragment: decade gridlines, the expected curve
// (dashed) and the observed distance after each recorded point.
export function chartSvg(history, expected, { width = 280, height = 170 } = {}) {
  const box = { left: 38, right: width - 8, top: 8, bottom: height - 24 };
  const range = chartRange(history, expected);
  const at = toChart(range, box);
  const parts = [];
  for (const n of decades(range.xmin, range.xmax)) {
    const [x] = at(n, 1);
    parts.push(`<line class="grid" x1="${x.toFixed(1)}" y1="${box.top}" x2="${x.toFixed(1)}" y2="${box.bottom}"/>`);
    parts.push(`<text class="tick" x="${x.toFixed(1)}" y="${height - 8}" text-anchor="middle">${fmtTick(n)}</text>`);
  }
  for (const v of decades(range.ymin, range.ymax)) {
    const [, y] = at(1, v);
    parts.push(`<line class="grid" x1="${box.left}" y1="${y.toFixed(1)}" x2="${box.right}" y2="${y.toFixed(1)}"/>`);
    parts.push(`<text class="tick" x="${box.left - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end">${v}</text>`);
  }
  const curve = logSamples(range.xmin, range.xmax).map((n) => at(n, expected(n)));
  parts.push(`<path class="expected" d="${pathFrom(curve)}"/>`);
  if (history.length) {
    parts.push(`<path class="observed" d="${pathFrom(history.map((p) => at(p.total, p.distance)))}"/>`);
    const [x, y] = at(history[history.length - 1].total, history[history.length - 1].distance);
    parts.push(`<circle class="observed-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"/>`);
  }
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Distance from the exact distribution against the number of balls, on log-log axes">${parts.join('')}</svg>`;
}
