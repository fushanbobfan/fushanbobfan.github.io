// Radix-2 complex FFT on split real/imaginary arrays, in place.
// Lengths must be powers of two. The 2D transform runs over rows, then columns.

export function isPowerOfTwo(n) {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

const tables = new Map();

function twiddles(n) {
  let t = tables.get(n);
  if (!t) {
    const cos = new Float64Array(n / 2);
    const sin = new Float64Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      cos[k] = Math.cos((2 * Math.PI * k) / n);
      sin[k] = Math.sin((2 * Math.PI * k) / n);
    }
    const rev = new Uint32Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      rev[i] = r;
    }
    t = { cos, sin, rev };
    tables.set(n, t);
  }
  return t;
}

// Transforms re/im of length n starting at `offset` with element spacing `stride`.
// inverse = true uses the conjugate twiddles and does not scale.
export function fft1d(re, im, n, inverse = false, offset = 0, stride = 1) {
  if (!isPowerOfTwo(n)) throw new RangeError(`FFT length must be a power of two, got ${n}`);
  const { cos, sin, rev } = twiddles(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      const a = offset + i * stride;
      const b = offset + j * stride;
      let t = re[a]; re[a] = re[b]; re[b] = t;
      t = im[a]; im[a] = im[b]; im[b] = t;
    }
  }
  const sign = inverse ? 1 : -1;
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step];
        const wi = sign * sin[k * step];
        const a = offset + (start + k) * stride;
        const b = a + half * stride;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

// 2D transform of an n x n grid stored row-major. The inverse divides by n * n.
export function fft2d(re, im, n, inverse = false) {
  for (let y = 0; y < n; y++) fft1d(re, im, n, inverse, y * n, 1);
  for (let x = 0; x < n; x++) fft1d(re, im, n, inverse, x, n);
  if (inverse) {
    const scale = 1 / (n * n);
    for (let i = 0; i < n * n; i++) {
      re[i] *= scale;
      im[i] *= scale;
    }
  }
}
