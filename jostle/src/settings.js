// Page settings and their share-link form. Only values that differ from the
// defaults are written, and anything read back is clamped to its range.

import { STARTS } from './gas.js';

export const COLOURINGS = ['speed', 'half', 'species', 'plain'];

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
  partition: false,
  hole: 8,
  mix: 0,
  ratio: 4,
});

// The effusion demonstration: a dilute two-mass mixture on the left of a
// partition with a hole narrower than the mean free path.
export const EFFUSION_PRESET = Object.freeze({
  partition: true, hole: 8, mix: 0.5, ratio: 4, n: 300, radius: 0.5, start: 'maxwell', tracer: false,
});

const NUMBERS = {
  n: { min: 2, max: 1500, integer: true },
  radius: { min: 0.4, max: 3 },
  kT: { min: 0.1, max: 5 },
  seed: { min: 0, max: 4294967295, integer: true },
  rate: { min: 0.1, max: 8 },
  tracerMass: { min: 1, max: 200 },
  tracerRadius: { min: 1, max: 12 },
  hole: { min: 0, max: 40 },
  mix: { min: 0, max: 1 },
  ratio: { min: 1, max: 16 },
};

// Most disks the box (100 x 100 units) can start with at a given radius,
// less the grid cells a central tracer of radius `tracerRadius` blocks.
// With `leftOnly`, only the cells clear of a partition at the middle count.
export function capacity(radius, width = 100, height = 100, tracerRadius = 0, leftOnly = false) {
  const cols = Math.floor(width / (2 * radius));
  const rows = Math.floor(height / (2 * radius));
  if (leftOnly) {
    const cw = width / cols;
    let usable = 0;
    for (let c = 0; c < cols; c++) if ((c + 1) * cw <= width / 2 - radius) usable++;
    return usable * rows;
  }
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
  for (const key of ['trace', 'tracer', 'partition']) {
    if (raw[key] !== undefined) s[key] = raw[key] === true || raw[key] === '1' || raw[key] === 'true';
  }
  // The partition start packs the gas on the left and has no tracer.
  if (s.partition) s.tracer = false;
  s.n = Math.min(s.n, capacity(s.radius, 100, 100, s.tracer ? s.tracerRadius : 0, s.partition));
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
