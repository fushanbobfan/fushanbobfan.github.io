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
  const w0 = 4 / 9, w1 = 1 / 9, w2 = 1 / 36;
  const n2 = 2 * n, n3 = 3 * n, n4 = 4 * n, n5 = 5 * n, n6 = 6 * n, n7 = 7 * n, n8 = 8 * n;
  for (let c = 0; c < n; c++) {
    if (solid[c]) continue;
    const f0 = f[c], f1 = f[n + c], f2 = f[n2 + c], f3 = f[n3 + c], f4 = f[n4 + c];
    const f5 = f[n5 + c], f6 = f[n6 + c], f7 = f[n7 + c], f8 = f[n8 + c];
    const r = f0 + f1 + f2 + f3 + f4 + f5 + f6 + f7 + f8;
    const vx = (f1 - f3 + f5 - f6 - f7 + f8) / r;
    const vy = (f2 - f4 + f5 + f6 - f7 - f8) / r;
    rho[c] = r;
    ux[c] = vx;
    uy[c] = vy;
    const base = 1 - 1.5 * (vx * vx + vy * vy);
    const a = vx + vy, b = vy - vx;
    const r1 = w1 * r, r2 = w2 * r;
    const gxs = 3 * gx, gys = 3 * gy;
    f[c] = f0 + omega * (w0 * r * base - f0);
    f[n + c] = f1 + omega * (r1 * (base + 3 * vx + 4.5 * vx * vx) - f1) + r1 * gxs;
    f[n2 + c] = f2 + omega * (r1 * (base + 3 * vy + 4.5 * vy * vy) - f2) + r1 * gys;
    f[n3 + c] = f3 + omega * (r1 * (base - 3 * vx + 4.5 * vx * vx) - f3) - r1 * gxs;
    f[n4 + c] = f4 + omega * (r1 * (base - 3 * vy + 4.5 * vy * vy) - f4) - r1 * gys;
    f[n5 + c] = f5 + omega * (r2 * (base + 3 * a + 4.5 * a * a) - f5) + r2 * (gxs + gys);
    f[n6 + c] = f6 + omega * (r2 * (base + 3 * b + 4.5 * b * b) - f6) + r2 * (gys - gxs);
    f[n7 + c] = f7 + omega * (r2 * (base - 3 * a + 4.5 * a * a) - f7) - r2 * (gxs + gys);
    f[n8 + c] = f8 + omega * (r2 * (base - 3 * b + 4.5 * b * b) - f8) - r2 * (gys - gxs);
  }
}

// Streaming by pulling: each fluid cell takes f_i from its upstream neighbour
// x - e_i. Edges wrap around; boundaries that should not wrap are rewritten
// afterwards by the tunnel boundary step. When the upstream cell is solid the
// population that left this cell towards it comes straight back reversed
// (halfway bounce-back), which puts a no-slip wall midway between the two.
export function stream(lat) {
  const { nx, ny, n, f, next, solid } = lat;
  const off = [];
  for (let i = 0; i < 9; i++) off.push(-(EY[i] * nx + EX[i]));
  for (let y = 0; y < ny; y++) {
    const edgeRow = y === 0 || y === ny - 1;
    for (let x = 0; x < nx; x++) {
      const c = y * nx + x;
      if (solid[c]) {
        for (let i = 0; i < 9; i++) next[i * n + c] = 0;
        continue;
      }
      next[c] = f[c];
      if (edgeRow || x === 0 || x === nx - 1) {
        for (let i = 1; i < 9; i++) {
          let sx = x - EX[i];
          let sy = y - EY[i];
          if (sx < 0) sx += nx; else if (sx >= nx) sx -= nx;
          if (sy < 0) sy += ny; else if (sy >= ny) sy -= ny;
          const s = sy * nx + sx;
          next[i * n + c] = solid[s] ? f[OPP[i] * n + c] : f[i * n + s];
        }
      } else {
        for (let i = 1; i < 9; i++) {
          const s = c + off[i];
          next[i * n + c] = solid[s] ? f[OPP[i] * n + c] : f[i * n + s];
        }
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

// Links from fluid cells into the cells of `mask`: one entry per fluid cell c
// and direction i with c + e_i inside the mask. Stored flat as [c, i, ...].
export function boundaryLinks(lat, mask) {
  const { nx, ny, solid } = lat;
  const links = [];
  for (let y = 1; y < ny - 1; y++) {
    for (let x = 1; x < nx - 1; x++) {
      const c = y * nx + x;
      if (solid[c]) continue;
      for (let i = 1; i < 9; i++) {
        if (mask[(y + EY[i]) * nx + x + EX[i]]) links.push(c, i);
      }
    }
  }
  return Int32Array.from(links);
}

// Force the fluid exerts on a resting body, by momentum exchange: with
// halfway bounce-back each post-collision population f_i that heads into the
// body returns reversed, handing the body 2 e_i f_i. Call it between
// collision and streaming.
export function linkForce(lat, links) {
  const { n, f } = lat;
  let fx = 0, fy = 0;
  for (let k = 0; k < links.length; k += 2) {
    const i = links[k + 1];
    const v = 2 * f[i * n + links[k]];
    fx += v * EX[i];
    fy += v * EY[i];
  }
  return [fx, fy];
}
