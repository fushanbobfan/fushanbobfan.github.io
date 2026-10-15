// Canvas 2D drawing for the attractor view and the two charts. Everything
// takes a context and plain data so the page decides when to redraw.

import { projector } from './camera.js';

export const GROUPS = 12;

// Colours for the cloud: orbits are split into groups by index, and since
// the cloud starts as a ball the colours start mixed and are pulled apart
// along the attractor as the orbits separate.
export function groupColour(g, groups = GROUPS) {
  const hue = Math.round((360 * g) / groups + 20) % 360;
  return `hsl(${hue} 85% 62%)`;
}

export function groupOf(i, count, groups = GROUPS) {
  return Math.min(groups - 1, Math.floor((i * groups) / Math.max(1, count)));
}

export function drawOrbit(ctx, cam, orbit, { width, height, colour, alpha = 0.35 }) {
  const project = projector(cam, width, height);
  const p = [0, 0, 0];
  const pts = orbit.points;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let i = 0; i < orbit.length; i++) {
    project(pts[3 * i], pts[3 * i + 1], pts[3 * i + 2], p);
    if (i === 0) ctx.moveTo(p[0], p[1]);
    else ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();
  ctx.restore();
}

// Tails are drawn in a few age bands per colour group, oldest and faintest
// first, so a few hundred strokes cover thousands of segments.
export function drawCloud(ctx, cam, cloud, { width, height, bands = 6 }) {
  const project = projector(cam, width, height);
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const q = [0, 0, 0];
  const len = Math.min(cloud.tail - 1, Math.max(1, Math.floor(cloud.history.length - 1)));
  const per = Math.max(1, Math.ceil(len / bands));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.3;
  for (let band = bands - 1; band >= 0; band--) {
    const from = band * per;
    const to = Math.min(len, from + per);
    if (from >= to) continue;
    ctx.globalAlpha = 0.85 * (1 - band / bands);
    for (let g = 0; g < GROUPS; g++) {
      ctx.strokeStyle = groupColour(g);
      ctx.beginPath();
      for (let i = 0; i < cloud.count; i++) {
        if (!cloud.alive[i] || groupOf(i, cloud.count) !== g) continue;
        cloud.tailPoint(i, from, q);
        project(q[0], q[1], q[2], a);
        ctx.moveTo(a[0], a[1]);
        for (let age = from + 1; age <= to; age++) {
          cloud.tailPoint(i, age, q);
          project(q[0], q[1], q[2], b);
          ctx.lineTo(b[0], b[1]);
        }
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  for (let g = 0; g < GROUPS; g++) {
    ctx.fillStyle = groupColour(g);
    ctx.beginPath();
    for (let i = 0; i < cloud.count; i++) {
      if (!cloud.alive[i] || groupOf(i, cloud.count) !== g) continue;
      project(cloud.pos[3 * i], cloud.pos[3 * i + 1], cloud.pos[3 * i + 2], a);
      ctx.moveTo(a[0] + 1.8, a[1]);
      ctx.arc(a[0], a[1], 1.8, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.restore();
}

export function drawEquilibria(ctx, cam, points, { width, height, colour }) {
  const project = projector(cam, width, height);
  const p = [0, 0, 0];
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.5;
  for (const e of points) {
    project(e[0], e[1], e[2], p);
    ctx.beginPath();
    ctx.moveTo(p[0] - 5, p[1] - 5);
    ctx.lineTo(p[0] + 5, p[1] + 5);
    ctx.moveTo(p[0] + 5, p[1] - 5);
    ctx.lineTo(p[0] - 5, p[1] + 5);
    ctx.stroke();
  }
  ctx.restore();
}

// A small x/y/z tripod in the corner showing how the axes are turned.
export function drawAxes(ctx, cam, { width, height, colour, size = 26 }) {
  const view = { ...cam, center: [0, 0, 0], radius: 1, zoom: 1 };
  const project = projector(view, 1, 1);
  const o = [0, 0, 0];
  const p = [0, 0, 0];
  project(0, 0, 0, o);
  const cx = 16 + size;
  const cy = height - 16 - size;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ['x', 'y', 'z'].forEach((name, a) => {
    const v = [0, 0, 0];
    v[a] = 1;
    project(v[0], v[1], v[2], p);
    const dx = ((p[0] - o[0]) / 0.48) * size;
    const dy = ((p[1] - o[1]) / 0.48) * size;
    ctx.globalAlpha = p[2] < 0 ? 0.45 : 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx, cy + dy);
    ctx.stroke();
    ctx.fillText(name, cx + dx * 1.25, cy + dy * 1.25);
  });
  ctx.restore();
  return { width, height };
}

// Rounds a span out to tidy tick marks: 1, 2 or 5 times a power of ten.
export function niceTicks(lo, hi, target = 5) {
  if (!(hi > lo)) return { lo, hi, step: 1, ticks: [lo] };
  const raw = (hi - lo) / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw);
  const a = Math.floor(lo / step) * step;
  const b = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let t = a; t <= b + step * 1e-9; t += step) ticks.push(+t.toPrecision(12));
  return { lo: a, hi: b, step, ticks };
}

function frame(ctx, width, height, colours, pad) {
  ctx.fillStyle = colours.panel;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = colours.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(pad.l + 0.5, pad.t + 0.5, width - pad.l - pad.r - 1, height - pad.t - pad.b - 1);
}

// Next maximum against the last one. Lorenz drew this for z in 1963.
export function drawReturnMap(ctx, maxima, { width, height, colours, axisName }) {
  const pad = { l: 34, r: 8, t: 8, b: 26 };
  frame(ctx, width, height, colours, pad);
  if (maxima.length < 3) {
    ctx.fillStyle = colours.muted;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('no oscillation to map', width / 2, height / 2);
    return null;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const m of maxima) {
    if (m < lo) lo = m;
    if (m > hi) hi = m;
  }
  const span = hi - lo || Math.abs(hi) || 1;
  const t = niceTicks(lo - 0.05 * span, hi + 0.05 * span, 4);
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const X = (v) => pad.l + ((v - t.lo) / (t.hi - t.lo)) * w;
  const Y = (v) => pad.t + h - ((v - t.lo) / (t.hi - t.lo)) * h;
  ctx.strokeStyle = colours.grid;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(X(t.lo), Y(t.lo));
  ctx.lineTo(X(t.hi), Y(t.hi));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = colours.muted;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const v of t.ticks) ctx.fillText(fmtTick(v), X(v), height - pad.b + 12);
  ctx.textAlign = 'right';
  for (const v of t.ticks) ctx.fillText(fmtTick(v), pad.l - 4, Y(v) + 3);
  ctx.textAlign = 'center';
  ctx.fillText(`${axisName}ₙ`, pad.l + w / 2, height - 3);
  ctx.fillStyle = colours.accent;
  for (let i = 0; i + 1 < maxima.length; i++) {
    ctx.fillRect(X(maxima[i]) - 1, Y(maxima[i + 1]) - 1, 2, 2);
  }
  return t;
}

// ln(spread) of the cloud against time, with a line of slope λ for comparison.
export function drawSpread(ctx, history, { width, height, colours, lambda, radius }) {
  const pad = { l: 34, r: 8, t: 8, b: 26 };
  frame(ctx, width, height, colours, pad);
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const tMax = Math.max(1, history.length ? history[history.length - 1].t : 1);
  const tt = niceTicks(0, tMax, 4);
  let smallest = radius * 0.3;
  let largest = radius;
  for (const { spread } of history) {
    if (!(spread > 0)) continue;
    if (spread < smallest) smallest = spread;
    if (spread > largest) largest = spread;
  }
  const lo = Math.floor(Math.log10(Math.max(smallest, 1e-15)));
  const hi = Math.max(lo + 1, Math.ceil(Math.log10(largest)));
  const X = (t) => pad.l + (t / tt.hi) * w;
  const Y = (l10) => pad.t + h - ((l10 - lo) / (hi - lo)) * h;
  ctx.fillStyle = colours.muted;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  const every = Math.max(1, Math.ceil((hi - lo) / 5));
  for (let e = lo; e <= hi; e += every) ctx.fillText(`1e${e}`, pad.l - 4, Y(e) + 3);
  ctx.textAlign = 'center';
  for (const v of tt.ticks) ctx.fillText(fmtTick(v), X(v), height - pad.b + 12);
  ctx.fillText('time', pad.l + w / 2, height - 3);
  if (Number.isFinite(lambda) && history.length && history[0].spread > 0) {
    const l0 = Math.log10(history[0].spread);
    const slope = lambda / Math.LN10;
    const edge = slope > 0 ? hi : lo;
    const tEnd = slope !== 0 ? Math.min(tt.hi, (edge - l0) / slope) : tt.hi;
    ctx.strokeStyle = colours.muted;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(X(0), Y(l0));
    ctx.lineTo(X(tEnd), Y(l0 + slope * tEnd));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.strokeStyle = colours.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let started = false;
  for (const { t, spread } of history) {
    if (!(spread > 0)) continue;
    const x = X(t);
    const y = Y(Math.log10(spread));
    if (!started) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    started = true;
  }
  ctx.stroke();
  return { lo, hi, t: tt };
}

function fmtTick(v) {
  return Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(0) : String(+v.toPrecision(4));
}
