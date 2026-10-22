// Page state and its share-link form, e.g.
//   #c=-0.12,0.74&m=-0.75,0,3.2&j=0,0,3.6&it=0&pal=ember&col=bands&int=period&den=1&off=0
// Views are stored as centre and width in the plane so a link looks the same
// on any screen. Anything missing or out of range falls back to the default.

import { PALETTES } from './palette.js';

export const DEFAULTS = {
  c: [-0.122561166876654, 0.744861766619744],
  mview: [-0.75, 0, 3.2],
  jview: [0, 0, 3.6],
  iterations: 0, // 0 = follow the zoom depth
  palette: 'ember',
  colouring: 'bands',
  interior: 'period',
  density: 1,
  offset: 0,
};

const COLOURINGS = ['bands', 'boundary'];
const INTERIORS = ['period', 'dark'];

function numbers(text, count) {
  if (typeof text !== 'string') return null;
  const parts = text.split(',');
  if (parts.length !== count) return null;
  const vals = parts.map(Number);
  return vals.every(Number.isFinite) ? vals : null;
}

function validView(v) {
  return v && Math.abs(v[0]) <= 4 && Math.abs(v[1]) <= 4 && v[2] > 1e-300 && v[2] <= 16;
}

// String() gives the shortest decimal that reads back as the same double.
const fmt = (x) => String(x);

export function encodeSettings(s) {
  const p = new URLSearchParams();
  p.set('c', s.c.map(fmt).join(','));
  p.set('m', s.mview.map(fmt).join(','));
  p.set('j', s.jview.map(fmt).join(','));
  p.set('it', String(s.iterations));
  p.set('pal', s.palette);
  p.set('col', s.colouring);
  p.set('int', s.interior);
  p.set('den', fmt(s.density));
  p.set('off', fmt(s.offset));
  return '#' + p.toString().replace(/%2C/g, ',');
}

export function decodeSettings(hash) {
  const s = structuredClone(DEFAULTS);
  const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const c = numbers(p.get('c'), 2);
  if (c && Math.hypot(c[0], c[1]) <= 4) s.c = c;
  const m = numbers(p.get('m'), 3);
  if (validView(m)) s.mview = m;
  const j = numbers(p.get('j'), 3);
  if (validView(j)) s.jview = j;
  const it = Number(p.get('it'));
  if (p.has('it') && Number.isInteger(it) && it >= 0 && it <= 100000) s.iterations = it;
  if (Object.hasOwn(PALETTES, p.get('pal'))) s.palette = p.get('pal');
  if (COLOURINGS.includes(p.get('col'))) s.colouring = p.get('col');
  if (INTERIORS.includes(p.get('int'))) s.interior = p.get('int');
  const den = Number(p.get('den'));
  if (p.has('den') && den >= 0.1 && den <= 10) s.density = den;
  const off = Number(p.get('off'));
  if (p.has('off') && off >= 0 && off <= 1) s.offset = off;
  return s;
}
