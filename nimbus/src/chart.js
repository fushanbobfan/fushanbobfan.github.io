// Radial distribution chart: r^2 R^2, the share of the electron found at
// each distance, with the sampled radii as a histogram on top.

import { BOHR_ANGSTROM } from './hydrogen.js';

export function niceStep(span, target) {
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const f of [1, 2, 5, 10]) if (f * mag >= raw) return f * mag;
  return 10 * mag;
}

export function histogram(radii, count, rMax, bins, weights = null) {
  const h = new Float64Array(bins);
  const w = rMax / bins;
  let total = 0;
  for (let k = 0; k < count; k++) {
    const wk = weights ? weights[k] : 1;
    total += wk;
    const b = Math.floor(radii[k] / w);
    if (b >= 0 && b < bins) h[b] += wk;
  }
  // As a density per unit radius, comparable with r^2 R^2.
  for (let b = 0; b < bins; b++) h[b] /= total * w;
  return h;
}

export function drawChart(ctx, width, height, info) {
  const { table, rView, nodes, peakRadius, mean, sample, weights, colors } = info;
  const pad = { l: 44, r: 12, t: 12, b: 34 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  ctx.clearRect(0, 0, width, height);

  const { r, p } = table;
  let pMax = 0;
  for (let i = 0; i < r.length && r[i] <= rView; i++) pMax = Math.max(pMax, p[i]);
  const bins = 60;
  const hist = sample ? histogram(sample.radii, sample.count, rView, bins, weights) : null;
  if (hist) for (const v of hist) pMax = Math.max(pMax, v);
  pMax *= 1.08;
  const X = (x) => pad.l + (x / rView) * W;
  const Y = (y) => pad.t + H - (y / pMax) * H;

  ctx.font = '12px system-ui, sans-serif';
  ctx.strokeStyle = colors.grid;
  ctx.fillStyle = colors.muted;
  ctx.lineWidth = 1;
  const step = niceStep(rView, 6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = 0; x <= rView + 1e-9; x += step) {
    ctx.beginPath();
    ctx.moveTo(X(x), pad.t);
    ctx.lineTo(X(x), pad.t + H);
    ctx.stroke();
    ctx.fillText(String(+x.toFixed(2)), X(x), pad.t + H + 4);
  }
  ctx.fillText('distance from the nucleus (Bohr radii, 1 a₀ = ' + BOHR_ANGSTROM.toFixed(3) + ' Å)', pad.l + W / 2, pad.t + H + 18);
  ctx.save();
  ctx.translate(12, pad.t + H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = 'middle';
  ctx.fillText('probability per a₀', 0, 0);
  ctx.restore();

  if (hist) {
    ctx.fillStyle = colors.hist;
    const bw = W / bins;
    for (let b = 0; b < bins; b++) {
      const top = Y(hist[b]);
      ctx.fillRect(pad.l + b * bw + 1, top, Math.max(1, bw - 2), pad.t + H - top);
    }
  }

  ctx.strokeStyle = colors.curve;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < r.length && r[i] <= rView; i++) {
    if (!started) {
      ctx.moveTo(X(r[i]), Y(p[i]));
      started = true;
    } else ctx.lineTo(X(r[i]), Y(p[i]));
  }
  ctx.stroke();

  const marker = (x, color, dash, label, row) => {
    if (x == null || x > rView) return;
    ctx.strokeStyle = color;
    ctx.setLineDash(dash);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(x), pad.t);
    ctx.lineTo(X(x), pad.t + H);
    ctx.stroke();
    ctx.setLineDash([]);
    if (label) {
      ctx.fillStyle = color;
      ctx.textAlign = X(x) > pad.l + W - 90 ? 'right' : 'left';
      ctx.textBaseline = 'top';
      const dx = ctx.textAlign === 'right' ? -4 : 4;
      ctx.fillText(label, X(x) + dx, pad.t + 2 + 15 * row);
    }
  };
  nodes.forEach((x, i) => marker(x, colors.node, [3, 3], i === 0 ? 'node' : '', 2));
  marker(peakRadius, colors.curve, [], 'most likely', 0);
  marker(mean, colors.mean, [6, 4], 'mean', 1);
}
