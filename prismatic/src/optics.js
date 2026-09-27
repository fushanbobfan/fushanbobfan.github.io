// Surface optics: reflection, Snell refraction, Fresnel reflectance and
// dispersive glasses described by Cauchy's two-term equation.

import { add, dot, scale } from './geometry.js';

// Cauchy coefficients n(λ) = A + B / λ², λ in micrometres. Values from the
// standard table reproduced on Wikipedia's "Cauchy's equation" page.
export const MATERIALS = {
  silica: { name: 'Fused silica', A: 1.458, B: 0.00354 },
  bk7: { name: 'Crown glass (BK7)', A: 1.5046, B: 0.0042 },
  baf10: { name: 'Barium flint (BaF10)', A: 1.67, B: 0.00743 },
  sf10: { name: 'Dense flint (SF10)', A: 1.728, B: 0.01342 },
};

export function refractiveIndex(material, wavelengthNm) {
  const um = wavelengthNm / 1000;
  return material.A + material.B / (um * um);
}

// Mirror a direction about a surface normal.
export function reflect(d, n) {
  return add(d, scale(n, -2 * dot(d, n)));
}

// Refract unit direction d through a surface whose unit normal n faces the
// incoming ray (dot(d, n) < 0), going from index n1 into n2. Returns null on
// total internal reflection.
export function refract(d, n, n1, n2) {
  const cosi = -dot(d, n);
  const eta = n1 / n2;
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null;
  return add(scale(d, eta), scale(n, eta * cosi - Math.sqrt(k)));
}

// Fraction of unpolarised light reflected at the surface, from the Fresnel
// equations. cosi is the cosine of the angle of incidence.
export function fresnel(cosi, n1, n2) {
  const sint = (n1 / n2) * Math.sqrt(Math.max(0, 1 - cosi * cosi));
  if (sint >= 1) return 1;
  const cost = Math.sqrt(1 - sint * sint);
  const rs = (n1 * cosi - n2 * cost) / (n1 * cosi + n2 * cost);
  const rp = (n2 * cosi - n1 * cost) / (n2 * cosi + n1 * cost);
  return (rs * rs + rp * rp) / 2;
}

export function criticalAngle(n1, n2) {
  return n1 > n2 ? Math.asin(n2 / n1) : null;
}

// Fraunhofer lines used to quote dispersion: helium d, hydrogen F and C.
export const LINES = { d: 587.6, F: 486.1, C: 656.3 };

// Abbe number V = (n_d - 1) / (n_F - n_C). Low V means strong dispersion.
export function abbeNumber(material) {
  const n = (wl) => refractiveIndex(material, wl);
  return (n(LINES.d) - 1) / (n(LINES.F) - n(LINES.C));
}
