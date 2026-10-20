// Periodic convolution of a real n x n field with a fixed real kernel.
//
// A real field's spectrum is conjugate-symmetric, so half of a plain complex
// transform is wasted. Two savings follow:
//   - rows go through the 1D FFT in pairs, one as the real part and one as the
//     imaginary part, and are separated afterwards;
//   - only columns 0..n/2 of the spectrum are transformed, multiplied and
//     transformed back; the rest are mirror images.
// The inverse rebuilds each row's full spectrum from its half and again runs
// rows in pairs, the real part giving one row and the imaginary part the next.

import { fft1d, fft2d, fftColumns, isPowerOfTwo } from './fft.js';

export class RealConvolver {
  constructor(n) {
    if (!isPowerOfTwo(n) || n < 4) throw new RangeError(`size must be a power of two >= 4, got ${n}`);
    this.n = n;
    this.half = n / 2 + 1;
    this.re = new Float64Array(n * n);
    this.im = new Float64Array(n * n);
    this.rowRe = new Float64Array(n);
    this.rowIm = new Float64Array(n);
    this.kRe = null;
    this.kIm = null;
  }

  // Stores the spectrum of a kernel laid out with its centre at index 0.
  setKernel(kernel) {
    const { n } = this;
    const kr = Float64Array.from(kernel);
    const ki = new Float64Array(n * n);
    fft2d(kr, ki, n);
    this.kRe = kr;
    this.kIm = ki;
  }

  // Half spectrum (columns 0..n/2) of a real field into this.re / this.im.
  forward(field) {
    const { n, half, re, im, rowRe, rowIm } = this;
    for (let y = 0; y < n; y += 2) {
      const a = y * n;
      const b = a + n;
      for (let x = 0; x < n; x++) {
        rowRe[x] = field[a + x];
        rowIm[x] = field[b + x];
      }
      fft1d(rowRe, rowIm, n);
      for (let k = 0; k < half; k++) {
        const m = (n - k) & (n - 1);
        const zr = rowRe[k], zi = rowIm[k], cr = rowRe[m], ci = rowIm[m];
        re[a + k] = 0.5 * (zr + cr);
        im[a + k] = 0.5 * (zi - ci);
        re[b + k] = 0.5 * (zi + ci);
        im[b + k] = -0.5 * (zr - cr);
      }
    }
    fftColumns(re, im, n, false, 0, half);
  }

  // Multiplies the half spectrum by the kernel's.
  multiply() {
    const { n, half, re, im, kRe, kIm } = this;
    for (let y = 0; y < n; y++) {
      const o = y * n;
      for (let k = 0; k < half; k++) {
        const i = o + k;
        const a = re[i], b = im[i], c = kRe[i], d = kIm[i];
        re[i] = a * c - b * d;
        im[i] = a * d + b * c;
      }
    }
  }

  // Real field back from the half spectrum, written into `out`.
  inverse(out) {
    const { n, half, re, im, rowRe, rowIm } = this;
    fftColumns(re, im, n, true, 0, half);
    const scale = 1 / (n * n);
    for (let y = 0; y < n; y += 2) {
      const a = y * n;
      const b = a + n;
      for (let k = 0; k < n; k++) {
        let pr, pi, qr, qi;
        if (k < half) {
          pr = re[a + k]; pi = im[a + k]; qr = re[b + k]; qi = im[b + k];
        } else {
          const m = n - k;
          pr = re[a + m]; pi = -im[a + m]; qr = re[b + m]; qi = -im[b + m];
        }
        rowRe[k] = pr - qi;
        rowIm[k] = pi + qr;
      }
      fft1d(rowRe, rowIm, n, true);
      for (let x = 0; x < n; x++) {
        out[a + x] = rowRe[x] * scale;
        out[b + x] = rowIm[x] * scale;
      }
    }
    return out;
  }

  convolve(field, out) {
    if (!this.kRe) throw new Error('setKernel must be called before convolve');
    this.forward(field);
    this.multiply();
    return this.inverse(out);
  }
}
