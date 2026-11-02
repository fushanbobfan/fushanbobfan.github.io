// A Foucault pendulum on a turning Earth, in the small-swing limit.
//
// The bob moves in the floor plane (x east, y north, metres or any unit).
// Gravity pulls it back with ω0² = g / L, and the Coriolis force of the
// Earth's spin acts through its vertical component Ωz = Ω sin(latitude):
//
//   x'' =  2 Ωz y' − ω0² x
//   y'' = −2 Ωz x' − ω0² y
//
// In complex form z = x + i y this is z'' + 2iΩz z' + ω0² z = 0, and
// w = e^{iΩz t} z obeys w'' + ω² w = 0 with ω² = ω0² + Ωz². So the swing is a
// fixed ellipse in a frame turning at −Ωz (clockwise seen from above in the
// north), and the closed form below is exact for these equations.

export const SIDEREAL_DAY = 86164.0905; // seconds
export const EARTH_SPIN = (2 * Math.PI) / SIDEREAL_DAY; // rad/s
export const G = 9.80665;

const RAD = Math.PI / 180;

// Vertical component of the Earth's spin at a latitude, optionally sped up.
export function localSpin(latDeg, factor = 1) {
  return EARTH_SPIN * factor * Math.sin(latDeg * RAD);
}

// Time for the swing plane to make a full turn: a sidereal day / |sin φ|.
export function precessionPeriod(latDeg, factor = 1) {
  const s = Math.abs(localSpin(latDeg, factor));
  return s < 1e-15 ? Infinity : (2 * Math.PI) / s;
}

// Degrees the plane turns per hour; positive is clockwise from above.
export function degreesPerHour(latDeg, factor = 1) {
  return (localSpin(latDeg, factor) * 3600) / RAD;
}

export function swingPeriod(length, g = G) {
  return 2 * Math.PI * Math.sqrt(length / g);
}

// Closed-form motion from a starting position and velocity in the floor frame.
// Returns a function of time giving { x, y, vx, vy }.
export function solve({ length, g = G, omegaZ, x0 = 1, y0 = 0, vx0 = 0, vy0 = 0 }) {
  const w0sq = g / length;
  const om = Math.sqrt(w0sq + omegaZ * omegaZ);
  // w(0) = z(0); w'(0) = z'(0) + iΩz z(0)
  const ar = x0, ai = y0;
  const br = (vx0 - omegaZ * y0) / om;
  const bi = (vy0 + omegaZ * x0) / om;
  return (t) => {
    const c = Math.cos(om * t), s = Math.sin(om * t);
    const wr = ar * c + br * s, wi = ai * c + bi * s;
    const dwr = om * (br * c - ar * s), dwi = om * (bi * c - ai * s);
    const cr = Math.cos(omegaZ * t), ci = -Math.sin(omegaZ * t); // e^{−iΩz t}
    const x = cr * wr - ci * wi;
    const y = cr * wi + ci * wr;
    // z' = e^{−iΩz t} (w' − iΩz w)
    const ur = dwr + omegaZ * wi, ui = dwi - omegaZ * wr;
    return { x, y, vx: cr * ur - ci * ui, vy: cr * ui + ci * ur };
  };
}

// The two ways the pendulum is usually set going, scaled to an amplitude.
export function release(mode, amplitude, length, g = G, omegaZ = 0) {
  if (mode === 'centre') {
    const om = Math.sqrt(g / length + omegaZ * omegaZ);
    return { x0: 0, y0: 0, vx0: 0, vy0: amplitude * om };
  }
  // drawn aside and let go from rest, along the north–south line
  return { x0: 0, y0: amplitude, vx0: 0, vy0: 0 };
}

// Orientation of the swing in the floor frame at time t, in radians,
// measured anticlockwise from east and reduced to [0, π).
export function planeAngle(motion, omegaZ, length, g = G) {
  // the ellipse of w is fixed; recover its major axis from w(0), w'(0)
  const m = motion(0);
  const om = Math.sqrt(g / length + omegaZ * omegaZ);
  const ar = m.x, ai = m.y;
  const br = (m.vx - omegaZ * m.y) / om, bi = (m.vy + omegaZ * m.x) / om;
  // w = a cos θ + b sin θ; the major axis is where |w|² peaks
  const aa = ar * ar + ai * ai, bb = br * br + bi * bi, ab = ar * br + ai * bi;
  const th = 0.5 * Math.atan2(2 * ab, aa - bb);
  const px = ar * Math.cos(th) + br * Math.sin(th);
  const py = ai * Math.cos(th) + bi * Math.sin(th);
  const base = Math.atan2(py, px);
  return (t) => wrapHalf(base - omegaZ * t);
}

export function wrapHalf(a) {
  const r = a % Math.PI;
  return r < 0 ? r + Math.PI : r;
}

// Right-hand side of the equations above, for checking the closed form.
export function derivative([x, y, vx, vy], w0sq, omegaZ) {
  return [vx, vy, 2 * omegaZ * vy - w0sq * x, -2 * omegaZ * vx - w0sq * y];
}

export function rk4(state, dt, w0sq, omegaZ) {
  const k1 = derivative(state, w0sq, omegaZ);
  const k2 = derivative(state.map((v, i) => v + 0.5 * dt * k1[i]), w0sq, omegaZ);
  const k3 = derivative(state.map((v, i) => v + 0.5 * dt * k2[i]), w0sq, omegaZ);
  const k4 = derivative(state.map((v, i) => v + dt * k3[i]), w0sq, omegaZ);
  return state.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

// Energy per unit mass in the floor frame. The Coriolis force does no work,
// so this stays constant.
export function energy({ x, y, vx, vy }, length, g = G) {
  return 0.5 * (vx * vx + vy * vy) + 0.5 * (g / length) * (x * x + y * y);
}
