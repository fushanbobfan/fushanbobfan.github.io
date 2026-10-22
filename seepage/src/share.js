// Settings <-> URL hash, so a grid can be shared exactly. Anything unknown or out of
// range falls back to the default or is clamped.

import { MAX_SIZE, MIN_SIZE, MODES } from './lattice.js';
import { COLOURINGS, PALETTES } from './render.js';

export const SIZES = [32, 64, 128, 256, 512];

export const DEFAULTS = {
  mode: 'site',
  size: 128,
  p: 0.55,
  seed: 1,
  colouring: 'clusters',
  palette: 'ink',
};

const KEYS = { mode: 'm', size: 'n', p: 'p', seed: 's', colouring: 'c', palette: 'k' };

export function normalise(input) {
  const s = { ...DEFAULTS };
  if (MODES.includes(input.mode)) s.mode = input.mode;
  const size = Number(input.size);
  if (Number.isFinite(size)) {
    const clamped = Math.min(MAX_SIZE, Math.max(MIN_SIZE, size));
    s.size = SIZES.reduce((best, v) => (Math.abs(v - clamped) < Math.abs(best - clamped) ? v : best), SIZES[0]);
  }
  const p = Number(input.p);
  if (Number.isFinite(p)) s.p = Math.round(Math.min(1, Math.max(0, p)) * 1000) / 1000;
  const seed = Number(input.seed);
  if (Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32) s.seed = seed;
  if (COLOURINGS.includes(input.colouring)) s.colouring = input.colouring;
  if (Object.hasOwn(PALETTES, input.palette)) s.palette = input.palette;
  return s;
}

export function encode(settings) {
  const s = normalise(settings);
  const params = new URLSearchParams();
  for (const [name, key] of Object.entries(KEYS)) {
    if (s[name] !== DEFAULTS[name]) params.set(key, String(s[name]));
  }
  return params.toString();
}

export function decode(hash) {
  const params = new URLSearchParams(String(hash).replace(/^#/, ''));
  const raw = {};
  for (const [name, key] of Object.entries(KEYS)) {
    if (params.has(key)) raw[name] = params.get(key);
  }
  return normalise(raw);
}
