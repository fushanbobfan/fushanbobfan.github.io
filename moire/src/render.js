import { MAX_DOT_DUTY } from './gratings.js';

// Ink coverage of each layer for every device pixel of a w×h image. `scale` is
// device pixels per CSS pixel, so a period of 10 stays 10 CSS pixels on a
// high-density screen and each device pixel is filtered at its own size.
export function renderInks(w, h, layers, scale = 1) {
  return layers.map((layer) => renderInk(w, h, layer, scale));
}

// Same result as calling inkAt for every pixel, with the per-pixel work
// unrolled: this runs on every frame of a drag.
function renderInk(w, h, layer, scale) {
  const foot = 1 / scale;
  const ink = new Float32Array(w * h);
  const { period, duty } = layer;
  if (layer.kind === 'lines') {
    const c = Math.cos(layer.angle);
    const s = Math.sin(layer.angle);
    const width = (foot * (Math.abs(c) + Math.abs(s))) / period;
    const half = width / 2;
    const stepX = (c * foot) / period;
    for (let j = 0; j < h; j++) {
      const dy = (j + 0.5) * foot - layer.y;
      let t = (((0.5 * foot - layer.x) * c + dy * s) / period);
      for (let i = 0; i < w; i++, t += stepX) {
        const lo = t - half;
        const hi = t + half;
        const nl = Math.floor(lo);
        const nh = Math.floor(hi);
        const upLo = nl * duty + Math.min(lo - nl, duty);
        const upHi = nh * duty + Math.min(hi - nh, duty);
        ink[j * w + i] = (upHi - upLo) / width;
      }
    }
    return ink;
  }
  if (layer.kind === 'rings') {
    const width = foot / period;
    const half = width / 2;
    for (let j = 0; j < h; j++) {
      const dy = (j + 0.5) * foot - layer.y;
      const dy2 = dy * dy;
      for (let i = 0; i < w; i++) {
        const dx = (i + 0.5) * foot - layer.x;
        const t = Math.sqrt(dx * dx + dy2) / period;
        const lo = t - half;
        const hi = t + half;
        const nl = Math.floor(lo);
        const nh = Math.floor(hi);
        ink[j * w + i] = (nh * duty + Math.min(hi - nh, duty) - nl * duty - Math.min(lo - nl, duty)) / width;
      }
    }
    return ink;
  }
  const c = Math.cos(layer.angle) / period;
  const s = Math.sin(layer.angle) / period;
  const radius = period * Math.sqrt(Math.min(duty, MAX_DOT_DUTY) / Math.PI);
  for (let j = 0; j < h; j++) {
    const dy = (j + 0.5) * foot - layer.y;
    for (let i = 0; i < w; i++) {
      const dx = (i + 0.5) * foot - layer.x;
      const u = dx * c + dy * s;
      const v = dy * c - dx * s;
      const du = (u - Math.round(u)) * period;
      const dv = (v - Math.round(v)) * period;
      const edge = (radius - Math.sqrt(du * du + dv * dv)) / foot + 0.5;
      ink[j * w + i] = edge <= 0 ? 0 : edge >= 1 ? 1 : edge;
    }
  }
  return ink;
}

// Stack the sheets on a light box: each one passes its ink colour where it is
// inked and everything where it is clear, so overlapping inks multiply.
// Colours are [r, g, b] in 0..255. Returns interleaved float RGB.
export function composite(inks, colors, paper, n) {
  const rgb = new Float32Array(n * 3);
  for (let c = 0; c < 3; c++) {
    const base = paper[c];
    for (let p = 0; p < n; p++) rgb[p * 3 + c] = base;
  }
  inks.forEach((ink, k) => {
    const col = colors[k];
    for (let c = 0; c < 3; c++) {
      const keep = col[c] / 255;
      for (let p = 0; p < n; p++) rgb[p * 3 + c] *= 1 - ink[p] * (1 - keep);
    }
  });
  return rgb;
}

// One pass of a running-sum box blur along rows (stride 1) or columns.
function blurLine(src, dst, w, h, r, channels, vertical) {
  const len = vertical ? h : w;
  const lines = vertical ? w : h;
  const step = (vertical ? w : 1) * channels;
  const span = 2 * r + 1;
  for (let line = 0; line < lines; line++) {
    for (let c = 0; c < channels; c++) {
      const start = (vertical ? line : line * w) * channels + c;
      // Edges repeat the border pixel, so the mean is kept near the borders.
      const at = (k) => src[start + Math.min(len - 1, Math.max(0, k)) * step];
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += at(k);
      for (let k = 0; k < len; k++) {
        dst[start + k * step] = sum / span;
        sum += at(k + r + 1) - at(k - r);
      }
    }
  }
}

// Three box passes in each direction approximate a Gaussian blur: enough to
// wash out the fine lines and leave only the broad fringes.
export function boxBlur(src, w, h, r, channels = 1, passes = 3) {
  if (r < 1) return src.slice();
  let a = src.slice();
  let b = new Float32Array(src.length);
  for (let i = 0; i < passes; i++) {
    blurLine(a, b, w, h, r, channels, false);
    blurLine(b, a, w, h, r, channels, true);
  }
  return a;
}

export function toRGBA(rgb, n, out = new Uint8ClampedArray(n * 4)) {
  for (let p = 0; p < n; p++) {
    out[p * 4] = rgb[p * 3];
    out[p * 4 + 1] = rgb[p * 3 + 1];
    out[p * 4 + 2] = rgb[p * 3 + 2];
    out[p * 4 + 3] = 255;
  }
  return out;
}
