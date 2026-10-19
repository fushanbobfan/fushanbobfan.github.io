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
