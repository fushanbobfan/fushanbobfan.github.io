// Drawing: the world with its crests, the source, the listener and the Mach
// cone, and the listener's pitch chart. The geometry and colour helpers are
// pure so they can be tested without a canvas.

import { machAngle, dopplerRatio } from './doppler.js';
import { radius, centre, windVelocity, listenerVelocity } from './sim.js';

export const COLOURS = {
  bg: '#0f1420',
  grid: '#1b2333',
  crest: '#c9d2e3',
  high: [88, 160, 255],
  low: [255, 150, 70],
  reversed: [196, 120, 255],
  source: '#ffe08a',
  listener: '#7ee0b0',
  cone: '#ff6b6b',
  text: '#c9d2e3',
  muted: '#6b7890',
};

// Fit the world into a w x h canvas, centred, keeping its aspect.
export function makeView(w, h, world) {
  const scale = Math.min(w / world.width, h / world.height);
  return { scale, ox: (w - world.width * scale) / 2, oy: (h - world.height * scale) / 2 };
}

export const toScreen = (view, x, y) => [view.ox + x * view.scale, view.oy + y * view.scale];
export const toWorld = (view, px, py) => [(px - view.ox) / view.scale, (py - view.oy) / view.scale];

// Colour for a crest arc whose sound is shifted by `ratio`: blue when the
// pitch goes up, orange when it goes down, violet when it plays backwards,
// saturating at one and a half octaves.
export function tint(ratio) {
  if (ratio < 0) return COLOURS.reversed;
  const k = Math.min(1, Math.abs(Math.log2(ratio)) / 1.5);
  const base = [201, 210, 227];
  const to = ratio >= 1 ? COLOURS.high : COLOURS.low;
  return base.map((b, i) => Math.round(b + (to[i] - b) * k));
}

// The source's velocity through the air and its Mach number there. In a wind
// this air speed decides whether the source outruns its sound and which way
// the cone points.
export function airMotion(src, wind, c) {
  const vx = src.vx - wind.x;
  const vy = src.vy - wind.y;
  return { vx, vy, mach: Math.hypot(vx, vy) / c };
}

// End points of the two Mach cone edges, `length` world units back from the
// source along its velocity, or null below Mach 1.
export function coneEdges(src, mach, length) {
  const mu = machAngle(mach);
  const v = Math.hypot(src.vx, src.vy);
  if (mu === null || v === 0) return null;
  const bx = -src.vx / v;
  const by = -src.vy / v;
  const edge = (sign) => {
    const c = Math.cos(mu);
    const s = Math.sin(mu) * sign;
    return { x: src.x + (bx * c - by * s) * length, y: src.y + (bx * s + by * c) * length };
  };
  return [edge(1), edge(-1)];
}

// Vertical position of a pitch ratio on a log axis spanning `octaves` either
// side of the emitted tone.
export function ratioToY(ratio, top, height, octaves = 2) {
  const o = Math.max(-octaves, Math.min(octaves, Math.log2(Math.abs(ratio))));
  return top + height * (0.5 - o / (2 * octaves));
}

const ARCS = 48;

