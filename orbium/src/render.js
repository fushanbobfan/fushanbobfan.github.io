// Colour maps and the conversion of a field into RGBA pixels.

export const PALETTES = {
  ember: ['#08060a', '#3b0f2e', '#8c1d2b', '#d9541e', '#f7a33b', '#fff1c4'],
  lagoon: ['#030b17', '#0b2f4f', '#0f6a7a', '#2fb39a', '#a6e3b5', '#f4fbef'],
  moss: ['#0b0d08', '#1f2d14', '#3f5f22', '#7b9a35', '#c9d77a', '#f8f6dc'],
  ink: ['#fbf8f1', '#d9d2c3', '#9a907f', '#5a5246', '#2a251f', '#0d0b09'],
};

// Diverging map for growth: blue where cells shrink, dark at zero, warm where they grow.
export const DIVERGING = ['#5ab4f0', '#1d4f8a', '#101018', '#8a2a1d', '#f0a35a'];

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new RangeError(`bad colour "${hex}"`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// 256-entry lookup table, packed as RGBA bytes.
export function buildLut(stops) {
  const rgb = stops.map(hexToRgb);
  const lut = new Uint8ClampedArray(256 * 4);
  const segs = rgb.length - 1;
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * segs;
    const k = Math.min(segs - 1, Math.floor(t));
    const f = t - k;
    for (let c = 0; c < 3; c++) lut[i * 4 + c] = Math.round(rgb[k][c] + (rgb[k + 1][c] - rgb[k][c]) * f);
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

// Writes `values` into `out` (RGBA bytes) through the lookup table, mapping
// [lo, hi] onto the full table and clamping outside it.
export function paint(values, out, lut, lo = 0, hi = 1) {
  const span = hi - lo || 1;
  for (let i = 0; i < values.length; i++) {
    let t = (values[i] - lo) / span;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const k = Math.round(t * 255) * 4;
    const o = i * 4;
    out[o] = lut[k];
    out[o + 1] = lut[k + 1];
    out[o + 2] = lut[k + 2];
    out[o + 3] = 255;
  }
  return out;
}

export const VIEWS = ['cells', 'potential', 'growth'];

// Value range shown for each view. Potential is drawn up to twice mu so the
// growth band sits in the middle of the map; growth spans its full [-1, 1].
export function viewRange(view, rule) {
  if (view === 'potential') return [0, Math.min(1, 2 * rule.mu)];
  if (view === 'growth') return [-1, 1];
  return [0, 1];
}
