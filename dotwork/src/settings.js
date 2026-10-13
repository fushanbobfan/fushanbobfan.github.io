// Every setting the page can share, with its range, plus the link format.
// A link carries only what differs from the defaults; an uploaded photo never
// leaves the browser, so links always name a built-in picture.

import { SOURCE_IDS } from './sources.js';
import { DOT_MODES } from './dots.js';

export const VIEWS = ['dots', 'cells', 'line', 'picture'];
export const PALETTES = {
  ink: { label: 'Ink on paper', ink: '#1d1b18', paper: '#f6f1e7' },
  chalk: { label: 'Chalk on slate', ink: '#eceae4', paper: '#1f2428' },
  sepia: { label: 'Sepia', ink: '#4a2c17', paper: '#efe0c4' },
  blueprint: { label: 'Blueprint', ink: '#e8f1ff', paper: '#1d4f8f' },
  // Dots take the picture's colours; grey pictures fall back to `ink`.
  picture: { label: "Picture's own colours", ink: '#1d1b18', paper: '#fbf9f4', fromPicture: true },
};

const NUMBERS = {
  dots: { def: 4000, min: 100, max: 20000, int: true },
  detail: { def: 480, min: 200, max: 800, int: true },
  brightness: { def: 0, min: -0.5, max: 0.5 },
  contrast: { def: 1, min: 0.2, max: 3 },
  gamma: { def: 1, min: 0.3, max: 3 },
  floor: { def: 0.02, min: 0, max: 0.5 },
  size: { def: 1, min: 0.2, max: 3 },
  seed: { def: 1, min: 0, max: 4294967295, int: true },
};

const CHOICES = {
  picture: { def: 'sphere', of: SOURCE_IDS },
  mode: { def: 'tone', of: DOT_MODES },
  view: { def: 'dots', of: VIEWS },
  palette: { def: 'ink', of: Object.keys(PALETTES) },
};

const FLAGS = { invert: false };

export function defaults() {
  const s = {};
  for (const [k, v] of Object.entries(NUMBERS)) s[k] = v.def;
  for (const [k, v] of Object.entries(CHOICES)) s[k] = v.def;
  for (const [k, v] of Object.entries(FLAGS)) s[k] = v;
  return s;
}

export function clampSetting(key, value) {
  const spec = NUMBERS[key];
  if (!spec) return value;
  let v = Math.min(spec.max, Math.max(spec.min, Number(value)));
  if (spec.int) v = Math.round(v);
  return v;
}

export function encodeSettings(s) {
  const d = defaults();
  const q = new URLSearchParams();
  for (const k of Object.keys(NUMBERS)) if (s[k] !== d[k]) q.set(k, String(+Number(s[k]).toFixed(4)));
  for (const k of Object.keys(CHOICES)) if (s[k] !== d[k]) q.set(k, s[k]);
  for (const k of Object.keys(FLAGS)) if (s[k] !== d[k]) q.set(k, s[k] ? '1' : '0');
  return q.toString();
}

// Unknown keys and out-of-range values are ignored or clamped, never trusted.
export function decodeSettings(query) {
  const q = new URLSearchParams(query);
  const s = defaults();
  for (const k of Object.keys(NUMBERS)) {
    if (!q.has(k)) continue;
    const v = Number(q.get(k));
    if (Number.isFinite(v)) s[k] = clampSetting(k, v);
  }
  for (const [k, spec] of Object.entries(CHOICES)) {
    const v = q.get(k);
    if (v !== null && spec.of.includes(v)) s[k] = v;
  }
  for (const k of Object.keys(FLAGS)) {
    const v = q.get(k);
    if (v === '1' || v === '0') s[k] = v === '1';
  }
  return s;
}

export function settingRange(key) {
  const spec = NUMBERS[key];
  return spec ? { min: spec.min, max: spec.max } : null;
}
