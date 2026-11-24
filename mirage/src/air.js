// Air near a heated (or cooled) surface: temperature with height, and the
// refractive index that follows from it.
//
// The refractivity of air is proportional to its density (Gladstone-Dale).
// For visible light, dry air at 0 °C and 1013.25 hPa has n - 1 = 2.93e-4, so
// at pressure P and absolute temperature T:  n - 1 = 2.93e-4 * (P / P0) * (T0 / T).
// Over a few metres of height the pressure hardly changes, so only the
// temperature matters here.

export const N0_MINUS_1 = 2.93e-4;
export const T0 = 273.15;
export const P0 = 1013.25;

export function kelvin(celsius) {
  return celsius + T0;
}

// A layer of air warmed (or cooled) by the surface. The temperature relaxes
// from the surface value to the air value over a few times `layer` metres.
export function makeAir({ surface = 55, air = 30, layer = 0.1, pressure = P0 } = {}) {
  if (!(layer > 0)) throw new RangeError('layer must be positive');
  return { surface, air, layer, pressure };
}

export function temperature(a, z) {
  return a.air + (a.surface - a.air) * Math.exp(-Math.max(z, 0) / a.layer);
}

export function dTdz(a, z) {
  return (-(a.surface - a.air) / a.layer) * Math.exp(-Math.max(z, 0) / a.layer);
}

export function index(a, z) {
  return 1 + (N0_MINUS_1 * (a.pressure / P0) * T0) / kelvin(temperature(a, z));
}

export function dndz(a, z) {
  const t = kelvin(temperature(a, z));
  return ((-N0_MINUS_1 * (a.pressure / P0) * T0) / (t * t)) * dTdz(a, z);
}
