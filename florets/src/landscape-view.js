// The packing chart beside the angle controls: packing against angle across
// the current window, the current angle as a line, and the golden and Lucas
// angles marked when they fall inside.

import { GOLDEN_DEG, LUCAS_DEG } from './phyllo.js';

export const PAD = { l: 30, r: 6, t: 6, b: 16 };

export function chartX(deg, from, to, w) {
  return PAD.l + ((deg - from) / (to - from)) * (w - PAD.l - PAD.r);
}

export function chartAngle(x, from, to, w) {
  const t = (x - PAD.l) / (w - PAD.l - PAD.r);
  return from + Math.min(1, Math.max(0, t)) * (to - from);
}

export function drawLandscape(canvas, { values, done, from, to, current }) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  if (canvas.width !== Math.round(rect.width * dpr)) {
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width, h = rect.height;
  const y = (v) => PAD.t + (1 - v) * (h - PAD.t - PAD.b);

  ctx.fillStyle = '#14110c';
  ctx.fillRect(0, 0, w, h);
  ctx.font = '10px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#a89e8a';
  for (const v of [0, 0.5, 1]) {
    ctx.fillText(`${Math.round(v * 100)}%`, PAD.l - 3, y(v));
    ctx.strokeStyle = 'rgba(168, 158, 138, 0.18)';
    ctx.beginPath();
    ctx.moveTo(PAD.l, y(v));
    ctx.lineTo(w - PAD.r, y(v));
    ctx.stroke();
  }
  ctx.textAlign = 'left';
  ctx.fillText(`${from.toFixed(2)}°`, PAD.l, h - 6);
  ctx.textAlign = 'right';
  ctx.fillText(`${to.toFixed(2)}°`, w - PAD.r, h - 6);

  for (const [deg, colour] of [[GOLDEN_DEG, '#f2b632'], [LUCAS_DEG, '#8fd0ff']]) {
    if (deg < from || deg > to) continue;
    ctx.strokeStyle = colour;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(chartX(deg, from, to, w), PAD.t);
    ctx.lineTo(chartX(deg, from, to, w), h - PAD.b);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // The sampled curve: keep the highest value that lands in each pixel
  // column, so a peak narrower than a column still shows at full height.
  if (values && done > 1) {
    const n = values.length;
    const cols = new Map();
    for (let i = 0; i < done; i++) {
      const x = Math.round(chartX(from + ((to - from) * i) / (n - 1), from, to, w));
      cols.set(x, Math.max(cols.get(x) ?? 0, values[i]));
    }
    ctx.strokeStyle = '#efe9dc';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    let first = true;
    for (const [x, v] of cols) {
      if (first) { ctx.moveTo(x, y(v)); first = false; } else ctx.lineTo(x, y(v));
    }
    ctx.stroke();
  }

  if (current >= from && current <= to) {
    ctx.strokeStyle = '#ff7a59';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(chartX(current, from, to, w), PAD.t);
    ctx.lineTo(chartX(current, from, to, w), h - PAD.b);
    ctx.stroke();
  }
}
