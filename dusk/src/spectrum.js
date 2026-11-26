// Wavelength samples, sunlight above the air, and the path from a spectrum to a screen colour.

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

// CIE 1931 2-degree colour matching functions, multi-lobe fit of Wyman, Sloan and Shirley (2013).
function lobe(x, mu, s1, s2) {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
}
export function cmf(nm) {
  return [
    1.056 * lobe(nm, 599.8, 37.9, 31.0) + 0.362 * lobe(nm, 442.0, 16.0, 26.7) - 0.065 * lobe(nm, 501.1, 20.4, 26.2),
    0.821 * lobe(nm, 568.8, 46.9, 40.5) + 0.286 * lobe(nm, 530.9, 16.3, 31.1),
    1.217 * lobe(nm, 437.0, 11.8, 36.0) + 0.681 * lobe(nm, 459.0, 26.0, 13.8),
  ];
}
const CMF = WAVELENGTHS.map(cmf);

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

// A spectrum (in units of the sunlight above the air) to balanced linear RGB with Y kept.
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
