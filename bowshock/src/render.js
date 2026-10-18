// Drawing: the world with its crests, the source, the listener and the Mach
// cone, and the listener's pitch chart. The geometry and colour helpers are
// pure so they can be tested without a canvas.

import { machAngle, dopplerRatio } from './doppler.js';
import { radius } from './sim.js';

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

export function drawWorld(ctx, view, sim, listener, opts) {
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
    const fade = Math.max(0.15, 1 - r / f.reach);
    const [cx, cy] = toScreen(view, f.x, f.y);
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
      const [r8, g8, b8] = tint(dopplerRatio(f.vx, f.vy, Math.cos(am), Math.sin(am), sim.c));
      ctx.strokeStyle = `rgba(${r8}, ${g8}, ${b8}, ${fade})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r * view.scale, a0, a1 + 0.01);
      ctx.stroke();
    }
  }

  if (opts.cone) {
    const edges = coneEdges(sim.src, sim.mach, Math.hypot(sim.world.width, sim.world.height) * 2);
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
  ctx.restore();
}

// The pitch chart: each image the listener hears is a dot at its ratio,
// newest on the right, over the last `window` seconds.
export function drawPitch(ctx, samples, now, window = 10) {
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
