// Turning the Reynolds number the page asks for into a relaxation time.
//
// In lattice units the kinematic viscosity of BGK is nu = (tau - 1/2) / 3,
// and Re = U D / nu for inflow speed U and obstacle size D. Below about
// tau = 0.51 plain BGK goes unstable at the speeds used here, so the
// relaxation time is clamped there and the Reynolds number actually run is
// reported back.

export const TAU_MIN = 0.51;

export function relaxation(U, D, Re) {
  let nu = (U * D) / Re;
  let tau = 3 * nu + 0.5;
  let clamped = false;
  if (tau < TAU_MIN) {
    tau = TAU_MIN;
    nu = (tau - 0.5) / 3;
    clamped = true;
  }
  return { tau, omega: 1 / tau, nu, re: (U * D) / nu, clamped };
}

// The highest Reynolds number a size D at speed U can run without clamping.
export function maxReynolds(U, D) {
  return (U * D * 3) / (TAU_MIN - 0.5);
}

// Lattice Mach number: the inflow speed over the lattice sound speed.
export function mach(U) {
  return U * Math.sqrt(3);
}
