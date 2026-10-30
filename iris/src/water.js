// Refractive index of water near 20 °C as a two-term Cauchy formula,
// n(λ) = A + B / λ², fitted through n = 1.3311 at the hydrogen C line
// (656.3 nm) and n = 1.3371 at the F line (486.1 nm).

const LC = 656.3;
const LF = 486.1;
const NC = 1.3311;
const NF = 1.3371;

export const CAUCHY_B = (NF - NC) / (1 / LF ** 2 - 1 / LC ** 2);
export const CAUCHY_A = NC - CAUCHY_B / LC ** 2;

export function waterIndex(lambda) {
  return CAUCHY_A + CAUCHY_B / (lambda * lambda);
}

// Visible wavelengths in nm, used for every spectral sum.
export const WAVELENGTHS = Array.from({ length: 65 }, (_, k) => 380 + 5 * k);
