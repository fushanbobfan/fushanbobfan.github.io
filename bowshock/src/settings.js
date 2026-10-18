// Page settings and their share-link form. Only values that differ from the
// defaults are written, and anything read back is clamped to its range.

import { PATHS } from './path.js';

export const DEFAULTS = Object.freeze({
  path: 'line',
  mach: 0.6,
  rate: 2.5,
  lx: 0.5,
  ly: 0.2,
  cone: true,
  tint: true,
});

export const PRESETS = Object.freeze({
  passing: { label: 'Passing car', path: 'line', mach: 0.4 },
  barrier: { label: 'At the sound barrier', path: 'line', mach: 1 },
  jet: { label: 'Supersonic jet', path: 'line', mach: 1.8 },
  circling: { label: 'Circling', path: 'circle', mach: 0.6 },
  whirl: { label: 'Circling faster than sound', path: 'circle', mach: 1.3 },
});

const NUMBERS = {
  mach: { min: 0, max: 2.5 },
  rate: { min: 0.5, max: 6 },
  lx: { min: 0, max: 1 },
  ly: { min: 0, max: 1 },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function encode(settings) {
  const params = new URLSearchParams();
  for (const [key, def] of Object.entries(DEFAULTS)) {
    const v = settings[key];
    if (v === undefined || v === def) continue;
    if (typeof def === 'boolean') params.set(key, v ? '1' : '0');
    else if (typeof def === 'number') params.set(key, String(Math.round(v * 1000) / 1000));
    else params.set(key, String(v));
  }
  return params.toString();
}

export function decode(text) {
  const params = new URLSearchParams(text.replace(/^[#?]/, ''));
  const out = { ...DEFAULTS };
  for (const [key, def] of Object.entries(DEFAULTS)) {
    if (!params.has(key)) continue;
    const raw = params.get(key);
    if (typeof def === 'boolean') {
      out[key] = raw === '1' || raw === 'true';
    } else if (typeof def === 'number') {
      const v = Number(raw);
      if (Number.isFinite(v)) out[key] = clamp(v, NUMBERS[key].min, NUMBERS[key].max);
    } else if (key === 'path' && PATHS.includes(raw)) {
      out.path = raw;
    }
  }
  return out;
}
