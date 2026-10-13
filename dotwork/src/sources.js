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

export function drawSource(id, width, height) {
  const s = SOURCES[id];
  if (!s) throw new Error(`unknown picture: ${id}`);
  return s.draw(width, height);
}
