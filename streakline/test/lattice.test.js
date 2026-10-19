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
