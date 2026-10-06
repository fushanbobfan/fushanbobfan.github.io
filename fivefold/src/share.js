// Settings <-> URL hash, so a tiling can be shared as a link.

import { SEEDS } from './tiling.js';
import { COLOURINGS, PALETTES } from './palettes.js';

export const MAX_GENERATIONS = 11;

export const DEFAULTS = {
  seed: 'p2-sun',
  generations: 6,
  fit: 'fill',
  zoom: 1,
  colouring: 'kind',
  palette: 'slate',
  weight: 1,
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const number = (value, fallback) => {
  const x = Number.parseFloat(value);
  return Number.isFinite(x) ? x : fallback;
};

export function normalise(state) {
  const s = { ...DEFAULTS, ...state };
  return {
    seed: pick(s.seed, Object.keys(SEEDS), DEFAULTS.seed),
    generations: Math.round(clamp(number(s.generations, DEFAULTS.generations), 0, MAX_GENERATIONS)),
    fit: pick(s.fit, ['fill', 'patch'], DEFAULTS.fit),
    zoom: clamp(number(s.zoom, DEFAULTS.zoom), 1, 8),
    colouring: pick(s.colouring, Object.keys(COLOURINGS), DEFAULTS.colouring),
    palette: pick(s.palette, Object.keys(PALETTES), DEFAULTS.palette),
    weight: clamp(number(s.weight, DEFAULTS.weight), 0, 3),
  };
}

const KEYS = { seed: 's', generations: 'g', fit: 'f', zoom: 'z', colouring: 'c', palette: 'p', weight: 'w' };

export function encode(state) {
  const s = normalise(state);
  const params = new URLSearchParams();
  for (const [name, key] of Object.entries(KEYS)) {
    if (s[name] !== DEFAULTS[name]) params.set(key, String(s[name]));
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
