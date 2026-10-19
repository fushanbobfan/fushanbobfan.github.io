// Turning the flow into pixels: colour maps and an RGBA image of one field
// at one pixel per lattice cell, which the page scales up.

import { vorticity, speed } from './field.js';

const lerp = (a, b, t) => a + (b - a) * t;

function ramp(stops, t) {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const k = Math.min(stops.length - 2, Math.floor(x));
  const u = x - k;
  const a = stops[k], b = stops[k + 1];
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
}

// Blue for negative, near-white at zero, red for positive; t in [-1, 1].
const DIVERGING = [
  [33, 82, 166],
  [103, 152, 214],
  [196, 216, 236],
  [246, 245, 241],
  [242, 202, 178],
  [215, 116, 86],
  [164, 32, 42],
];
export function diverging(t) {
  return ramp(DIVERGING, (t + 1) / 2);
}

// Dark to light through blue, teal and yellow; t in [0, 1].
const SEQUENTIAL = [
  [24, 18, 54],
  [44, 64, 128],
  [34, 124, 142],
  [56, 176, 120],
  [176, 214, 76],
  [252, 236, 120],
];
export function sequential(t) {
  return ramp(SEQUENTIAL, t);
}

export const OBSTACLE = [58, 63, 74];
export const WALL = [96, 88, 80];

// Relative luminance, used by the tests to check the sequential map climbs.
export function luminance([r, g, b]) {
  const lin = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Scale that maps a field to the colour range, from the free-stream speed U
// and obstacle size D so the picture looks alike across settings.
export function fieldScale(view, U, D) {
  if (view === 'curl') return (2.5 * U) / D;
  if (view === 'speed') return 1.6 * U;
  return 0.5 * U * U;
}

// Pressure coefficient of a cell: (p - p_inf) / (rho U^2 / 2) with p = rho/3.
export function pressureCoefficient(rho, U) {
  return (rho - 1) / 3 / (0.5 * U * U);
}

export function paintField(sim, view, pixels, scratch) {
  const { lat, shapeMask } = sim;
  const { n, solid, rho } = lat;
  const U = sim.settings.speed;
  const scale = fieldScale(view, U, sim.settings.size);
  let values = null;
  if (view === 'curl') values = vorticity(lat, scratch);
  else if (view === 'speed') values = speed(lat, scratch);
  for (let c = 0; c < n; c++) {
    let rgb;
    if (solid[c]) rgb = shapeMask[c] ? OBSTACLE : WALL;
    else if (view === 'curl') rgb = diverging(values[c] / scale);
    else if (view === 'speed') rgb = sequential(values[c] / scale);
    else rgb = diverging(((rho[c] - 1) / 3 / scale) * 0.8);
    const p = 4 * c;
    pixels[p] = rgb[0];
    pixels[p + 1] = rgb[1];
    pixels[p + 2] = rgb[2];
    pixels[p + 3] = 255;
  }
  return pixels;
}

// Streak colours: alternating dark and light dye so neighbouring rows stay
// apart over any of the field colours.
export function streakColour(row) {
  return row % 2 ? 'rgba(255, 255, 255, 0.85)' : 'rgba(20, 22, 30, 0.8)';
}