export function drawWorld(ctx, view, sim, opts) {
  const listener = sim.listener;
  const wind = windVelocity(sim);
  const diag = Math.hypot(sim.world.width, sim.world.height);
  const { width, height } = ctx.canvas;
  ctx.fillStyle = COLOURS.bg;
  ctx.fillRect(0, 0, width, height);
  const [x0, y0] = toScreen(view, 0, 0);
  const [x1, y1] = toScreen(view, sim.world.width, sim.world.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();

  ctx.strokeStyle = COLOURS.grid;
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= sim.world.width; gx += 20) {
    const [px] = toScreen(view, gx, 0);
    ctx.beginPath();
    ctx.moveTo(px, y0);
    ctx.lineTo(px, y1);
    ctx.stroke();
  }
  for (let gy = 0; gy <= sim.world.height; gy += 20) {
    const [, py] = toScreen(view, 0, gy);
    ctx.beginPath();
    ctx.moveTo(x0, py);
    ctx.lineTo(x1, py);
    ctx.stroke();
  }

  ctx.lineWidth = Math.max(1, view.scale * 0.35);
  for (const f of sim.fronts) {
    const r = radius(sim, f);
    if (r <= 0) continue;
    const fade = Math.max(0.15, 1 - r / (1.2 * diag));
    const p = centre(sim, f);
    const [cx, cy] = toScreen(view, p.x, p.y);
    if (!opts.tint || (f.vx === 0 && f.vy === 0)) {
      ctx.strokeStyle = `rgba(201, 210, 227, ${fade})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r * view.scale, 0, 2 * Math.PI);
      ctx.stroke();
      continue;
    }
    for (let k = 0; k < ARCS; k++) {
      const a0 = (k / ARCS) * 2 * Math.PI;
      const a1 = ((k + 1) / ARCS) * 2 * Math.PI;
      const am = (a0 + a1) / 2;
      const [r8, g8, b8] = tint(dopplerRatio(f.vx, f.vy, Math.cos(am), Math.sin(am), sim.c, wind));
      ctx.strokeStyle = `rgba(${r8}, ${g8}, ${b8}, ${fade})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r * view.scale, a0, a1 + 0.01);
      ctx.stroke();
    }
  }

  if (opts.cone) {
    const air = airMotion(sim.src, wind, sim.c);
    const edges = coneEdges({ x: sim.src.x, y: sim.src.y, vx: air.vx, vy: air.vy }, air.mach, diag * 2);
    if (edges) {
      const [sx, sy] = toScreen(view, sim.src.x, sim.src.y);
      ctx.strokeStyle = COLOURS.cone;
      ctx.lineWidth = Math.max(1.5, view.scale * 0.5);
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      for (const e of edges) {
        const [ex, ey] = toScreen(view, e.x, e.y);
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (opts.images) {
    ctx.strokeStyle = 'rgba(126, 224, 176, 0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    const [lx, ly] = toScreen(view, listener.x, listener.y);
    for (const im of opts.images) {
      const [ix, iy] = toScreen(view, im.x, im.y);
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(lx, ly);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const im of opts.images) {
      const [ix, iy] = toScreen(view, im.x, im.y);
      ctx.fillStyle = im.reversed ? 'rgb(196, 120, 255)' : COLOURS.listener;
      ctx.beginPath();
      ctx.arc(ix, iy, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  const [sx, sy] = toScreen(view, sim.src.x, sim.src.y);
  ctx.fillStyle = COLOURS.source;
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(4, view.scale * 1.6), 0, 2 * Math.PI);
  ctx.fill();

  const [lx, ly] = toScreen(view, listener.x, listener.y);
  ctx.strokeStyle = COLOURS.listener;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lx, ly, Math.max(6, view.scale * 2.2), 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = COLOURS.listener;
  ctx.beginPath();
  ctx.arc(lx, ly, 2, 0, 2 * Math.PI);
  ctx.fill();
  if (opts.flash > 0) {
    ctx.strokeStyle = `rgba(255, 107, 107, ${opts.flash})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(lx, ly, Math.max(6, view.scale * 2.2) * (1 + 3 * (1 - opts.flash)), 0, 2 * Math.PI);
    ctx.stroke();
  }
  const walk = listenerVelocity(sim);
  if (walk.x !== 0) arrow(ctx, lx, ly, walk.x / sim.c, view.scale * 8, COLOURS.listener);
  if (wind.x !== 0) {
    const [wx, wy] = toScreen(view, sim.world.width / 2, 6);
    arrow(ctx, wx, wy, wind.x / sim.c, view.scale * 12, COLOURS.muted);
    ctx.fillStyle = COLOURS.muted;
    ctx.font = `${Math.round(Math.max(11, view.scale * 3))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('wind', wx, wy + view.scale * 2);
  }
  ctx.restore();
}

// A horizontal arrow from (x, y) whose length grows with `amount` (a
// fraction of the speed of sound, signed for direction).
function arrow(ctx, x, y, amount, scale, colour) {
  const len = amount * scale;
  const dir = Math.sign(len);
  const head = Math.min(Math.abs(len), scale * 0.25) * dir;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.moveTo(x + len - head, y - Math.abs(head) * 0.6);
  ctx.lineTo(x + len, y);
  ctx.lineTo(x + len - head, y + Math.abs(head) * 0.6);
  ctx.stroke();
}

// Vertical position of a pressure value on a plot scaled to `peak`.
export function traceY(v, peak, top, height) {
  const k = peak > 0 ? Math.max(-1, Math.min(1, v / peak)) : 0;
  return top + height * (0.5 - 0.45 * k);
}

// A dashed vertical line at each boom inside the plot's time window.
function boomMarks(ctx, booms, now, window, left, width, top, height) {
  ctx.strokeStyle = COLOURS.cone;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (const b of booms) {
    const age = now - b;
    if (age < 0 || age > window) continue;
    const x = left + width * (1 - age / window);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + height);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

// The microphone: pressure at the listener over the last `window` seconds,
// newest on the right, scaled to the loudest moment on screen.
export function drawTrace(ctx, trace, booms, now, window) {
  const { width, height } = ctx.canvas;
  const pad = { l: 8, r: 8, t: 6, b: 6 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  ctx.fillStyle = COLOURS.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = COLOURS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t + h / 2);
  ctx.lineTo(pad.l + w, pad.t + h / 2);
  ctx.stroke();
  boomMarks(ctx, booms, now, window, pad.l, w, pad.t, h);
  const peak = trace.peak();
  ctx.strokeStyle = COLOURS.listener;
  ctx.lineWidth = Math.max(1, height / 90);
  ctx.beginPath();
  for (let i = 0; i < trace.t.length; i++) {
    const x = pad.l + w * (1 - (now - trace.t[i]) / window);
    const y = traceY(trace.v[i], peak, pad.t, h);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// The pitch chart: each image the listener hears is a dot at its ratio,
// newest on the right, over the last `window` seconds.
export function drawPitch(ctx, samples, now, window = 10, booms = []) {
  const { width, height } = ctx.canvas;
  const pad = { l: 44, r: 8, t: 8, b: 20 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  ctx.fillStyle = COLOURS.bg;
  ctx.fillRect(0, 0, width, height);
  const dpr = height / 160;
  ctx.font = `${Math.round(11 * Math.max(1, dpr))}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (const r of [0.25, 0.5, 1, 2, 4]) {
    const y = ratioToY(r, pad.t, h);
    ctx.strokeStyle = r === 1 ? COLOURS.muted : COLOURS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + w, y);
    ctx.stroke();
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText(r >= 1 ? `×${r}` : `×1/${1 / r}`, pad.l - 6, y);
  }
  ctx.textAlign = 'left';
  ctx.fillText(`last ${window} s`, pad.l, height - pad.b / 2);
  boomMarks(ctx, booms, now, window, pad.l, w, pad.t, h);
  const size = Math.max(1.5, 1.6 * dpr);
  for (const s of samples) {
    const age = now - s.t;
    if (age > window) continue;
    const x = pad.l + w * (1 - age / window);
    for (const im of s.images) {
      const [r8, g8, b8] = tint(im.ratio);
      ctx.fillStyle = `rgb(${r8}, ${g8}, ${b8})`;
      ctx.fillRect(x - size / 2, ratioToY(im.ratio, pad.t, h) - size / 2, size, size);
    }
  }
}
