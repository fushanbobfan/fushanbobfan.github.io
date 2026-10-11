// The run lives in the URL hash: rule, starting ants, step count and speed.
// The simulation is deterministic, so a link replays to the exact same grid.

import { parseRule } from './rules.js';

export const SPEEDS = [4, 15, 60, 250, 1000, 4000, 15000, 60000, 250000, 1000000, 4000000];
export const MAX_ANTS = 16;
export const MAX_COORD = 1000;
export const MAX_STEPS = 20_000_000;

export const DEFAULTS = Object.freeze({
  rule: 'RL',
  ants: [{ x: 0, y: 0, dir: 0 }],
  steps: 0,
  speed: 4,
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const int = (s) => (/^-?\d+$/.test(s ?? '') ? Number(s) : NaN);

export function encodeAnts(ants) {
  return ants.map((a) => `${a.x},${a.y},${a.dir}`).join(';');
}

export function encodeState(s) {
  const p = new URLSearchParams();
  if (s.rule !== DEFAULTS.rule) p.set('r', s.rule);
  const ants = encodeAnts(s.ants);
  if (ants !== encodeAnts(DEFAULTS.ants)) p.set('a', ants);
  if (s.steps) p.set('s', String(s.steps));
  if (s.speed !== DEFAULTS.speed) p.set('v', String(s.speed));
  return p.toString();
}

export function decodeAnts(text) {
  if (text === '') return [];
  const ants = [];
  for (const part of String(text).split(';').slice(0, MAX_ANTS)) {
    const nums = part.split(',').map(int);
    if (nums.length !== 3 || nums.some(Number.isNaN)) return null;
    const [x, y, dir] = nums;
    ants.push({ x: clamp(x, -MAX_COORD, MAX_COORD), y: clamp(y, -MAX_COORD, MAX_COORD), dir: ((dir % 4) + 4) % 4 });
  }
  return ants;
}

export function decodeState(hash) {
  const p = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const out = { ...DEFAULTS, ants: DEFAULTS.ants.map((a) => ({ ...a })) };
  const parsed = p.has('r') ? parseRule(p.get('r')) : null;
  if (parsed?.ok) out.rule = parsed.rule.text;
  if (p.has('a')) {
    const ants = decodeAnts(p.get('a'));
    if (ants) out.ants = ants;
  }
  const steps = int(p.get('s'));
  if (!Number.isNaN(steps)) out.steps = clamp(steps, 0, MAX_STEPS);
  const speed = int(p.get('v'));
  if (!Number.isNaN(speed)) out.speed = clamp(speed, 0, SPEEDS.length - 1);
  return out;
}
