// Everything a share link carries. Only values that differ from the defaults
// are written, so a link to the default Lorenz view is just "#".

import { SYSTEMS, SYSTEM_KEYS, defaultParams } from './systems.js';

export const GENERAL = {
  count: { value: 400, min: 1, max: 3000, int: true },
  radius: { value: 1e-4, min: 1e-9, max: 1 },
  tail: { value: 40, min: 2, max: 200, int: true },
  speed: { value: 4, min: 1, max: 40, int: true },
  seed: { value: 1, min: 0, max: 4294967295, int: true },
  yaw: { value: -0.7, min: -Math.PI, max: Math.PI },
  pitch: { value: 0.25, min: -1.56, max: 1.56 },
  zoom: { value: 1, min: 0.25, max: 12 },
};

export function defaultSettings(system = 'lorenz') {
  const s = { system, params: defaultParams(system), orbit: true };
  for (const [k, d] of Object.entries(GENERAL)) s[k] = d.value;
  return s;
}

const clamp = (v, d) => {
  const x = Math.min(d.max, Math.max(d.min, v));
  return d.int ? Math.round(x) : x;
};

// Short but exact enough: integers exactly, angles to 3 decimals, everything
// else to 6 significant digits.
function fmt(v) {
  return Number.isInteger(v) ? String(v) : String(+Number(v).toPrecision(6));
}

export function encodeSettings(s) {
  const base = defaultSettings(s.system);
  const parts = [];
  if (s.system !== 'lorenz') parts.push(`s=${s.system}`);
  for (const q of SYSTEMS[s.system].params) {
    if (s.params[q.key] !== base.params[q.key]) parts.push(`${q.key}=${fmt(s.params[q.key])}`);
  }
  for (const k of Object.keys(GENERAL)) {
    const v = k === 'yaw' || k === 'pitch' ? +s[k].toFixed(3) : s[k];
    if (v !== base[k]) parts.push(`${k}=${fmt(v)}`);
  }
  if (!s.orbit) parts.push('orbit=0');
  return parts.join('&');
}

export function decodeSettings(hash) {
  const q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const key = q.get('s');
  const s = defaultSettings(SYSTEM_KEYS.includes(key) ? key : 'lorenz');
  for (const p of SYSTEMS[s.system].params) {
    const v = Number(q.get(p.key));
    if (q.has(p.key) && Number.isFinite(v)) s.params[p.key] = Math.min(p.max, Math.max(p.min, v));
  }
  for (const [k, d] of Object.entries(GENERAL)) {
    const v = Number(q.get(k));
    if (q.has(k) && Number.isFinite(v)) s[k] = clamp(v, d);
  }
  if (q.get('orbit') === '0') s.orbit = false;
  return s;
}
