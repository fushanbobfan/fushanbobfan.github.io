// Drawing for the shoot-tip view: the apex with its newest primordia, and a
// chart of the divergence between successive primordia.

import { GOLDEN_DEG, LUCAS_DEG } from './phyllo.js';
import { growthAt } from './growth.js';

const VIEW_RADIUS = 7; // in apex radii

export function drawTip(ctx, tip, w, h) {
  ctx.save();
  ctx.fillStyle = '#14110c';
  ctx.fillRect(0, 0, w, h);
  const scale = (0.48 * Math.min(w, h)) / VIEW_RADIUS;
  ctx.translate(w / 2, h / 2);

  // The ratio in force at the newest step sets how big a primordium looks
  // next to the gap it leaves behind it.
  const g = growthAt(Math.max(0, tip.divergences.length - 1), tip.steps, tip.start, tip.end);
  const size = Math.min(0.42, 0.55 * Math.sqrt(Math.log(g)));
  const prims = tip.primordia;
  const last = prims.length - 1;
  for (let i = 0; i <= last; i++) {
    const p = prims[i];
    if (p.r > VIEW_RADIUS + 1) continue;
    const age = Math.min(1, (last - i) / 60);
    ctx.fillStyle = `hsl(${(48 - 30 * age).toFixed(1)} ${(88 - 30 * age).toFixed(1)}% ${(60 - 22 * age).toFixed(1)}%)`;
    ctx.beginPath();
    ctx.arc(p.r * Math.cos(p.a) * scale, -p.r * Math.sin(p.a) * scale, Math.max(1.5, size * p.r * scale), 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(239, 233, 220, 0.55)';
  ctx.setLineDash([4, 5]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, scale, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);

  if (prims.length > 1) {
    // The newest primordium, and the turn it made from the one before.
    const a = prims[last], b = prims[last - 1];
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(a.r * Math.cos(a.a) * scale, -a.r * Math.sin(a.a) * scale, size * a.r * scale + 4, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(143, 208, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(b.a) * scale * 0.8, -Math.sin(b.a) * scale * 0.8);
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a.a) * scale * 0.8, -Math.sin(a.a) * scale * 0.8);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawChart(canvas, tip) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width, h = rect.height;
  const pad = { l: 30, r: 6, t: 6, b: 16 };
  const lo = 90, hi = 180;
  const x = (i) => pad.l + (i / Math.max(1, tip.steps - 1)) * (w - pad.l - pad.r);
  const y = (d) => pad.t + ((hi - d) / (hi - lo)) * (h - pad.t - pad.b);

  ctx.fillStyle = '#14110c';
  ctx.fillRect(0, 0, w, h);
  ctx.font = '10px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (const [d, label, colour] of [[180, '180°', '#6d6455'], [GOLDEN_DEG, '137.5°', '#f2b632'], [LUCAS_DEG, '99.5°', '#8fd0ff']]) {
    ctx.strokeStyle = colour;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(pad.l, y(d));
    ctx.lineTo(w - pad.r, y(d));
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = colour;
    ctx.fillText(label, pad.l - 3, y(d));
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#a89e8a';
  ctx.fillText('step', pad.l, h - 6);
  ctx.textAlign = 'right';
  ctx.fillText(String(tip.steps), w - pad.r, h - 6);

  ctx.fillStyle = '#efe9dc';
  tip.divergences.forEach((d, i) => {
    const yy = y(Math.max(lo, Math.min(hi, d)));
    ctx.fillRect(x(i) - 1, yy - 1, 2, 2);
  });
}
