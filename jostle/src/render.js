// Drawing. Geometry is computed by pure functions so it can be tested; the
// draw functions only replay that geometry onto a canvas context.

import { maxwellPdf } from './stats.js';

// Cool blue for slow disks through to warm orange for fast ones, scaled by
// the most probable speed.
export function speedColour(v, vmp) {
  const t = Math.max(0, Math.min(1, v / (2.5 * vmp)));
  const hue = 215 - 190 * t;
  const light = 52 + 8 * t;
  return `hsl(${hue.toFixed(0)} 80% ${light.toFixed(0)}%)`;
}

export const HALF_COLOURS = ['hsl(350 70% 58%)', 'hsl(190 70% 45%)'];

export function diskColour(gas, i, colouring, vmp, plain) {
  if (colouring === 'speed') return speedColour(Math.hypot(gas.vx[i], gas.vy[i]), vmp);
  if (colouring === 'half') return HALF_COLOURS[gas.tag ? gas.tag[i] : 0];
  return plain;
}

// Map box units to canvas pixels, keeping the aspect ratio and centring.
export function boxView(gas, cw, chh, margin = 8) {
  const scale = Math.min((cw - 2 * margin) / gas.width, (chh - 2 * margin) / gas.height);
  return {
    scale,
    ox: (cw - gas.width * scale) / 2,
    oy: (chh - gas.height * scale) / 2,
  };
}

// Bars as a probability density, so they sit on the same axis as f(v).
export function histogramGeometry(hist, m, kT, w, h, pad = { l: 34, r: 8, t: 10, b: 24 }) {
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const dens = Array.from(hist.counts, (c) => (hist.total > 0 ? c / (hist.total * hist.width) : 0));
  const peak = maxwellPdf(Math.sqrt(kT / m), m, kT);
  const yMax = Math.max(peak * 1.25, ...dens) || 1;
  const sx = pw / hist.vmax;
  const sy = ph / yMax;
  const bars = dens.map((d, k) => ({
    x: pad.l + k * hist.width * sx,
    y: pad.t + ph - d * sy,
    w: hist.width * sx,
    h: d * sy,
  }));
  const curve = [];
  const steps = 120;
  for (let k = 0; k <= steps; k++) {
    const v = (k / steps) * hist.vmax;
    curve.push([pad.l + v * sx, pad.t + ph - maxwellPdf(v, m, kT) * sy]);
  }
  return { bars, curve, yMax, pad, pw, ph, sx, sy };
}

// Points of a running series (H against time) scaled into a panel.
export function seriesGeometry(values, lo, hi, w, h, pad = { l: 34, r: 8, t: 10, b: 18 }) {
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const span = hi - lo || 1;
  const n = values.length;
  return values.map((v, k) => [
    pad.l + (n <= 1 ? 0 : (k / (n - 1)) * pw),
    pad.t + ph - ((Math.min(hi, Math.max(lo, v)) - lo) / span) * ph,
  ]);
}

export function drawGas(ctx, gas, view, opts) {
  const { colouring, vmp, theme, trail } = opts;
  ctx.fillStyle = theme.box;
  ctx.fillRect(view.ox, view.oy, gas.width * view.scale, gas.height * view.scale);
  ctx.strokeStyle = theme.wall;
  ctx.lineWidth = 2;
  ctx.strokeRect(view.ox, view.oy, gas.width * view.scale, gas.height * view.scale);

  if (trail && trail.length > 1) {
    ctx.strokeStyle = theme.trail;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(view.ox + trail[0][0] * view.scale, view.oy + trail[0][1] * view.scale);
    for (let k = 1; k < trail.length; k++) {
      ctx.lineTo(view.ox + trail[k][0] * view.scale, view.oy + trail[k][1] * view.scale);
    }
    ctx.stroke();
  }

  for (let i = 0; i < gas.n; i++) {
    ctx.fillStyle = diskColour(gas, i, colouring, vmp, theme.disk);
    ctx.beginPath();
    ctx.arc(view.ox + gas.x[i] * view.scale, view.oy + gas.y[i] * view.scale,
      Math.max(0.8, gas.r[i] * view.scale), 0, 2 * Math.PI);
    ctx.fill();
  }
  if (trail) {
    const i = 0;
    ctx.strokeStyle = theme.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(view.ox + gas.x[i] * view.scale, view.oy + gas.y[i] * view.scale,
      gas.r[i] * view.scale + 2, 0, 2 * Math.PI);
    ctx.stroke();
  }
}

export function drawHistogram(ctx, geom, hist, theme) {
  const { pad, pw, ph, sx, sy, yMax } = geom;
  ctx.fillStyle = theme.bar;
  for (const b of geom.bars) ctx.fillRect(b.x + 0.5, b.y, Math.max(0, b.w - 1), b.h);
  ctx.strokeStyle = theme.curve;
  ctx.lineWidth = 2;
  ctx.beginPath();
  geom.curve.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();

  ctx.strokeStyle = theme.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, pad.t + ph);
  ctx.lineTo(pad.l + pw, pad.t + ph);
  ctx.stroke();
  ctx.fillStyle = theme.ink;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const step = niceStep(hist.vmax / 5);
  for (let v = 0; v <= hist.vmax + 1e-9; v += step) {
    ctx.fillText(formatTick(v), pad.l + v * sx, pad.t + ph + 4);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const ys = niceStep(yMax / 3);
  for (let y = 0; y <= yMax + 1e-9; y += ys) ctx.fillText(formatTick(y), pad.l - 4, pad.t + ph - y * sy);
}

export function drawSeries(ctx, points, floorY, theme, left, right) {
  if (floorY !== null) {
    ctx.strokeStyle = theme.curve;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(left, floorY);
    ctx.lineTo(right, floorY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (points.length < 2) return;
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  points.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

export function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}

function formatTick(v) {
  return Math.abs(v) < 1e-9 ? '0' : Number(v.toPrecision(3)).toString();
}
