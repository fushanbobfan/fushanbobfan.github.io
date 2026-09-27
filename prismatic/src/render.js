// Canvas drawing for the bench: grid, light paths, elements and handles.

import { wavelengthToCss } from './spectrum.js';
import { outlineOf, SOURCE_KINDS } from './elements.js';
import { handleOf } from './picking.js';

const GLASS_FILL = 'rgba(150, 190, 255, 0.10)';
const GLASS_EDGE = 'rgba(190, 215, 255, 0.75)';
const MIRROR_EDGE = '#d9dde8';
const BLOCKER_EDGE = '#5b5f6e';
const SELECT = '#ffd479';

export function drawGrid(ctx, w, h, spacing = 40) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = spacing; x < w; x += spacing) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = spacing; y < h; y += spacing) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

// Draw light paths additively, batching segments that share a colour and a
// quantised brightness into one path each.
export function drawRays(ctx, segments, { gain = 1, floor = 0 } = {}) {
  const LEVELS = 24;
  const buckets = new Map();
  for (const s of segments) {
    const a = Math.min(1, s.intensity * (s.share ?? 1) * gain);
    if (a < floor) continue;
    const level = Math.max(1, Math.round(a * LEVELS));
    const key = `${s.wavelength}|${level}`;
    let list = buckets.get(key);
    if (!list) buckets.set(key, (list = []));
    list.push(s);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (const [key, list] of buckets) {
    const [wl, level] = key.split('|').map(Number);
    ctx.strokeStyle = wavelengthToCss(wl, level / LEVELS);
    ctx.beginPath();
    for (const s of list) {
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function tracePath(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
}

function drawSource(ctx, el) {
  const colour = el.light === 'white' ? '#f2f2f2' : wavelengthToCss(el.wavelength);
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.rotate(el.angle);
  ctx.fillStyle = '#20242f';
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.5;
  if (el.kind === 'laser') {
    ctx.beginPath();
    ctx.rect(-26, -7, 26, 14);
    ctx.fill();
    ctx.stroke();
  } else if (el.kind === 'beam') {
    const h = Math.max(8, el.width / 2 + 6);
    ctx.beginPath();
    ctx.rect(-10, -h, 10, 2 * h);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawElement(ctx, el) {
  if (SOURCE_KINDS.has(el.kind)) {
    drawSource(ctx, el);
    return;
  }
  const pts = outlineOf(el);
  ctx.save();
  ctx.lineJoin = 'round';
  if (el.kind === 'mirror' || el.kind === 'curvedMirror') {
    ctx.strokeStyle = MIRROR_EDGE;
    ctx.lineWidth = 3;
    tracePath(ctx, pts);
    ctx.stroke();
  } else if (el.kind === 'blocker') {
    ctx.strokeStyle = BLOCKER_EDGE;
    ctx.lineWidth = 5;
    tracePath(ctx, pts);
    ctx.stroke();
  } else {
    tracePath(ctx, pts);
    ctx.closePath();
    ctx.fillStyle = GLASS_FILL;
    ctx.fill();
    ctx.strokeStyle = GLASS_EDGE;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSelection(ctx, el) {
  const h = handleOf(el);
  ctx.save();
  ctx.strokeStyle = SELECT;
  ctx.fillStyle = SELECT;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(el.x, el.y);
  ctx.lineTo(h.x, h.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(h.x, h.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(el.x, el.y, 3, 0, Math.PI * 2);
  ctx.fill();
  if (!SOURCE_KINDS.has(el.kind)) {
    ctx.lineWidth = 2;
    tracePath(ctx, outlineOf(el));
    ctx.stroke();
  }
  ctx.restore();
}
