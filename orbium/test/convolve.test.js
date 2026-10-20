import test from 'node:test';
import assert from 'node:assert/strict';
import { RealConvolver } from '../src/convolve.js';
import { fft2d } from '../src/fft.js';

function noise(n, seed) {
  let s = seed;
  return Float64Array.from({ length: n * n }, () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  });
}

// Reference: full complex transforms of both, product, inverse.
function reference(field, kernel, n) {
  const ar = field.slice(), ai = new Float64Array(n * n);
  const kr = kernel.slice(), ki = new Float64Array(n * n);
  fft2d(ar, ai, n);
  fft2d(kr, ki, n);
  for (let i = 0; i < n * n; i++) {
    const a = ar[i], b = ai[i];
    ar[i] = a * kr[i] - b * ki[i];
    ai[i] = a * ki[i] + b * kr[i];
  }
  fft2d(ar, ai, n, true);
  return ar;
}

test('the half-spectrum convolution matches the full complex one', () => {
  for (const n of [4, 16, 64]) {
    const field = noise(n, 7 + n);
    const kernel = noise(n, 99 + n);
    const c = new RealConvolver(n);
    c.setKernel(kernel);
    const got = c.convolve(field, new Float64Array(n * n));
    const want = reference(field, kernel, n);
    for (let i = 0; i < n * n; i++) assert.ok(Math.abs(got[i] - want[i]) < 1e-10, `n=${n} at ${i}: ${got[i]} vs ${want[i]}`);
  }
});

test('a unit impulse kernel returns the field and a shifted one rolls it', () => {
  const n = 8;
  const field = noise(n, 3);
  const c = new RealConvolver(n);
  const k = new Float64Array(n * n);
  k[0] = 1;
  c.setKernel(k);
  const same = c.convolve(field, new Float64Array(n * n));
  for (let i = 0; i < n * n; i++) assert.ok(Math.abs(same[i] - field[i]) < 1e-12);
  k[0] = 0;
  k[1 * n + 2] = 1;
  c.setKernel(k);
  const moved = c.convolve(field, new Float64Array(n * n));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const src = ((y - 1 + n) % n) * n + ((x - 2 + n) % n);
      assert.ok(Math.abs(moved[y * n + x] - field[src]) < 1e-12);
    }
  }
});

test('the convolver refuses odd sizes and a missing kernel', () => {
  assert.throws(() => new RealConvolver(12), RangeError);
  assert.throws(() => new RealConvolver(8).convolve(new Float64Array(64), new Float64Array(64)), /setKernel/);
});
