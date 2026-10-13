// Built-in pictures drawn from formulas, so the lab works before anyone
// uploads a photo and the tests have known tone to check against.

import { createField } from './density.js';

function fill(width, height, fn) {
  const f = createField(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // u, v in [-1, 1] on the short side, so shapes stay round on any aspect.
      const s = Math.min(width, height) / 2;
      const u = (x + 0.5 - width / 2) / s;
      const v = (y + 0.5 - height / 2) / s;
      f.data[y * width + x] = Math.min(1, Math.max(0, fn(u, v, x, y)));
    }
  }
  return f;
}

// Colour pictures: `fn` gives [r, g, b] in [0, 1] and the ink density is the
// darkness of that colour, read the same way as an uploaded image.
function paint(width, height, fn) {
  const field = createField(width, height);
  const rgb = new Uint8ClampedArray(3 * width * height);
  const s = Math.min(width, height) / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const c = fn((x + 0.5 - width / 2) / s, (y + 0.5 - height / 2) / s).map((v) => Math.min(1, Math.max(0, v)));
      rgb[3 * i] = Math.round(c[0] * 255);
      rgb[3 * i + 1] = Math.round(c[1] * 255);
      rgb[3 * i + 2] = Math.round(c[2] * 255);
      field.data[i] = 1 - (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]);
    }
  }
  return { field, colour: { width, height, rgb } };
}

const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const hex = (h) => [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);

// Sun low over the sea: a violet-to-orange sky, a yellow disc with a glow and
// a broken orange reflection on dark water.
function sunset(u, v) {
  const horizon = 0.3;
  const sun = [0.15, 0.08];
  const d = Math.hypot(u - sun[0], v - sun[1]);
  if (v < horizon) {
    const t = Math.max(0, Math.min(1, (v + 1) / (horizon + 1)));
    let c = t < 0.6 ? lerp(hex('2b1e4f'), hex('a23d63'), t / 0.6) : lerp(hex('a23d63'), hex('f39a3d'), (t - 0.6) / 0.4);
    c = lerp(c, hex('ffd25a'), Math.max(0, 1 - d / 0.55) ** 2 * 0.8);
    return d < 0.22 ? hex('ffe08a') : c;
  }
  const depth = (v - horizon) / (1 - horizon);
  const water = lerp(hex('3a3560'), hex('101a33'), Math.min(1, depth));
  const band = Math.abs(u - sun[0]) < 0.3 * (1 - depth * 0.5);
  const ripple = Math.sin(v * 90 + Math.sin(u * 13) * 2) > 0.2;
  return band && ripple ? lerp(water, hex('f7b55a'), 0.85 * (1 - depth)) : water;
}

// Hue around the circle, full colour at the rim and dark grey at the centre.
function wheel(u, v) {
  const r = Math.hypot(u, v) / 0.9;
  if (r > 1) return [1, 1, 1];
  const h = ((Math.atan2(v, u) / (2 * Math.PI)) + 1) % 1;
  const val = 1 - 0.6 * (1 - r);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return val - val * r * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

// Lambert-shaded ball lit from the upper left, with a soft cast shadow.
function sphere(u, v) {
  const r = 0.72;
  const cx = -0.06;
  const cy = -0.08;
  const dx = (u - cx) / r;
  const dy = (v - cy) / r;
  const d2 = dx * dx + dy * dy;
  if (d2 <= 1) {
    const nz = Math.sqrt(1 - d2);
    const lx = -0.5;
    const ly = -0.6;
    const lz = 0.62;
    const lit = Math.max(0, dx * lx + dy * ly + nz * lz) / Math.hypot(lx, ly, lz);
    return 0.95 - 0.88 * lit;
  }
  const sx = (u - 0.18) / 0.8;
  const sy = (v - 0.78) / 0.16;
  const shadow = Math.max(0, 1 - Math.sqrt(sx * sx + sy * sy));
  return 0.55 * shadow;
}

const SOURCES = {
  ramp: {
    label: 'Tone ramp',
    note: 'Ink rises evenly from left to right; a fair stipple puts the dots ever closer together.',
    draw: (w, h) => fill(w, h, (u, v, x) => (x + 0.5) / w),
  },
  sphere: {
    label: 'Shaded ball',
    note: 'A lit ball and its shadow: smooth tone, a bright highlight and a hard rim.',
    draw: (w, h) => fill(w, h, sphere),
  },
  rings: {
    label: 'Ripples',
    note: 'Concentric waves that fade outwards, a test of how well thin dark bands are held.',
    draw: (w, h) =>
      fill(w, h, (u, v) => {
        const r = Math.hypot(u, v);
        return (0.5 + 0.5 * Math.cos(r * 18)) * Math.max(0, 1 - r * 0.85);
      }),
  },
  spiral: {
    label: 'Spiral galaxy',
    note: 'Two logarithmic arms around a bright core, drawn here as ink on paper.',
    draw: (w, h) =>
      fill(w, h, (u, v) => {
        const r = Math.hypot(u, v) + 1e-9;
        const a = Math.atan2(v, u);
        const arm = 0.5 + 0.5 * Math.cos(2 * (a - Math.log(r) / 0.32));
        const core = Math.exp(-r * r / 0.02);
        return Math.max(core, Math.pow(arm, 3) * Math.exp(-r * 1.6) * 1.1);
      }),
  },
  sunset: {
    label: 'Sunset (colour)',
    note: 'Sun over the sea in full colour; choose the picture colours below to see it.',
    paint: (w, h) => paint(w, h, sunset),
  },
  wheel: {
    label: 'Colour wheel (colour)',
    note: 'Every hue around the rim, darkening to grey at the centre.',
    paint: (w, h) => paint(w, h, wheel),
  },
  mandelbrot: {
    label: 'Mandelbrot set',
    note: 'Smooth escape time around the set, darker where points take longer to escape.',
    draw: (w, h) =>
      fill(w, h, (u, v) => {
        const cr = u * 1.25 - 0.6;
        const ci = v * 1.25;
        let zr = 0;
        let zi = 0;
        const max = 120;
        let n = 0;
        while (n < max && zr * zr + zi * zi < 256) {
          const t = zr * zr - zi * zi + cr;
          zi = 2 * zr * zi + ci;
          zr = t;
          n++;
        }
        if (n === max) return 1;
        const smooth = n + 1 - Math.log2(Math.log2(zr * zr + zi * zi) / 2);
        return Math.pow(Math.min(1, smooth / 40), 0.8);
      }),
  },
};

export const SOURCE_IDS = Object.keys(SOURCES);

export function sourceInfo(id) {
  const s = SOURCES[id];
  if (!s) throw new Error(`unknown picture: ${id}`);
  return { id, label: s.label, note: s.note };
}

// The picture's density and, for colour pictures, its colours (else null).
export function paintSource(id, width, height) {
  const s = SOURCES[id];
  if (!s) throw new Error(`unknown picture: ${id}`);
  return s.paint ? s.paint(width, height) : { field: s.draw(width, height), colour: null };
}

export function drawSource(id, width, height) {
  return paintSource(id, width, height).field;
}
