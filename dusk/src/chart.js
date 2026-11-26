// The spectrum chart: sunlight above the air, sunlight reaching you, and the light of the sky overhead.

import { WAVELENGTHS, SUN, cmf, xyzToLinear, BALANCE, hue, hex } from './spectrum.js';

export const CHART = { width: 640, height: 300, left: 44, right: 16, top: 16, bottom: 58 };
const LO = 380, HI = 780;

export function x(nm, c = CHART) {
  return c.left + ((nm - LO) / (HI - LO)) * (c.width - c.left - c.right);
}
export function y(v, c = CHART) {
  return c.top + (1 - v) * (c.height - c.top - c.bottom);
}

// The colour of light of a single wavelength, as near as the screen can show it.
export function spectralColour(nm) {
  const lin = xyzToLinear(cmf(nm)).map((v, i) => Math.max(0, v * BALANCE[i]));
  return hex(hue(lin));
}

function clamp(v) {
  return Math.min(1, Math.max(0, v));
}

export function path(values, c = CHART) {
  return values.map((v, i) => `${i ? 'L' : 'M'}${x(WAVELENGTHS[i], c).toFixed(1)},${y(clamp(v), c).toFixed(1)}`).join(' ');
}

// Curves scaled for the chart: sunlight above the air peaks at 1; the sunlight reaching you is on
// the same scale; the sky light is scaled to its own peak, since only its shape matters here.
export function curves({ transmission, sky }) {
  const top = Math.max(...SUN);
  const above = SUN.map((s) => s / top);
  const through = SUN.map((s, l) => (s * transmission[l]) / top);
  const peak = Math.max(...sky);
  const skyShape = peak > 0 ? sky.map((v) => v / peak) : sky.map(() => 0);
  return { above, through, skyShape };
}

// Wavelength (nm) where a curve peaks.
export function peakAt(values) {
  let best = -Infinity, at = WAVELENGTHS[0];
  values.forEach((v, i) => {
    if (v > best) { best = v; at = WAVELENGTHS[i]; }
  });
  return at;
}

export function chartSVG(data, c = CHART) {
  const { above, through, skyShape } = curves(data);
  const base = y(0, c);
  const parts = [`<svg viewBox="0 0 ${c.width} ${c.height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`];
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    parts.push(`<line class="grid" x1="${c.left}" x2="${c.width - c.right}" y1="${y(v, c).toFixed(1)}" y2="${y(v, c).toFixed(1)}"/>`);
  }
  // A strip of the spectrum's colours under the axis.
  for (let nm = LO; nm < HI; nm += 5) {
    const x0 = x(nm, c), x1 = x(nm + 5, c);
    parts.push(`<rect x="${x0.toFixed(1)}" y="${(base + 6).toFixed(1)}" width="${(x1 - x0 + 0.4).toFixed(1)}" height="10" fill="${spectralColour(nm + 2.5)}"/>`);
  }
  for (let nm = 400; nm <= 750; nm += 50) {
    parts.push(`<text class="tick" x="${x(nm, c).toFixed(1)}" y="${(base + 32).toFixed(1)}" text-anchor="middle">${nm}</text>`);
  }
  parts.push(`<text class="tick" x="${((c.left + c.width - c.right) / 2).toFixed(1)}" y="${(c.height - 4).toFixed(1)}" text-anchor="middle">wavelength (nm)</text>`);
  const area = `${path(through, c)} L${x(HI, c).toFixed(1)},${base.toFixed(1)} L${x(LO, c).toFixed(1)},${base.toFixed(1)} Z`;
  parts.push(`<path class="through-fill" d="${area}"/>`);
  parts.push(`<path class="above" d="${path(above, c)}"/>`);
  parts.push(`<path class="through" d="${path(through, c)}"/>`);
  parts.push(`<path class="sky" d="${path(skyShape, c)}"/>`);
  parts.push(`<line class="axis" x1="${c.left}" x2="${c.width - c.right}" y1="${base.toFixed(1)}" y2="${base.toFixed(1)}"/>`);
  parts.push('</svg>');
  return parts.join('');
}

// The chart in words, for screen readers and for the caption.
export function describeSpectrum(data) {
  const { above, through, skyShape } = curves(data);
  const kept = through.reduce((s, v) => s + v, 0) / above.reduce((s, v) => s + v, 0);
  const sentences = [];
  if (kept === 0) sentences.push('No direct sunlight reaches you.');
  else sentences.push(`The sunlight reaching you peaks at ${peakAt(through)} nm, against ${peakAt(above)} nm above the air.`);
  if (skyShape.some((v) => v > 0)) {
    const at = peakAt(skyShape);
    sentences.push(at === WAVELENGTHS[0]
      ? 'The light of the sky overhead rises all the way to the violet end of the chart.'
      : `The light of the sky overhead peaks at ${at} nm.`);
  }
  return sentences.join(' ');
}
