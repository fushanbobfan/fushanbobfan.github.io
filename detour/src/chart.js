// Minutes per driver against the number of drivers, as SVG markup.
// series: [{ id, label, points: [{ demand, value }], dashed }]; marker: { demand, value } or null;
// worse: [[from, to]] demand ranges to shade (where opening the links makes the trip slower).

export const CHART = { width: 640, height: 260, left: 52, right: 30, top: 14, bottom: 40 };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function niceStep(span, ticks) {
  const raw = span / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
}

// Options xLabel and xFormat let the same chart run against days instead of drivers.
export function renderChart({ series, marker, worse, maxDemand, xLabel = 'drivers going from S to T', xFormat = (d) => d.toLocaleString('en-US') }) {
  const { width, height, left, right, top, bottom } = CHART;
  const all = series.flatMap((s) => s.points.map((p) => p.value));
  const yMax = Math.max(10, ...all) * 1.08;
  const yStep = niceStep(yMax, 5);
  const yTop = Math.ceil(yMax / yStep) * yStep;
  const xs = (d) => left + (d / maxDemand) * (width - left - right);
  const ys = (v) => top + (1 - v / yTop) * (height - top - bottom);
  const parts = [];

  for (const [a, b] of worse) {
    parts.push(`<rect class="worse" x="${xs(a).toFixed(1)}" y="${top}" width="${(xs(b) - xs(a)).toFixed(1)}" height="${height - top - bottom}"/>`);
  }
  for (let v = 0; v <= yTop + 1e-9; v += yStep) {
    parts.push(`<line class="grid" x1="${left}" x2="${width - right}" y1="${ys(v).toFixed(1)}" y2="${ys(v).toFixed(1)}"/>`);
    parts.push(`<text class="tick" x="${left - 6}" y="${(ys(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`);
  }
  const xStep = Math.max(1, niceStep(maxDemand, 5));
  for (let d = 0; d <= maxDemand + 1e-9; d += xStep) {
    parts.push(`<text class="tick" x="${xs(d).toFixed(1)}" y="${height - bottom + 16}" text-anchor="middle">${esc(xFormat(d))}</text>`);
  }
  parts.push(`<text class="axis" x="${(left + width - right) / 2}" y="${height - 6}" text-anchor="middle">${esc(xLabel)}</text>`);
  parts.push(`<text class="axis" transform="translate(14 ${(top + height - bottom) / 2}) rotate(-90)" text-anchor="middle">minutes per driver</text>`);

  for (const s of series) {
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${xs(p.demand).toFixed(1)} ${ys(p.value).toFixed(1)}`).join(' ');
    const colour = s.color ? ` style="stroke:${esc(s.color)}"` : '';
    parts.push(`<path class="series ${esc(s.id)}${s.dashed ? ' dashed' : ''}"${colour} d="${d}"><title>${esc(s.label)}</title></path>`);
  }
  if (marker) {
    parts.push(`<line class="now" x1="${xs(marker.demand).toFixed(1)}" x2="${xs(marker.demand).toFixed(1)}" y1="${top}" y2="${height - bottom}"/>`);
    parts.push(`<circle class="now" cx="${xs(marker.demand).toFixed(1)}" cy="${ys(marker.value).toFixed(1)}" r="5"/>`);
  }
  return parts.join('');
}

// Demand ranges where series a lies above series b (sampled at the same demands).
export function rangesAbove(a, b, tol = 1e-6) {
  const out = [];
  let start = null;
  a.forEach((p, i) => {
    const above = p.value > b[i].value + tol;
    if (above && start === null) start = i;
    if (!above && start !== null) {
      out.push([a[Math.max(0, start - 1)].demand, p.demand]);
      start = null;
    }
  });
  if (start !== null) out.push([a[Math.max(0, start - 1)].demand, a[a.length - 1].demand]);
  return out;
}
