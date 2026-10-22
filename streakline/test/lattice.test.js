import test from 'node:test';
import assert from 'node:assert/strict';
import { EX, EY, W, OPP, equilibrium } from '../src/lattice.js';

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('weights sum to one and opposite directions point backwards', () => {
  close(W.reduce((s, w) => s + w, 0), 1);
  for (let i = 0; i < 9; i++) {
    assert.ok(EX[OPP[i]] === -EX[i]);
    assert.ok(EY[OPP[i]] === -EY[i]);
    assert.equal(OPP[OPP[i]], i);
  }
});

test('lattice tensors are isotropic with sound speed 1/sqrt(3)', () => {
  let xx = 0, yy = 0, xy = 0;
  for (let i = 0; i < 9; i++) {
    xx += W[i] * EX[i] * EX[i];
    yy += W[i] * EY[i] * EY[i];
    xy += W[i] * EX[i] * EY[i];
  }
  close(xx, 1 / 3);
  close(yy, 1 / 3);
  close(xy, 0);
});

test('equilibrium reproduces density, momentum and momentum flux', () => {
  const rho = 1.07, ux = 0.08, uy = -0.035;
  let m0 = 0, mx = 0, my = 0, pxx = 0, pxy = 0;
  for (let i = 0; i < 9; i++) {
    const f = equilibrium(i, rho, ux, uy);
    m0 += f;
    mx += f * EX[i];
    my += f * EY[i];
    pxx += f * EX[i] * EX[i];
    pxy += f * EX[i] * EY[i];
  }
  close(m0, rho);
  close(mx, rho * ux);
  close(my, rho * uy);
  close(pxx, rho / 3 + rho * ux * ux);
  close(pxy, rho * ux * uy);
});

test('collision keeps mass and momentum in every cell and relaxes towards equilibrium', async () => {
  const { createLattice, collide, fillUniform, totals } = await import('../src/lattice.js');
  const lat = createLattice(5, 4);
  fillUniform(lat, 1, 0.05, 0);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < lat.f.length; k++) lat.f[k] *= 0.8 + 0.4 * rand();
  const before = totals(lat);
  collide(lat, 1.2);
  const after = totals(lat);
  close(after.mass, before.mass, 1e-4);
  close(after.px, before.px, 1e-5);
  close(after.py, before.py, 1e-5);

  // With omega = 1 a cell lands exactly on its equilibrium.
  collide(lat, 1);
  const c = 6;
  for (let i = 0; i < 9; i++) {
    close(lat.f[i * lat.n + c], equilibrium(i, lat.rho[c], lat.ux[c], lat.uy[c]), 1e-6);
  }
});

test('a body force adds momentum g per unit mass each collision', async () => {
  const { createLattice, collide, fillUniform, totals } = await import('../src/lattice.js');
  const lat = createLattice(4, 4);
  fillUniform(lat, 1, 0, 0);
  collide(lat, 1, 1e-4, -2e-4);
  const t = totals(lat);
  close(t.px, 16 * 1e-4, 1e-7);
  close(t.py, -16 * 2e-4, 1e-7);
});

test('streaming moves each population one cell along its direction, wrapping at the edges', async () => {
  const { createLattice, stream } = await import('../src/lattice.js');
  const lat = createLattice(5, 4);
  const at = (x, y) => y * lat.nx + x;
  lat.f[1 * lat.n + at(4, 1)] = 1; // east, wraps to x = 0
  lat.f[6 * lat.n + at(2, 3)] = 2; // north-west: x - 1, y + 1 wraps to y = 0
  stream(lat);
  assert.equal(lat.f[1 * lat.n + at(0, 1)], 1);
  assert.equal(lat.f[6 * lat.n + at(1, 0)], 2);
});

test('a population heading into a solid cell comes back reversed', async () => {
  const { createLattice, stream } = await import('../src/lattice.js');
  const lat = createLattice(5, 3);
  const at = (x, y) => y * lat.nx + x;
  lat.solid[at(3, 1)] = 1;
  lat.f[1 * lat.n + at(2, 1)] = 0.7; // east, into the wall
  lat.f[5 * lat.n + at(2, 0)] = 0.4; // north-east, into the wall diagonally
  stream(lat);
  assert.ok(Math.abs(lat.f[3 * lat.n + at(2, 1)] - 0.7) < 1e-7);
  assert.ok(Math.abs(lat.f[7 * lat.n + at(2, 0)] - 0.4) < 1e-7);
});

test('collide and stream keep total mass in a closed box with obstacles', async () => {
  const { createLattice, collide, stream, fillUniform, totals } = await import('../src/lattice.js');
  const lat = createLattice(24, 16);
  for (let y = 5; y < 10; y++) for (let x = 8; x < 12; x++) lat.solid[y * lat.nx + x] = 1;
  lat.solid[3 * lat.nx + 17] = 1;
  fillUniform(lat, 1, 0.06, 0.02);
  const m0 = totals(lat).mass;
  for (let s = 0; s < 200; s++) {
    collide(lat, 1.6);
    stream(lat);
  }
  assert.ok(Math.abs(totals(lat).mass - m0) / m0 < 1e-5);
});

