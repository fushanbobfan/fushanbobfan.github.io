// D2Q9 lattice Boltzmann core. Distributions are stored direction by
// direction: f[i * n + cell], with cell = y * nx + x.

// Direction 0 is rest; 1-4 are the axis neighbours (E, N, W, S); 5-8 the
// diagonals (NE, NW, SW, SE). y grows downwards on screen, which does not
// matter to the lattice.
export const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
export const EY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
export const W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
export const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];

// Second-order equilibrium for density rho and velocity (ux, uy), with the
// lattice speed of sound 1/sqrt(3).
export function equilibrium(i, rho, ux, uy) {
  const eu = EX[i] * ux + EY[i] * uy;
  const uu = ux * ux + uy * uy;
  return W[i] * rho * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * uu);
}
