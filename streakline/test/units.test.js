import test from 'node:test';
import assert from 'node:assert/strict';
import { relaxation, maxReynolds, mach, TAU_MIN } from '../src/units.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('relaxation time follows nu = (tau - 1/2) / 3 and gives back the Reynolds number', () => {
  const r = relaxation(0.1, 20, 100);
  close(r.nu, 0.02);
  close(r.tau, 0.56);
  close(r.omega, 1 / 0.56);
  close(r.re, 100);
  assert.equal(r.clamped, false);
});

test('a Reynolds number too high for the grid is clamped and reported', () => {
  const r = relaxation(0.1, 20, 5000);
  assert.equal(r.clamped, true);
  close(r.tau, TAU_MIN);
  close(r.re, maxReynolds(0.1, 20));
  close(maxReynolds(0.1, 20), 600, 1e-6);
});

test('the lattice Mach number scales the speed by sqrt(3)', () => {
  close(mach(0.1), 0.17320508075688773);
});
