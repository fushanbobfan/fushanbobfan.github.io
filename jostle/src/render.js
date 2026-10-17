// Drawing. Geometry is computed by pure functions so it can be tested; the
// draw functions only replay that geometry onto a canvas context.

import { maxwellPdf } from './stats.js';

// Blue for slow disks through a neutral grey to orange for fast ones, scaled
// by the most probable speed. Avoiding greens keeps the two ends apart for
// most forms of colour blindness.
const SPEED_STOPS = [[47, 111, 208], [176, 172, 166], [232, 89, 12]];

export function speedColour(v, vmp) {
  const t = Math.max(0, Math.min(1, v / (2.5 * vmp)));
  const k = t < 0.5 ? 0 : 1;
  const u = t < 0.5 ? t * 2 : t * 2 - 1;
  const a = SPEED_STOPS[k];
  const b = SPEED_STOPS[k + 1];
  const c = a.map((x, j) => Math.round(x + (b[j] - x) * u));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
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

// Log-log panel for the tracer's MSD: measured points, the ballistic line
// (2kT/M) tau^2 and, once fitted, the diffusive line 4 D tau + b drawn from
// the lag where the fit starts (`fit.from`).
export function msdGeometry(points, kT, mass, fit, w, h, pad = { l: 40, r: 8, t: 10, b: 22 }) {
  if (points.length < 2) return null;
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const t0 = Math.log10(points[0].tau);
  const t1 = Math.log10(points[points.length - 1].tau);
  let m0 = Infinity;
  let m1 = -Infinity;
  for (const p of points) {
    if (p.msd > 0) {
      m0 = Math.min(m0, Math.log10(p.msd));
      m1 = Math.max(m1, Math.log10(p.msd));
    }
  }
  if (!Number.isFinite(m0)) return null;
  m0 -= 0.3;
  m1 += 0.3;
  const X = (tau) => pad.l + ((Math.log10(tau) - t0) / (t1 - t0 || 1)) * pw;
  const Y = (msd) => pad.t + ph - ((Math.log10(msd) - m0) / (m1 - m0 || 1)) * ph;
  const dots = points.filter((p) => p.msd > 0).map((p) => [X(p.tau), Y(p.msd)]);
  // Lines are sampled on [from, t1] in log tau and cut where they leave the
  // panel rather than flattened against its edge.
  const line = (f, from = t0) => {
    const out = [];
    const a = Math.max(t0, from);
    for (let k = 0; k <= 40; k++) {
      const tau = 10 ** (a + ((t1 - a) * k) / 40);
      const v = f(tau);
      if (!(v > 0)) continue;
      const y = Y(v);
      if (y < pad.t - 1e-9 || y > pad.t + ph + 1e-9) continue;
      out.push([X(tau), y]);
    }
    return out;
  };
  return {
    pad, pw, ph, t0, t1, m0, m1, dots,
    ballistic: line((tau) => ((2 * kT) / mass) * tau * tau),
    diffusive: fit ? line((tau) => 4 * fit.D * tau + fit.b, Math.log10(fit.from || points[0].tau)) : [],
  };
}

export function drawMsd(ctx, geom, theme) {
  const { pad, pw, ph } = geom;
  ctx.strokeStyle = theme.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, pad.t + ph);
  ctx.lineTo(pad.l + pw, pad.t + ph);
  ctx.stroke();
  const polyline = (pts, colour, dash) => {
    if (pts.length < 2) return;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dash);
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  polyline(geom.ballistic, theme.muted, [4, 4]);
  polyline(geom.diffusive, theme.curve, []);
  ctx.fillStyle = theme.ink;
  for (const [x, y] of geom.dots) {
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let e = Math.ceil(geom.t0); e <= Math.floor(geom.t1); e++) {
    const x = pad.l + ((e - geom.t0) / (geom.t1 - geom.t0 || 1)) * pw;
    ctx.fillText(`1e${e}`, x, pad.t + ph + 4);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let e = Math.ceil(geom.m0); e <= Math.floor(geom.m1); e++) {
    const y = pad.t + ph - ((e - geom.m0) / (geom.m1 - geom.m0 || 1)) * ph;
    ctx.fillText(`1e${e}`, pad.l - 4, y);
  }
}
