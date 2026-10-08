// Board settings in the URL hash, so a link reopens the same board.

import { MAX_ROWS, MIN_ROWS } from './board.js';

export const DEFAULTS = Object.freeze({
  rows: 12,
  p: 0.5,
  seed: 1,
  exact: true,
  normal: true,
});

const KEYS = { rows: 'n', p: 'p', seed: 's', exact: 'e', normal: 'g' };

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

export function normalise(input) {
  const s = { ...DEFAULTS };
  const rows = Math.round(Number(input.rows));
  if (input.rows !== '' && Number.isFinite(rows)) s.rows = clamp(rows, MIN_ROWS, MAX_ROWS);
  const p = Number(input.p);
  if (input.p !== undefined && input.p !== '' && Number.isFinite(p)) s.p = Math.round(clamp(p, 0, 1) * 100) / 100;
  const seed = Number(input.seed);
  if (Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32) s.seed = seed;
  for (const key of ['exact', 'normal']) {
    if (input[key] === true || input[key] === '1') s[key] = true;
    else if (input[key] === false || input[key] === '0') s[key] = false;
  }
  return s;
}

export function encode(settings) {
  const s = normalise(settings);
  const params = new URLSearchParams();
  for (const [name, key] of Object.entries(KEYS)) {
    if (s[name] === DEFAULTS[name]) continue;
    const v = s[name];
    params.set(key, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return params.toString();
}

export function decode(hash) {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const raw = {};
  for (const [name, key] of Object.entries(KEYS)) {
    if (params.has(key)) raw[name] = params.get(key);
  }
  return normalise(raw);
}