test('a forced channel settles into the Poiseuille parabola with walls halfway out', async () => {
  const { createLattice, collide, stream, fillUniform } = await import('../src/lattice.js');
  const nx = 4, ny = 22, H = ny - 2;
  const lat = createLattice(nx, ny);
  for (let x = 0; x < nx; x++) {
    lat.solid[x] = 1;
    lat.solid[(ny - 1) * nx + x] = 1;
  }
  fillUniform(lat, 1, 0, 0);
  const tau = 0.8, nu = (tau - 0.5) / 3, G = 4e-5;
  for (let s = 0; s < 10000; s++) {
    collide(lat, 1 / tau, G, 0);
    stream(lat);
  }
  collide(lat, 1 / tau, G, 0);
  const umax = (G * H * H) / (8 * nu);
  let worst = 0;
  for (let y = 1; y < ny - 1; y++) {
    const exact = (G / (2 * nu)) * (y - 0.5) * (ny - 1.5 - y);
    worst = Math.max(worst, Math.abs(lat.ux[y * nx + 1] - exact) / umax);
    assert.ok(Math.abs(lat.uy[y * nx + 1]) < 1e-7);
  }
  assert.ok(worst < 0.02, `largest error ${(worst * 100).toFixed(2)}% of the peak`);
});

test('an empty tunnel keeps a uniform stream uniform', async () => {
  const { createLattice, collide, stream, fillUniform, tunnelEdges } = await import('../src/lattice.js');
  const lat = createLattice(30, 12);
  fillUniform(lat, 1, 0.1, 0);
  for (let s = 0; s < 100; s++) {
    collide(lat, 1.7);
    stream(lat);
    tunnelEdges(lat, 0.1);
  }
  collide(lat, 1.7);
  for (let c = 0; c < lat.n; c++) {
    assert.ok(Math.abs(lat.ux[c] - 0.1) < 1e-5);
    assert.ok(Math.abs(lat.uy[c]) < 1e-5);
    assert.ok(Math.abs(lat.rho[c] - 1) < 1e-5);
  }
});

test('a block in the tunnel slows the flow behind it and pushes it round the sides', async () => {
  const { createLattice, collide, stream, fillUniform, tunnelEdges } = await import('../src/lattice.js');
  const nx = 60, ny = 30;
  const lat = createLattice(nx, ny);
  for (let y = 12; y < 18; y++) for (let x = 15; x < 19; x++) lat.solid[y * nx + x] = 1;
  fillUniform(lat, 1, 0.08, 0);
  for (let s = 0; s < 600; s++) {
    collide(lat, 1.5);
    stream(lat);
    tunnelEdges(lat, 0.08);
  }
  collide(lat, 1.5);
  const behind = lat.ux[15 * nx + 21];
  const side = lat.ux[9 * nx + 17];
  assert.ok(behind < 0.04, `wake ${behind}`);
  assert.ok(side > 0.08, `side ${side}`);
  for (let c = 0; c < lat.n; c++) assert.ok(Number.isFinite(lat.rho[c]));
});

test('a fluid at rest pushes equally on every side of a block', async () => {
  const { createLattice, fillUniform, boundaryLinks, linkForce } = await import('../src/lattice.js');
  const lat = createLattice(12, 12);
  for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) lat.solid[y * 12 + x] = 1;
  fillUniform(lat, 1, 0, 0);
  const links = boundaryLinks(lat, lat.solid);
  // 4 cells per face times 4 faces get the axis link; the diagonals add
  // 6 per face (two from the corner cells) and one at each outer corner.
  assert.equal(links.length / 2, 16 + 24 + 4);
  const [fx, fy] = linkForce(lat, links);
  assert.ok(Math.abs(fx) < 1e-7 && Math.abs(fy) < 1e-7);
});

test('in a forced periodic box the steady force on the obstacle balances the push on the fluid', async () => {
  const { createLattice, collide, stream, fillUniform, boundaryLinks, linkForce, totals } = await import('../src/lattice.js');
  const nx = 30, ny = 16;
  const lat = createLattice(nx, ny);
  for (let y = 5; y < 11; y++) for (let x = 12; x < 16; x++) lat.solid[y * nx + x] = 1;
  fillUniform(lat, 1, 0, 0);
  const links = boundaryLinks(lat, lat.solid);
  const G = 2e-5;
  let F = [0, 0];
  for (let s = 0; s < 6000; s++) {
    collide(lat, 1, G, 0);
    F = linkForce(lat, links);
    stream(lat);
  }
  const push = G * totals(lat).mass;
  assert.ok(Math.abs(F[0] - push) / push < 0.01, `${F[0]} vs ${push}`);
  assert.ok(Math.abs(F[1]) < 1e-3 * push);
});

test('the fused step matches stream, tunnel edges and collide done one after another', async () => {
  const { createLattice, collide, stream, tunnelEdges, advance, fillUniform } = await import('../src/lattice.js');
  const make = () => {
    const lat = createLattice(23, 14);
    for (let y = 5; y < 9; y++) for (let x = 6; x < 9; x++) lat.solid[y * 23 + x] = 1;
    lat.solid[2 * 23 + 20] = 1; // a wall cell two columns from the outlet
    fillUniform(lat, 1, 0.07, 0.01);
    let seed = 11;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < lat.f.length; k++) lat.f[k] *= 0.9 + 0.2 * rand();
    return lat;
  };
  const a = make(), b = make();
  for (let s = 0; s < 5; s++) {
    stream(a);
    tunnelEdges(a, 0.07);
    collide(a, 1.6);
    advance(b, 1.6, 0.07);
  }
  let worst = 0;
  for (let k = 0; k < a.f.length; k++) worst = Math.max(worst, Math.abs(a.f[k] - b.f[k]));
  assert.ok(worst < 1e-6, `largest difference ${worst}`);
  for (let c = 0; c < a.n; c++) assert.ok(Math.abs(a.ux[c] - b.ux[c]) < 1e-6);
});
