// The air: how much light each kind of particle scatters, and how the particles thin out with height.

import { WAVELENGTHS } from './spectrum.js';

export const EARTH_RADIUS = 6371e3; // m
export const TOP = 100e3; // height where the model atmosphere ends, m
export const RAYLEIGH_HEIGHT = 8.4e3; // scale height of the air molecules, m (gives sea-level pressure)
export const HAZE_HEIGHT = 1.2e3; // scale height of the haze particles, m
export const HAZE_ALBEDO = 0.9; // share of the light a haze particle meets that it scatters
export const HAZE_ANISOTROPY = 0.76; // Henyey-Greenstein g: haze throws light mostly forwards
export const ANGSTROM = 1.3; // haze scattering falls as wavelength^-1.3

const LOSCHMIDT = 2.546899e25; // molecules per m^3 at 15 C and 1013.25 hPa
const KING = 1.061; // depolarisation correction of the air molecules

// Refractive index of standard dry air (Ciddor 1996).
export function airIndex(nm) {
  const s2 = (1000 / nm) ** 2;
  return 1 + 1e-8 * (5792105 / (238.0185 - s2) + 167917 / (57.362 - s2));
}

// Rayleigh scattering coefficient of sea-level air, per metre.
export function rayleighCoefficient(nm) {
  const n = airIndex(nm);
  const l = nm * 1e-9;
  return ((8 * Math.PI ** 3 * (n * n - 1) ** 2) / (3 * LOSCHMIDT * l ** 4)) * KING;
}

// Haze scattering coefficient at sea level, per metre, for a vertical optical depth tau at 550 nm.
export function hazeCoefficient(nm, tau) {
  return (tau / HAZE_HEIGHT) * (nm / 550) ** -ANGSTROM;
}

export function density(height, scale) {
  return Math.exp(-Math.max(0, height) / scale);
}

// Phase functions: the share of scattered light thrown per steradian at angle theta (cos = mu).
export function rayleighPhase(mu) {
  return (3 / (16 * Math.PI)) * (1 + mu * mu);
}
export function hazePhase(mu, g = HAZE_ANISOTROPY) {
  return (1 - g * g) / (4 * Math.PI * (1 + g * g - 2 * g * mu) ** 1.5);
}

// Coefficients for every sampled wavelength, for one haze amount.
export function coefficients(tau) {
  const rayleigh = WAVELENGTHS.map(rayleighCoefficient);
  const haze = WAVELENGTHS.map((nm) => hazeCoefficient(nm, tau));
  return { rayleigh, haze, hazeExtinction: haze.map((b) => b / HAZE_ALBEDO) };
}
