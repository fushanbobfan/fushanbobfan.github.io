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

// Ozone absorption cross-sections in m^2 per molecule, 10 nm bins from 360 nm: IUP Bremen
// measurements at 233 K (Serdyuchenko et al. 2014), averaged over each bin by E. Bruneton,
// precomputed_atmospheric_scattering, demo.cc. Copyright (c) 2017 Eric Bruneton, BSD 3-clause
// licence; see THIRD-PARTY.md.
const OZONE_BINS = [
  1.18e-27, 2.182e-28, 2.818e-28, 6.636e-28, 1.527e-27, 2.763e-27, 5.52e-27,
  8.451e-27, 1.582e-26, 2.316e-26, 3.669e-26, 4.924e-26, 7.752e-26, 9.016e-26,
  1.48e-25, 1.602e-25, 2.139e-25, 2.755e-25, 3.091e-25, 3.5e-25, 4.266e-25,
  4.672e-25, 4.398e-25, 4.701e-25, 5.019e-25, 4.305e-25, 3.74e-25, 3.215e-25,
  2.662e-25, 2.238e-25, 1.852e-25, 1.473e-25, 1.209e-25, 9.423e-26, 7.455e-26,
  6.566e-26, 5.105e-26, 4.15e-26, 4.228e-26, 3.237e-26, 2.451e-26, 2.801e-26,
  2.534e-26, 1.624e-26, 1.465e-26, 2.078e-26, 1.383e-26, 7.105e-27,
];

// Cross-section for a sample standing for nm - 10 .. nm + 10: the two bins it covers.
export function ozoneCrossSection(nm) {
  const i = Math.round((nm - 370) / 10);
  return (OZONE_BINS[i] + OZONE_BINS[i + 1]) / 2;
}

// Ozone rises linearly from 10 km to a peak at 25 km and falls to nothing at 40 km; the layer is
// as thick as 15 km of peak-density ozone, which holds 300 Dobson units.
export const DOBSON = 2.687e20; // molecules per m^2
export const OZONE_PEAK = (300 * DOBSON) / 15000; // molecules per m^3
export function ozoneDensity(height) {
  if (height <= 10000 || height >= 40000) return 0;
  return height < 25000 ? (height - 10000) / 15000 : (40000 - height) / 15000;
}

// Coefficients for every sampled wavelength, for one haze amount (ozone scaled by `ozone`, 0..1).
export function coefficients(tau, ozone = 1) {
  const rayleigh = WAVELENGTHS.map(rayleighCoefficient);
  const haze = WAVELENGTHS.map((nm) => hazeCoefficient(nm, tau));
  const ozoneAbsorption = WAVELENGTHS.map((nm) => ozone * OZONE_PEAK * ozoneCrossSection(nm));
  return { rayleigh, haze, hazeExtinction: haze.map((b) => b / HAZE_ALBEDO), ozoneAbsorption };
}
