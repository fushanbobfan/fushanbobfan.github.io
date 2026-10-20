// Page settings and their share-link form (the URL hash).

import { PALETTES, VIEWS } from './render.js';
import { parseRings, formatRings } from './rules.js';
import { SPECIES } from './species.js';

export const SIZES = [128, 256, 512];
export const STARTS = ['species', 'soup'];

export const DEFAULTS = Object.freeze({
  start: 'species',
  species: 'orbium',
  scale: 2,
  size: 256,
  R: 26,
  T: 10,
  mu: 0.15,
  sigma: 0.015,
  rings: '1',
  seed: 1,
  view: 'cells',
  palette: 'ember',
});

const num = (v, lo, hi, fallback) => {
  const x = Number(v);
  return Number.isFinite(x) && x >= lo && x <= hi ? x : fallback;
};

const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);

// Accepts any partial object (for example from a URL) and returns complete,
// in-range settings. Unknown or broken values fall back to the defaults.
export function normalize(raw = {}) {
  const s = { ...DEFAULTS };
  s.start = pick(raw.start, STARTS, s.start);
  s.species = pick(raw.species, SPECIES.map((x) => x.id), s.species);
  s.scale = Math.round(num(raw.scale, 1, 4, s.scale));
  s.size = Number(pick(Number(raw.size), SIZES, s.size));
  s.R = Math.round(num(raw.R, 2, 64, s.R));
  s.T = Math.round(num(raw.T, 1, 1000, s.T));
  s.mu = num(raw.mu, 0.001, 0.999, s.mu);
  s.sigma = num(raw.sigma, 0.0001, 0.999, s.sigma);
  try {
    s.rings = formatRings(parseRings(raw.rings ?? s.rings));
  } catch {
    s.rings = DEFAULTS.rings;
  }
  s.seed = Math.round(num(raw.seed, 0, 2 ** 31 - 1, s.seed));
  s.view = pick(raw.view, VIEWS, s.view);
  s.palette = pick(raw.palette, Object.keys(PALETTES), s.palette);
  return s;
}

// Rounds floats so links stay short and survive a round trip unchanged.
const short = (x) => String(Number(x.toPrecision(6)));

export function toHash(settings) {
  const s = normalize(settings);
  const p = new URLSearchParams();
  for (const key of Object.keys(DEFAULTS)) {
    const v = typeof s[key] === 'number' ? short(s[key]) : s[key];
    p.set(key, v);
  }
  return '#' + p.toString();
}

export function fromHash(hash) {
  const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const raw = {};
  for (const [k, v] of p) raw[k] = v;
  return normalize(raw);
}

// The rule object a World needs from the settings.
export function ruleOf(settings) {
  return { R: settings.R, T: settings.T, mu: settings.mu, sigma: settings.sigma, rings: parseRings(settings.rings) };
}
