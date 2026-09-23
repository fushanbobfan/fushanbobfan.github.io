// Named starting designs. Frequencies sit just off small whole-number
// ratios: an exact ratio retraces one closed figure, and the slight detune
// is what makes the figure rotate slowly as it shrinks.

import { normalizeDesign } from './harmonograph.js';

const HALF_PI = Math.PI / 2;

const RAW = [
  {
    id: 'spiral-rose',
    name: 'Spiral rose',
    description: 'Two near-unison swings a quarter turn apart wind into a tightening spiral.',
    pendulums: [
      { axis: 'x', amp: 0.6, freq: 2, phase: HALF_PI, damp: 0.03 },
      { axis: 'x', amp: 0.1, freq: 6.01, phase: 0, damp: 0.05 },
      { axis: 'y', amp: 0.6, freq: 2.006, phase: 0, damp: 0.03 },
      { axis: 'y', amp: 0.1, freq: 5.99, phase: HALF_PI, damp: 0.05 },
    ],
  },
  {
    id: 'lissajous-3-2',
    name: 'Lissajous 3:2',
    description: 'A classic 3:2 knot that drifts because the ratio is not quite exact.',
    pendulums: [
      { axis: 'x', amp: 0.6, freq: 3.003, phase: HALF_PI, damp: 0.02 },
      { axis: 'y', amp: 0.6, freq: 2, phase: 0, damp: 0.02 },
    ],
  },
  {
    id: 'butterfly',
    name: 'Butterfly',
    description: 'A 1:2 figure-eight with a faster third swing layered on the horizontal.',
    pendulums: [
      { axis: 'x', amp: 0.55, freq: 1, phase: 0, damp: 0.02 },
      { axis: 'x', amp: 0.15, freq: 4.003, phase: 0.6, damp: 0.04 },
      { axis: 'y', amp: 0.55, freq: 2.002, phase: HALF_PI, damp: 0.02 },
    ],
  },
  {
    id: 'rotary-bloom',
    name: 'Rotary bloom',
    description: 'A rotary table under a single swinging pen produces nested loops like a spirograph.',
    pendulums: [
      { axis: 'rotary', amp: 0.45, freq: 0.5, phase: 0, damp: 0.02 },
      { axis: 'x', amp: 0.4, freq: 3.001, phase: 0, damp: 0.025 },
      { axis: 'y', amp: 0.4, freq: 3, phase: HALF_PI, damp: 0.025 },
    ],
  },
  {
    id: 'woven-ribbon',
    name: 'Woven ribbon',
    description: 'A 4:5 ratio weaves a dense ribbon that fades inward.',
    pendulums: [
      { axis: 'x', amp: 0.6, freq: 4, phase: 0.3, damp: 0.025 },
      { axis: 'y', amp: 0.6, freq: 5.004, phase: 0, damp: 0.025 },
    ],
  },
  {
    id: 'undamped-knot',
    name: 'Undamped knot',
    description: 'With no friction and exact 5:4 frequencies the pen repeats one closed curve forever.',
    pendulums: [
      { axis: 'x', amp: 0.6, freq: 5, phase: HALF_PI, damp: 0 },
      { axis: 'y', amp: 0.6, freq: 4, phase: 0, damp: 0 },
    ],
  },
];

export const PRESETS = RAW.map((p) => ({ ...p, design: normalizeDesign(p) }));

export function findPreset(id) {
  return PRESETS.find((p) => p.id === id) ?? null;
}

// Small deterministic PRNG so a seed always reproduces the same design.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_FREQS = [1, 2, 3, 4, 5, 6];

// A random design that still looks like a harmonograph drawing: base
// frequencies from small integers, a tiny detune, gentle damping, and
// amplitudes that keep the figure inside the unit square.
export function randomDesign(seed) {
  const rand = mulberry32(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const detune = () => (rand() - 0.5) * 0.02;
  const pendulums = [];
  const addAxis = (axis) => {
    pendulums.push({
      axis,
      amp: 0.25 + rand() * 0.3,
      freq: pick(BASE_FREQS) + detune(),
      phase: (rand() * 2 - 1) * Math.PI,
      damp: 0.012 + rand() * 0.024,
    });
  };
  addAxis('x');
  addAxis('y');
  if (rand() < 0.7) addAxis('x');
  if (rand() < 0.7) addAxis('y');
  if (rand() < 0.35) {
    pendulums.push({
      axis: 'rotary',
      amp: 0.1 + rand() * 0.25,
      freq: 0.25 + rand() * 1.25,
      phase: 0,
      damp: 0.012 + rand() * 0.024,
    });
  }
  return normalizeDesign({ pendulums });
}
