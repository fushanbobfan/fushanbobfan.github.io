// SVG charts beside the pictures. Each returns a string; no DOM access.

import { temperature } from './air.js';
import { BOARD, BOARD_HEIGHT } from './view.js';

const DEG = 180 / Math.PI;

export const FOLD = { w: 640, h: 320, left: 64, right: 18, top: 16, bottom: 44 };

// Where each row of the view lands on the board's line, drawn sideways so the
// rows line up with the picture: viewing angle down the side, height reached
// along the bottom. Upright and upside-down stretches get their own class.
export function foldChart(rows, { top, bottom }, { eye }) {
  const { w, h, left, right, top: t, bottom: b } = FOLD;
  const zMax = Math.max(2.5, Math.ceil(eye * 1.2 * 2) / 2);
  const x = (z) => left + (z / zMax) * (w - left - right);
  const y = (a) => t + ((top - a) / (top - bottom)) * (h - t - b);
  const parts = [];
  parts.push(`<svg viewBox="0 0 ${w} ${h}" class="fold" role="img" aria-labelledby="fold-title fold-desc">`);
  parts.push('<title id="fold-title">Height each ray reaches at the board, against where it enters the eye</title>');
  parts.push(`<desc id="fold-desc">${describeFold(rows)}</desc>`);

  let base = 0;
  for (const band of BOARD.bands) {
    parts.push(`<rect class="band ${band.color}" x="${x(base).toFixed(1)}" y="${t}" width="${(x(band.top) - x(base)).toFixed(1)}" height="${h - t - b}"/>`);
    base = band.top;
  }
  parts.push(`<text class="tick" x="${x(BOARD_HEIGHT / 2).toFixed(1)}" y="${t + 14}" text-anchor="middle">the board</text>`);

  for (let z = 0; z <= zMax + 1e-9; z += 0.5) {
    parts.push(`<text class="tick" x="${x(z).toFixed(1)}" y="${h - b + 18}" text-anchor="middle">${z.toFixed(1)}</text>`);
  }
  parts.push(`<text class="tick" x="${(left + w - right) / 2}" y="${h - 6}" text-anchor="middle">height reached at the board, m</text>`);
  for (const a of angleTicks(top, bottom)) {
    parts.push(`<line class="grid${a === 0 ? ' zero' : ''}" x1="${left}" x2="${w - right}" y1="${y(a).toFixed(1)}" y2="${y(a).toFixed(1)}"/>`);
    parts.push(`<text class="tick" x="${left - 6}" y="${(y(a) + 4).toFixed(1)}" text-anchor="end">${a === 0 ? 'eye level' : `${(a * DEG).toFixed(2)}°`}</text>`);
  }

  // Rays that end on the road before the board: a grey bar at the left edge.
  for (const r of rows) {
    if (r.zAtBoard === null) {
      parts.push(`<rect class="road" x="${left - 4}" y="${(y(r.angle) - 1).toFixed(1)}" width="4" height="2.2"/>`);
    }
  }

  for (const [cls, d] of foldPaths(rows, x, y, zMax)) parts.push(`<path class="${cls}" d="${d}"/>`);

  const fold = foldPoint(rows);
  if (fold) {
    const fx = x(fold.zAtBoard);
    const fy = y(fold.angle);
    parts.push(`<circle class="mark" cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="4.5"/>`);
    const anchor = fx > w / 2 ? 'end' : 'start';
    const tx = anchor === 'start' ? fx + 10 : fx - 10;
    parts.push(`<text class="note" x="${tx.toFixed(1)}" y="${(fy + 4).toFixed(1)}" text-anchor="${anchor}">fold: nothing below ${heightText(fold.zAtBoard)} is seen</text>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

// Splits the curve into runs of upright and upside-down rows, breaking it
// wherever a ray ends on the road or climbs off the chart.
export function foldPaths(rows, x, y, zMax) {
  const out = [];
  let d = '';
  let cls = null;
  let last = null;
  const flush = () => {
    if (d && d.includes('L')) out.push([cls, d]);
    d = '';
  };
  for (const r of rows) {
    const z = r.zAtBoard;
    if (z === null || z > zMax) {
      flush();
      cls = null;
      last = null;
      continue;
    }
    const c = r.turned ? 'curve inverted' : 'curve upright';
    const p = `${x(z).toFixed(1)},${y(r.angle).toFixed(1)}`;
    if (c !== cls) {
      flush();
      d = last ? `M${last}L${p}` : `M${p}`;
      cls = c;
    } else {
      d += d ? `L${p}` : `M${p}`;
    }
    last = p;
  }
  flush();
  return out;
}

// The lowest point the rays reach on the board, when the picture folds back
// on itself there (some rows below it are upside down).
export function foldPoint(rows) {
  if (!rows.some((r) => r.turned && r.zAtBoard !== null)) return null;
  let best = null;
  for (const r of rows) if (r.zAtBoard !== null && (!best || r.zAtBoard < best.zAtBoard)) best = r;
  return best;
}

function angleTicks(top, bottom) {
  const span = (top - bottom) * DEG;
  const step = [0.05, 0.1, 0.2, 0.25, 0.5, 1].find((s) => span / s <= 6) / DEG;
  const ticks = [];
  for (let a = Math.ceil(bottom / step) * step; a <= top + 1e-12; a += step) {
    ticks.push(Math.abs(a) < step / 1000 ? 0 : a);
  }
  return ticks;
}

function heightText(z) {
  return z < 1 ? `${Math.round(z * 100)} cm` : `${z.toFixed(2)} m`;
}

function describeFold(rows) {
  const fold = foldPoint(rows);
  if (!fold) {
    return 'Going down the view, the height reached at the board falls steadily: one upright picture, with the road below it.';
  }
  return `Going down the view, the height reached at the board falls to ${heightText(fold.zAtBoard)} and then rises again. The rows below that fold see the board from the bottom up, which is the upside-down copy.`;
}

export const PROFILE = { w: 300, h: 320, left: 54, right: 14, top: 16, bottom: 44 };

// Temperature against height above the road, up to a little above whichever
// is visible at that scale: the eye or the heated layer.
export function profileChart(air, { eye }) {
  const { w, h, left, right, top, bottom } = PROFILE;
  const zMax = Math.min(Math.max(eye, BOARD_HEIGHT) * 1.1, Math.max(8 * air.layer, 0.2));
  const lo = Math.min(air.surface, air.air);
  const hi = Math.max(air.surface, air.air);
  const pad = Math.max(2, (hi - lo) * 0.08);
  const tMin = Math.floor((lo - pad) / 5) * 5;
  const tMax = Math.ceil((hi + pad) / 5) * 5;
  const x = (c) => left + ((c - tMin) / (tMax - tMin)) * (w - left - right);
  const y = (z) => top + (1 - z / zMax) * (h - top - bottom);
  const parts = [];
  parts.push(`<svg viewBox="0 0 ${w} ${h}" class="profile" role="img" aria-labelledby="profile-title profile-desc">`);
  parts.push('<title id="profile-title">Air temperature against height above the road</title>');
  parts.push(`<desc id="profile-desc">${describeProfile(air)}</desc>`);
  const tStep = tMax - tMin > 40 ? 20 : tMax - tMin > 20 ? 10 : 5;
  for (let c = tMin; c <= tMax; c += tStep) {
    parts.push(`<line class="grid" x1="${x(c).toFixed(1)}" x2="${x(c).toFixed(1)}" y1="${top}" y2="${h - bottom}"/>`);
    parts.push(`<text class="tick" x="${x(c).toFixed(1)}" y="${h - bottom + 18}" text-anchor="middle">${c}</text>`);
  }
  parts.push(`<text class="tick" x="${(left + w - right) / 2}" y="${h - 6}" text-anchor="middle">temperature, °C</text>`);
  for (const z of heightTicks(zMax)) {
    parts.push(`<text class="tick" x="${left - 6}" y="${(y(z) + 4).toFixed(1)}" text-anchor="end">${heightText(z)}</text>`);
  }
  let d = '';
  for (let i = 0; i <= 120; i++) {
    const z = (zMax * i) / 120;
    d += `${i ? 'L' : 'M'}${x(temperature(air, z)).toFixed(1)},${y(z).toFixed(1)}`;
  }
  parts.push(`<path class="temp" d="${d}"/>`);
  if (eye <= zMax) {
    parts.push(`<line class="eye" x1="${left}" x2="${w - right}" y1="${y(eye).toFixed(1)}" y2="${y(eye).toFixed(1)}"/>`);
    parts.push(`<text class="note" x="${w - right - 4}" y="${(y(eye) - 5).toFixed(1)}" text-anchor="end">eye</text>`);
  } else {
    parts.push(`<text class="note" x="${w - right - 4}" y="${top + 12}" text-anchor="end">eye at ${eye.toFixed(1)} m, above the chart</text>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

function heightTicks(zMax) {
  const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1].find((s) => zMax / s <= 6);
  const ticks = [];
  for (let k = 0; k * step <= zMax + 1e-9; k++) ticks.push(Number((k * step).toFixed(4)));
  return ticks;
}

function describeProfile(air) {
  if (air.surface === air.air) return `The air is ${air.air} °C all the way up: no layer, so nothing bends.`;
  const warm = air.surface > air.air;
  return `The air is ${air.surface} °C at the road and ${warm ? 'cools' : 'warms'} towards ${air.air} °C higher up: two-thirds of the change happens in the lowest ${heightText(air.layer)} and 95% within ${heightText(3 * air.layer)}.`;
}
