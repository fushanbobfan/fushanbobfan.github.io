// Fields derived from the lattice moments for drawing and measuring.

// Vorticity by central differences, signed so that positive means spinning
// anticlockwise as drawn (rows run downwards on screen, which flips the sign
// of the lattice curl). Edge cells and solid cells get zero.
export function vorticity(lat, out = new Float32Array(lat.n)) {
  const { nx, ny, ux, uy, solid } = lat;
  out.fill(0);
  for (let y = 1; y < ny - 1; y++) {
    for (let x = 1; x < nx - 1; x++) {
      const c = y * nx + x;
      if (solid[c]) continue;
      const dvdx = (uy[c + 1] - uy[c - 1]) / 2;
      const dudy = (ux[c + nx] - ux[c - nx]) / 2;
      out[c] = dudy - dvdx;
    }
  }
  return out;
}

export function speed(lat, out = new Float32Array(lat.n)) {
  const { n, ux, uy } = lat;
  for (let c = 0; c < n; c++) out[c] = Math.hypot(ux[c], uy[c]);
  return out;
}

// Velocity at a point between cell centres by bilinear interpolation, with
// solid cells counting as at rest. Points outside the lattice are clamped.
export function sampleVelocity(lat, px, py) {
  const { nx, ny, ux, uy, solid } = lat;
  const x = Math.min(Math.max(px, 0), nx - 1.000001);
  const y = Math.min(Math.max(py, 0), ny - 1.000001);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = x - x0, ty = y - y0;
  const c = y0 * nx + x0;
  const at = (k, arr) => (solid[k] ? 0 : arr[k]);
  const lerp = (arr) =>
    (1 - ty) * ((1 - tx) * at(c, arr) + tx * at(c + 1, arr)) +
    ty * ((1 - tx) * at(c + nx, arr) + tx * at(c + nx + 1, arr));
  return [lerp(ux), lerp(uy)];
}
