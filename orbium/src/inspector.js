// Draws the rule inspector: the kernel profile on top, and below it the growth
// curve over the sensed values U with a histogram of what cells sense now.

import { kernelPoints, growthPoints, potentialAxis, histogram, shareInBand, scaler } from './chart.js';
import { growthBand } from './rules.js';

const BINS = 48;

function colours(el) {
  const css = getComputedStyle(el);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    ink: v('--ink', '#1f1a16'),
    muted: v('--muted', '#6b6258'),
    line: v('--line', '#ddd4c6'),
    accent: v('--accent', '#c2491d'),
    band: v('--band', 'rgba(194, 73, 29, 0.14)'),
    bars: v('--bars', 'rgba(29, 111, 194, 0.45)'),
  };
}

function path(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
}

// Returns a one-line text summary of the picture for screen readers.
export function drawInspector(canvas, rule, potential) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const c = colours(canvas);
  const px = W / 300;
  ctx.clearRect(0, 0, W, H);
  ctx.font = `${11 * px}px system-ui, sans-serif`;
  ctx.lineWidth = 1.5 * px;

  const pad = 8 * px;
  const label = 14 * px;
  const kBox = { x: pad, y: pad + label, w: W - 2 * pad, h: H * 0.3 - label };
  const gBox = { x: pad, y: H * 0.38 + label, w: W - 2 * pad, h: H * 0.62 - label - 2 * pad - label };

  // Kernel profile.
  ctx.fillStyle = c.muted;
  ctx.fillText(`kernel K, centre to rim (R = ${rule.R})`, pad, pad + 10 * px);
  ctx.strokeStyle = c.line;
  ctx.strokeRect(kBox.x, kBox.y, kBox.w, kBox.h);
  const kp = kernelPoints(rule.rings, kBox);
  path(ctx, kp);
  ctx.lineTo(kBox.x + kBox.w, kBox.y + kBox.h);
  ctx.lineTo(kBox.x, kBox.y + kBox.h);
  ctx.closePath();
  ctx.fillStyle = c.band;
  ctx.fill();
  path(ctx, kp);
  ctx.strokeStyle = c.accent;
  ctx.stroke();

  // Growth curve, band and histogram.
  const { mu, sigma } = rule;
  const [u0, u1] = potentialAxis(mu, sigma);
  const map = scaler(gBox, [u0, u1], [-1, 1]);
  ctx.fillStyle = c.muted;
  ctx.fillText('growth G(U) and what cells sense now', pad, H * 0.38 + 10 * px);
  ctx.strokeStyle = c.line;
  ctx.strokeRect(gBox.x, gBox.y, gBox.w, gBox.h);
  const [b0, b1] = growthBand(mu, sigma);
  const [bx0] = map(Math.max(u0, b0), 0);
  const [bx1] = map(Math.min(u1, b1), 0);
  ctx.fillStyle = c.band;
  ctx.fillRect(bx0, gBox.y, bx1 - bx0, gBox.h);

  const hist = histogram(potential, BINS, u0, u1);
  const peak = Math.max(1, ...hist.counts);
  const bw = gBox.w / BINS;
  ctx.fillStyle = c.bars;
  for (let i = 0; i < BINS; i++) {
    if (!hist.counts[i]) continue;
    const h = (Math.sqrt(hist.counts[i]) / Math.sqrt(peak)) * gBox.h;
    ctx.fillRect(gBox.x + i * bw + 0.5, gBox.y + gBox.h - h, bw - 1, h);
  }

  const [, zeroY] = map(u0, 0);
  ctx.strokeStyle = c.line;
  ctx.beginPath();
  ctx.moveTo(gBox.x, zeroY);
  ctx.lineTo(gBox.x + gBox.w, zeroY);
  ctx.stroke();
  path(ctx, growthPoints(mu, sigma, gBox));
  ctx.strokeStyle = c.accent;
  ctx.stroke();

  ctx.fillStyle = c.muted;
  const axisY = gBox.y + gBox.h + 12 * px;
  ctx.fillText('0', gBox.x, axisY);
  const muText = `μ = ${mu}`;
  ctx.fillText(muText, map(mu, 0)[0] - ctx.measureText(muText).width / 2, axisY);
  const endText = u1.toFixed(2);
  ctx.fillText(endText, gBox.x + gBox.w - ctx.measureText(endText).width, axisY);

  const share = shareInBand(hist, u0, u1, mu, sigma);
  return hist.total === 0
    ? `Kernel with ${rule.rings.length} ring(s), radius ${rule.R}. The world is empty.`
    : `Kernel with ${rule.rings.length} ring(s), radius ${rule.R}. ${Math.round(share * 100)}% of sensing cells sit in the growth band ${b0.toFixed(3)} to ${b1.toFixed(3)}.`;
}
