// From spectra to screen colours: the CIE 1931 colour-matching functions in
// the multi-lobe Gaussian fit of Wyman, Sloan and Shirley (2013), a 5778 K
// blackbody for sunlight, and the sRGB primaries.

import { WAVELENGTHS } from './water.js';

function lobe(l, mu, s1, s2) {
  const t = (l - mu) / (l < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
}

export function cmf(l) {
  return [
    1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2),
    0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1),
    1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8),
  ];
}

export function xyzToLinear([x, y, z]) {
  return [
    3.2406 * x - 1.5372 * y - 0.4986 * z,
    -0.9689 * x + 1.8758 * y + 0.0415 * z,
    0.0557 * x - 0.204 * y + 1.057 * z,
  ];
}

// Planck's law up to a constant, wavelength in nm.
export function planck(l, T) {
  const m = l * 1e-9;
  return 1 / (m ** 5 * (Math.exp(0.0143877688 / (m * T)) - 1));
}

const SUN = WAVELENGTHS.map((l) => planck(l, 5778));
const SUN_PEAK = Math.max(...SUN);
export const SUNLIGHT = SUN.map((v) => v / SUN_PEAK);

// Linear RGB of each wavelength under sunlight, scaled so that the whole
// unfiltered sun comes out as white (1, 1, 1).
const RAW = WAVELENGTHS.map((l, k) => xyzToLinear(cmf(l)).map((c) => c * SUNLIGHT[k]));
const WHITE = [0, 1, 2].map((c) => RAW.reduce((sum, v) => sum + v[c], 0));
export const SPECTRAL_RGB = RAW.map((v) => v.map((c, j) => c / WHITE[j]));

// Linear RGB of light whose spectrum, relative to sunlight, is given per
// entry of WAVELENGTHS.
export function spectrumToLinear(weights) {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let k = 0; k < weights.length; k++) {
    const w = weights[k];
    if (!w) continue;
    const c = SPECTRAL_RGB[k];
    r += w * c[0];
    g += w * c[1];
    b += w * c[2];
  }
  return [r, g, b];
}

export function encode(c) {
  const v = Math.max(0, Math.min(1, c));
  return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
}

// A displayable colour for a single wavelength: pure spectral colours lie
// outside sRGB, so negative channels are lifted with white and the result
// is normalised to its brightest channel.
export function wavelengthColor(l) {
  const [r, g, b] = xyzToLinear(cmf(l));
  const lift = Math.max(0, -Math.min(r, g, b));
  const c = [r + lift, g + lift, b + lift];
  const m = Math.max(...c) || 1;
  return `rgb(${c.map((v) => encode(v / m)).join(', ')})`;
}
