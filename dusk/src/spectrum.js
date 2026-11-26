// Wavelength samples, sunlight above the air, and the path from a spectrum to a screen colour.

import { CIE_1931, CIE_START, CIE_STEP } from './cie1931.js';

export const WAVELENGTHS = Array.from({ length: 21 }, (_, i) => 380 + 20 * i); // nm
export const STEP_NM = 20;

const H = 6.62607015e-34;
const C = 2.99792458e8;
const K = 1.380649e-23;

// Spectral radiance of a black body, per metre of wavelength (Planck's law).
export function planck(nm, kelvin) {
  const l = nm * 1e-9;
  return (2 * H * C * C) / (l ** 5 * Math.expm1((H * C) / (l * K * kelvin)));
}

// Sunlight above the atmosphere modelled as a 5778 K black body, scaled to 1 at 550 nm.
export const SUN_KELVIN = 5778;
export const SUN = WAVELENGTHS.map((nm) => planck(nm, SUN_KELVIN) / planck(550, SUN_KELVIN));

// CIE 1931 2-degree colour matching functions, from the CIE's table, interpolated linearly.
export function cmf(nm) {
  const f = (nm - CIE_START) / CIE_STEP;
  const last = CIE_1931.length - 1;
  if (f < 0 || f > last) return [0, 0, 0];
  if (f === last) return CIE_1931[last].slice();
  const i = Math.floor(f);
  const t = f - i;
  return CIE_1931[i].map((v, k) => v * (1 - t) + CIE_1931[i + 1][k] * t);
}

// Each 20 nm sample stands for the band around it: the table's rows at nm - 10, nm and nm + 10
// weighted 1/4, 1/2, 1/4 (the trapezoid rule over the band).
const CMF = WAVELENGTHS.map((nm) => {
  const [a, b, c] = [cmf(nm - 10), cmf(nm), cmf(nm + 10)];
  return a.map((v, k) => 0.25 * v + 0.5 * b[k] + 0.25 * c[k]);
});

export function toXYZ(spec) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < spec.length; i++) {
    x += spec[i] * CMF[i][0];
    y += spec[i] * CMF[i][1];
    z += spec[i] * CMF[i][2];
  }
  return [x * STEP_NM, y * STEP_NM, z * STEP_NM];
}

// CIE XYZ to linear sRGB (D65 primaries).
export function xyzToLinear([x, y, z]) {
  return [
    3.2406 * x - 1.5372 * y - 0.4986 * z,
    -0.9689 * x + 1.8758 * y + 0.0415 * z,
    0.0557 * x - 0.2040 * y + 1.0570 * z,
  ];
}

// White balance: the sun seen from above the air is drawn neutral, as the eye adapts to daylight.
const SUN_RGB = xyzToLinear(toXYZ(SUN));
const SUN_Y = toXYZ(SUN)[1];
export const BALANCE = SUN_RGB.map((c) => SUN_Y / c);

// Photometric brightness of a spectrum, in units of the sunlight above the air (whose Y is 1).
export function brightnessY(spec) {
  return toXYZ(spec)[1] / SUN_Y;
}

// A spectrum (in units of the sunlight above the air) to white-balanced linear RGB for display.
export function spectrumToRGB(spec) {
  const lin = xyzToLinear(toXYZ(spec));
  return [lin[0] * BALANCE[0] / SUN_Y, lin[1] * BALANCE[1] / SUN_Y, lin[2] * BALANCE[2] / SUN_Y];
}

export function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function encode(c) {
  const v = Math.min(1, Math.max(0, c));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

// Exposure-scaled linear RGB to 8-bit sRGB; bright light rolls off towards white as in a photograph.
export function toDisplay(rgb, exposure) {
  return rgb.map((c) => Math.round(255 * encode(1 - Math.exp(-Math.max(0, c) * exposure))));
}

// A colour with its brightness taken away: the brightest channel set to 1.
export function hue(rgb) {
  const m = Math.max(...rgb);
  if (!(m > 0)) return [0, 0, 0];
  return rgb.map((c) => Math.round(255 * encode(Math.max(0, c) / m)));
}

export function hex([r, g, b]) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
