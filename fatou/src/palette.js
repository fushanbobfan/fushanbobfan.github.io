// Cyclic colour gradients for escape counts, and fixed colours for the
// periods of interior components.

export const PALETTES = {
  ember: [
    [0, 8, 6, 30], [0.18, 70, 20, 90], [0.4, 210, 70, 40],
    [0.6, 255, 190, 60], [0.78, 255, 245, 210], [1, 8, 6, 30],
  ],
  tide: [
    [0, 2, 12, 40], [0.25, 20, 90, 160], [0.5, 210, 240, 255],
    [0.7, 240, 170, 40], [0.85, 120, 30, 10], [1, 2, 12, 40],
  ],
  moss: [
    [0, 12, 20, 12], [0.3, 60, 120, 50], [0.55, 230, 230, 160],
    [0.75, 150, 90, 40], [1, 12, 20, 12],
  ],
  ink: [
    [0, 250, 248, 240], [0.5, 30, 30, 40], [1, 250, 248, 240],
  ],
};

export const LUT_SIZE = 1024;

// Linear interpolation between stops into an RGB table of LUT_SIZE entries.
export function buildLut(stops, size = LUT_SIZE) {
  const lut = new Uint8Array(size * 3);
  let s = 0;
  for (let i = 0; i < size; i++) {
    const t = i / size;
    while (s < stops.length - 2 && stops[s + 1][0] <= t) s++;
    const [t0, r0, g0, b0] = stops[s];
    const [t1, r1, g1, b1] = stops[s + 1];
    const u = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
    lut[3 * i] = Math.round(r0 + (r1 - r0) * u);
    lut[3 * i + 1] = Math.round(g0 + (g1 - g0) * u);
    lut[3 * i + 2] = Math.round(b0 + (b1 - b0) * u);
  }
  return lut;
}

// Index of t in the table, wrapping so that any real t is valid.
export function lutIndex(t, size = LUT_SIZE) {
  const f = t - Math.floor(t);
  return Math.min(size - 1, Math.floor(f * size));
}

// Twelve well-separated hues for component periods 1..12, repeating after.
const PERIOD_RGB = [
  [52, 61, 140], [173, 52, 62], [46, 125, 82], [196, 128, 34],
  [112, 58, 150], [32, 128, 150], [160, 84, 120], [110, 120, 40],
  [70, 90, 190], [190, 70, 40], [40, 150, 120], [150, 110, 80],
];

export function periodColour(period) {
  if (period <= 0) return [6, 6, 10];
  return PERIOD_RGB[(period - 1) % PERIOD_RGB.length];
}
