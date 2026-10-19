import test from 'node:test';
import assert from 'node:assert/strict';
import { createLattice } from '../src/lattice.js';
import { vorticity, speed, sampleVelocity } from '../src/field.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

function rotating(nx, ny, spin) {
  // Rigid rotation that looks anticlockwise on screen, where y points down:
  // (ux, uy) = spin * (y - cy, -(x - cx)) in lattice coordinates.
  const lat = createLattice(nx, ny);
  const cx = (nx - 1) / 2, cy = (ny - 1) / 2;
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const c = y * nx + x;
      lat.ux[c] = spin * (y - cy);
      lat.uy[c] = -spin * (x - cx);
    }
  }
  return lat;
}

test('rigid anticlockwise rotation has uniform positive vorticity of twice the spin', () => {
  const lat = rotating(9, 7, 0.01);
  const w = vorticity(lat);
  for (let y = 1; y < 6; y++) for (let x = 1; x < 8; x++) close(w[y * 9 + x], 0.02);
  assert.equal(w[0], 0);
});

test('a uniform stream has no vorticity and its speed everywhere', () => {
  const lat = createLattice(6, 5);
  lat.ux.fill(0.03);
  lat.uy.fill(0.04);
  const w = vorticity(lat);
  const s = speed(lat);
  for (let c = 0; c < lat.n; c++) {
    close(w[c], 0);
    close(s[c], 0.05);
  }
});

test('velocity sampling is bilinear, treats solid cells as still and clamps outside', () => {
  const lat = createLattice(3, 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) lat.ux[y * 3 + x] = x;
  const [u] = sampleVelocity(lat, 0.25, 1.5);
  close(u, 0.25);
  lat.solid[1 * 3 + 1] = 1;
  close(sampleVelocity(lat, 1, 1)[0], 0);
  close(sampleVelocity(lat, -4, 0)[0], 0);
  close(sampleVelocity(lat, 99, 0)[0], 2, 1e-4);
});
