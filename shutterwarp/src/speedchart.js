// SVG chart: how fast the propeller seems to turn on video against how fast it
// really turns, at one frame rate. Speeds seen on video are measured in the
// propeller's real direction, so values below zero mean it seems to turn
// backwards. Returns a string; no DOM access.

import { makeProp } from './shutter.js';
import { apparentRpm, standstillRpms } from './video.js';

export const CHART = { w: 640, h: 260, left: 70, right: 16, top: 16, bottom: 44 };

// Speed seen on video, positive in the propeller's real direction.
export function seenRpm(rpm, blades, fps) {
  return apparentRpm(makeProp({ rpm, blades, direction: 1 }), fps);
}

export function speedChart({ blades, fps, rpm, maxRpm = 9000 }) {
  const { w, h, left, right, top, bottom } = CHART;
  const limit = (fps * 60) / blades / 2;
  const x = (v) => left + (v / maxRpm) * (w - left - right);
  const y = (v) => top + ((limit - v) / (2 * limit)) * (h - top - bottom);
  const parts = [];
  parts.push(`<svg viewBox="0 0 ${w} ${h}" class="speed" role="img" aria-labelledby="speed-title speed-desc">`);
  parts.push(`<title id="speed-title">Speed seen on video against real speed, ${blades} blade${blades === 1 ? '' : 's'} at ${fps} frames a second</title>`);
  const still = standstillRpms(blades, fps, maxRpm);
  parts.push(`<desc id="speed-desc">${describe(blades, fps, rpm, still)}</desc>`);

  for (const v of [-limit, 0, limit]) {
    parts.push(`<line class="grid${v === 0 ? ' zero' : ''}" x1="${left}" x2="${w - right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`);
    parts.push(`<text class="tick" x="${left - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`);
  }
  for (let v = 0; v <= maxRpm; v += 1500) {
    parts.push(`<text class="tick" x="${x(v).toFixed(1)}" y="${h - bottom + 18}" text-anchor="middle">${fmt(v)}</text>`);
  }
  parts.push(`<text class="tick" x="${(left + w - right) / 2}" y="${h - 6}" text-anchor="middle">real speed, rpm</text>`);
  parts.push(`<text class="tick" transform="translate(14 ${(top + h - bottom) / 2}) rotate(-90)" text-anchor="middle">seen on video, rpm</text>`);

  parts.push(`<path class="saw" d="${sawPath(blades, fps, maxRpm, x, y, limit)}"/>`);
  for (const s of still) {
    parts.push(`<circle class="still" cx="${x(s).toFixed(1)}" cy="${y(0).toFixed(1)}" r="3.5"/>`);
  }

  const seen = seenRpm(rpm, blades, fps);
  parts.push(`<line class="cursor" x1="${x(rpm).toFixed(1)}" x2="${x(rpm).toFixed(1)}" y1="${top}" y2="${h - bottom}"/>`);
  parts.push(`<circle class="here" cx="${x(rpm).toFixed(1)}" cy="${y(seen).toFixed(1)}" r="5"/>`);
  parts.push('</svg>');
  return parts.join('');
}

// The sawtooth, with a fresh subpath after each jump so no vertical line is drawn.
export function sawPath(blades, fps, maxRpm, x, y, limit) {
  const steps = 1200;
  let d = '';
  let prev = null;
  for (let i = 0; i <= steps; i++) {
    const r = (i / steps) * maxRpm;
    const a = seenRpm(r, blades, fps);
    const cmd = prev !== null && Math.abs(a - prev) < limit ? 'L' : 'M';
    d += `${cmd}${x(r).toFixed(1)},${y(a).toFixed(1)}`;
    prev = a;
  }
  return d;
}

function describe(blades, fps, rpm, still) {
  const seen = seenRpm(rpm, blades, fps);
  const where = still.length
    ? `It seems to stand still at ${still.map(fmt).join(', ')} rpm.`
    : 'It never seems to stand still in this range.';
  const now = seen === 0 ? 'standing still' : `${fmt(Math.abs(seen))} rpm ${seen > 0 ? 'forwards' : 'backwards'}`;
  return `The seen speed rises with the real speed, then jumps back each time the turn between frames passes half a blade spacing. ${where} At ${fmt(rpm)} rpm the video shows ${now}.`;
}

function fmt(v) {
  const r = Math.round(v);
  return (r === 0 ? 0 : r).toLocaleString('en-US');
}
