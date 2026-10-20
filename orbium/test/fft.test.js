import test from 'node:test';
import assert from 'node:assert/strict';
import { fft1d, fft2d, isPowerOfTwo } from '../src/fft.js';

function dft(re, im) {
  const n = re.length;
  const outRe = new Float64Array(n);
  const outIm = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < n; t++) {
      const a = (-2 * Math.PI * k * t) / n;
      outRe[k] += re[t] * Math.cos(a) - im[t] * Math.sin(a);
      outIm[k] += re[t] * Math.sin(a) + im[t] * Math.cos(a);
    }
  }
  return [outRe, outIm];
}

function close(a, b, tol = 1e-9) {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < tol, `index ${i}: ${a[i]} vs ${b[i]}`);
}

test('power-of-two check', () => {
  assert.ok(isPowerOfTwo(1));
  assert.ok(isPowerOfTwo(256));
  assert.ok(!isPowerOfTwo(0));
  assert.ok(!isPowerOfTwo(96));
  assert.ok(!isPowerOfTwo(2.5));
  assert.throws(() => fft1d(new Float64Array(6), new Float64Array(6), 6), RangeError);
});

test('1D transform matches a direct DFT', () => {
  const n = 16;
  const re = Float64Array.from({ length: n }, (_, i) => Math.sin(i * 0.7) + (i % 3));
  const im = Float64Array.from({ length: n }, (_, i) => Math.cos(i * 1.3) * 0.5);
  const [wantRe, wantIm] = dft(re, im);
  fft1d(re, im, n);
  close(re, wantRe);
  close(im, wantIm);
});

test('2D forward then inverse returns the input', () => {
  const n = 32;
  const re = Float64Array.from({ length: n * n }, (_, i) => ((i * 7919) % 101) / 101);
  const im = new Float64Array(n * n);
  const orig = re.slice();
  fft2d(re, im, n);
  fft2d(re, im, n, true);
  close(re, orig, 1e-12);
  close(im, new Float64Array(n * n), 1e-12);
});

test('2D transform of a single impulse is flat, and its DC term is the sum', () => {
  const n = 8;
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);
  re[0] = 3;
  fft2d(re, im, n);
  close(re, new Float64Array(n * n).fill(3));
  const g = Float64Array.from({ length: n * n }, (_, i) => i % 5);
  const sum = g.reduce((s, v) => s + v, 0);
  fft2d(g, new Float64Array(n * n), n);
  assert.ok(Math.abs(g[0] - sum) < 1e-9);
});
