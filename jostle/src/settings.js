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
});

const NUMBERS = {
  n: { min: 2, max: 1500, integer: true },
  radius: { min: 0.4, max: 3 },
  kT: { min: 0.1, max: 5 },
  seed: { min: 0, max: 4294967295, integer: true },
  rate: { min: 0.1, max: 8 },
};

// Most disks the box (100 x 100 units) can start with at a given radius.
export function capacity(radius, width = 100, height = 100) {
  return Math.floor(width / (2 * radius)) * Math.floor(height / (2 * radius));
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
  if (raw.trace !== undefined) s.trace = raw.trace === true || raw.trace === '1' || raw.trace === 'true';
  s.n = Math.min(s.n, capacity(s.radius));
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
