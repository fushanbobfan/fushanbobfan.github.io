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

// A lattice of nx by ny cells. `solid` marks obstacle cells; rho, ux and uy
// hold the moments from the last collision so the page can draw them.
export function createLattice(nx, ny) {
  const n = nx * ny;
  return {
    nx,
    ny,
    n,
    f: new Float32Array(9 * n),
    next: new Float32Array(9 * n),
    solid: new Uint8Array(n),
    rho: new Float32Array(n),
    ux: new Float32Array(n),
    uy: new Float32Array(n),
  };
}

// Fill every fluid cell with the equilibrium for one density and velocity.
export function fillUniform(lat, rho, ux, uy) {
  const { n, f, solid } = lat;
  const feq = [];
  for (let i = 0; i < 9; i++) feq.push(equilibrium(i, rho, ux, uy));
  for (let c = 0; c < n; c++) {
    const s = solid[c];
    for (let i = 0; i < 9; i++) f[i * n + c] = s ? 0 : feq[i];
    lat.rho[c] = s ? 0 : rho;
    lat.ux[c] = s ? 0 : ux;
    lat.uy[c] = s ? 0 : uy;
  }
}

// Total mass and momentum over the fluid cells.
export function totals(lat) {
  const { n, f, solid } = lat;
  let m = 0, px = 0, py = 0;
  for (let c = 0; c < n; c++) {
    if (solid[c]) continue;
    for (let i = 0; i < 9; i++) {
      const v = f[i * n + c];
      m += v;
      px += v * EX[i];
      py += v * EY[i];
    }
  }
  return { mass: m, px, py };
}

// BGK collision: relax every fluid cell towards its local equilibrium with
// rate omega = 1 / tau. A body force (gx, gy) per unit mass is added after
// relaxing, with the simple first-order source w_i 3 (e_i . g) rho.
export function collide(lat, omega, gx = 0, gy = 0) {
  const { n, f, solid, rho, ux, uy } = lat;
  for (let c = 0; c < n; c++) {
    if (solid[c]) continue;
    const f0 = f[c], f1 = f[n + c], f2 = f[2 * n + c], f3 = f[3 * n + c], f4 = f[4 * n + c];
    const f5 = f[5 * n + c], f6 = f[6 * n + c], f7 = f[7 * n + c], f8 = f[8 * n + c];
    const r = f0 + f1 + f2 + f3 + f4 + f5 + f6 + f7 + f8;
    const vx = (f1 - f3 + f5 - f6 - f7 + f8) / r;
    const vy = (f2 - f4 + f5 + f6 - f7 - f8) / r;
    rho[c] = r;
    ux[c] = vx;
    uy[c] = vy;
    const uu = 1.5 * (vx * vx + vy * vy);
    for (let i = 0; i < 9; i++) {
      const eu = EX[i] * vx + EY[i] * vy;
      const feq = W[i] * r * (1 + 3 * eu + 4.5 * eu * eu - uu);
      const k = i * n + c;
      f[k] += omega * (feq - f[k]) + 3 * W[i] * r * (EX[i] * gx + EY[i] * gy);
    }
  }
}

// Streaming by pulling: each fluid cell takes f_i from its upstream neighbour
// x - e_i. Edges wrap around; boundaries that should not wrap are rewritten
// afterwards by the tunnel boundary step. When the upstream cell is solid the
// population that left this cell towards it comes straight back reversed
// (halfway bounce-back), which puts a no-slip wall midway between the two.
export function stream(lat) {
  const { nx, ny, n, f, next, solid } = lat;
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const c = y * nx + x;
      if (solid[c]) {
        for (let i = 0; i < 9; i++) next[i * n + c] = 0;
        continue;
      }
      next[c] = f[c];
      for (let i = 1; i < 9; i++) {
        let sx = x - EX[i];
        let sy = y - EY[i];
        if (sx < 0) sx += nx; else if (sx >= nx) sx -= nx;
        if (sy < 0) sy += ny; else if (sy >= ny) sy -= ny;
        const s = sy * nx + sx;
        next[i * n + c] = solid[s] ? f[OPP[i] * n + c] : f[i * n + s];
      }
    }
  }
  lat.f = next;
  lat.next = f;
}

// Wind tunnel edges after streaming: the left column and the top and bottom
// rows are held at the free-stream equilibrium (density 1, velocity u along
// x), and the right column copies its left neighbour so the wake leaves
// without reflecting much.
export function tunnelEdges(lat, u) {
  const { nx, ny, n, f, solid } = lat;
  const feq = [];
  for (let i = 0; i < 9; i++) feq.push(equilibrium(i, 1, u, 0));
  const hold = (c) => {
    if (solid[c]) return;
    for (let i = 0; i < 9; i++) f[i * n + c] = feq[i];
  };
  for (let y = 0; y < ny; y++) {
    hold(y * nx);
    const c = y * nx + nx - 1;
    if (solid[c]) continue;
    for (let i = 0; i < 9; i++) f[i * n + c] = f[i * n + c - 1];
  }
  for (let x = 0; x < nx; x++) {
    hold(x);
    hold((ny - 1) * nx + x);
  }
}
