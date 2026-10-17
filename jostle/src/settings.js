// Page settings and their share-link form. Only values that differ from the
// defaults are written, and anything read back is clamped to its range.

import { STARTS } from './gas.js';

export const COLOURINGS = ['speed', 'half', 'plain'];

export const DEFAULTS = Object.freeze({
  n: 400,
  radius: 1.2,
  kT: 1,
  start: 'equal',
  seed: 1,
  rate: 1,
  colour: 'speed',
  trace: true,
  tracer: false,
  tracerMass: 25,
  tracerRadius: 5,
});

const NUMBERS = {
  n: { min: 2, max: 1500, integer: true },
  radius: { min: 0.4, max: 3 },
  kT: { min: 0.1, max: 5 },
  seed: { min: 0, max: 4294967295, integer: true },
  rate: { min: 0.1, max: 8 },
  tracerMass: { min: 1, max: 200 },
  tracerRadius: { min: 1, max: 12 },
};

// Most disks the box (100 x 100 units) can start with at a given radius,
// less the grid cells a central tracer of radius `tracerRadius` blocks.
export function capacity(radius, width = 100, height = 100, tracerRadius = 0) {
  const cols = Math.floor(width / (2 * radius));
  const rows = Math.floor(height / (2 * radius));
  if (!tracerRadius) return cols * rows;
  const cw = width / cols;
  const ch = height / rows;
  const reach = tracerRadius + radius;
  let free = 0;
  for (let c = 0; c < cols * rows; c++) {
    const x0 = (c % cols) * cw;
    const y0 = Math.floor(c / cols) * ch;
    const nx = Math.max(x0, Math.min(width / 2, x0 + cw));
    const ny = Math.max(y0, Math.min(height / 2, y0 + ch));
    if (Math.hypot(nx - width / 2, ny - height / 2) >= reach) free++;
  }
  return free + 1;
}

export function clampSettings(raw) {
  const s = { ...DEFAULTS };
  for (const [key, spec] of Object.entries(NUMBERS)) {
    let v = Number(raw[key]);
    if (raw[key] === undefined || raw[key] === '' || !Number.isFinite(v)) continue;
    v = Math.min(spec.max, Math.max(spec.min, v));
    s[key] = spec.integer ? Math.round(v) : v;
  }
  if (STARTS.includes(raw.start)) s.start = raw.start;
  if (COLOURINGS.includes(raw.colour)) s.colour = raw.colour;
  for (const key of ['trace', 'tracer']) {
    if (raw[key] !== undefined) s[key] = raw[key] === true || raw[key] === '1' || raw[key] === 'true';
  }
  s.n = Math.min(s.n, capacity(s.radius, 100, 100, s.tracer ? s.tracerRadius : 0));
  return s;
}

export function encodeSettings(settings) {
  const p = new URLSearchParams();
  for (const key of Object.keys(DEFAULTS)) {
    const v = settings[key];
    if (v === undefined || v === DEFAULTS[key]) continue;
    p.set(key, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return p.toString();
}

export function decodeSettings(query) {
  const p = new URLSearchParams(query.startsWith('#') || query.startsWith('?') ? query.slice(1) : query);
  const raw = {};
  for (const [k, v] of p) raw[k] = v;
  return clampSettings(raw);
}
