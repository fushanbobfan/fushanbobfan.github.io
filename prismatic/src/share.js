// Bench layouts as short strings for share links. Only kinds, positions,
// angles and the editable parameters travel; everything is re-validated and
// clamped on the way back in, so a hand-edited link cannot break the bench.

import { makeElement, DEFAULTS } from './elements.js';
import { PARAMS, applyParam } from './params.js';

const VERSION = 'v1';
const MAX_ELEMENTS = 200;
const round = (v) => Math.round(v * 10) / 10;

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeBench(elements) {
  const items = elements.map((el) => {
    const params = {};
    for (const spec of PARAMS[el.kind]) params[spec.key] = round(el[spec.key]);
    if (typeof el.material === 'string') params.material = el.material;
    if (typeof el.light === 'string') params.light = el.light;
    return [el.kind, round(el.x), round(el.y), round((el.angle * 180) / Math.PI), params];
  });
  return `${VERSION}.${toBase64Url(JSON.stringify(items))}`;
}

// Returns a fresh list of elements, or null if the string is not a bench.
export function decodeBench(str) {
  if (typeof str !== 'string' || !str.startsWith(`${VERSION}.`)) return null;
  let items;
  try {
    items = JSON.parse(fromBase64Url(str.slice(VERSION.length + 1)));
  } catch {
    return null;
  }
  if (!Array.isArray(items) || items.length > MAX_ELEMENTS) return null;
  const elements = [];
  for (const item of items) {
    if (!Array.isArray(item)) return null;
    const [kind, x, y, angle, params] = item;
    if (!Object.hasOwn(DEFAULTS, kind)) return null;
    if (![x, y, angle].every(Number.isFinite)) return null;
    const el = makeElement(kind, x, y);
    applyParam(el, 'angle', angle);
    if (params && typeof params === 'object') {
      for (const [key, value] of Object.entries(params)) applyParam(el, key, value);
    }
    elements.push(el);
  }
  return elements;
}
