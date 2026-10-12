// Share links: everything needed to replay a run lives in the URL hash.
// Only values that differ from the defaults are written, so links stay short.

import { DEFAULTS, normalizeSettings } from './sim.js';
import { PALETTES } from './render.js';

const KEYS = {
  w: 'width',
  h: 'height',
  n: 'population',
  l: 'layout',
  sa: 'sensorAngle',
  so: 'sensorDistance',
  ra: 'turnAngle',
  ss: 'stepSize',
  dep: 'depositAmount',
  dec: 'decay',
  sp: 'spread',
  fs: 'foodStrength',
  col: 'colonies',
  rp: 'repel',
  wr: 'wrap',
  s: 'seed',
};

export const VIEW_DEFAULTS = { palette: 'slime', exposure: 1 };

// A carved maze travels as its recipe (mz=seed.corridor.thickness.loops in
// hundredths); hand-painted walls travel as a run-length code (wl=...).
export function encodeState({ settings, foods = [], view = VIEW_DEFAULTS, maze = null, walls = '' }) {
  const parts = [];
  for (const [short, key] of Object.entries(KEYS)) {
    const v = settings[key];
    if (v === DEFAULTS[key]) continue;
    parts.push(`${short}=${typeof v === 'boolean' ? (v ? 1 : 0) : encodeURIComponent(v)}`);
  }
  if (foods.length) parts.push(`f=${foods.map((p) => `${Math.round(p.x)}.${Math.round(p.y)}`).join('_')}`);
  if (maze) {
    parts.push(`mz=${maze.seed}.${maze.corridor}.${maze.thickness}.${Math.round(maze.loops * 100)}`);
  } else if (walls) {
    parts.push(`wl=${walls}`);
  }
  if (view.palette !== VIEW_DEFAULTS.palette) parts.push(`pal=${view.palette}`);
  if (view.exposure !== VIEW_DEFAULTS.exposure) parts.push(`ex=${view.exposure}`);
  return parts.join('&');
}

export function decodeState(hash) {
  const params = new URLSearchParams(String(hash).replace(/^#/, ''));
  const raw = {};
  for (const [short, key] of Object.entries(KEYS)) {
    if (!params.has(short)) continue;
    const v = params.get(short);
    if (key === 'wrap') raw.wrap = v === '1';
    else if (key === 'layout') raw.layout = v;
    else raw[key] = Number(v);
  }
  const settings = normalizeSettings(raw);

  const foods = [];
  for (const pair of (params.get('f') || '').split('_')) {
    const m = /^(-?\d+)\.(-?\d+)$/.exec(pair);
    if (!m) continue;
    const x = Number(m[1]);
    const y = Number(m[2]);
    if (x >= 0 && y >= 0 && x < settings.width && y < settings.height) foods.push({ x, y });
  }

  const pal = params.get('pal');
  const ex = Number(params.get('ex'));
  const view = {
    palette: pal && PALETTES[pal] ? pal : VIEW_DEFAULTS.palette,
    exposure: Number.isFinite(ex) && ex > 0 ? Math.min(ex, 8) : VIEW_DEFAULTS.exposure,
  };
  let maze = null;
  const mz = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(params.get('mz') || '');
  if (mz) {
    maze = {
      seed: Number(mz[1]) >>> 0,
      corridor: Math.min(Math.max(Number(mz[2]), 2), 60),
      thickness: Math.min(Math.max(Number(mz[3]), 1), 20),
      loops: Math.min(Number(mz[4]), 100) / 100,
    };
  }
  const walls = maze ? '' : (params.get('wl') || '').replace(/[^0-9a-z-]/g, '');
  return { settings, foods, view, maze, walls };
}
