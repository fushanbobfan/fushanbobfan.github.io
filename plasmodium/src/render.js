// Turns the trail into pixels: a tone curve squeezes any amount of trail into
// [0, 1), and a 256-entry palette turns that into colour.

export const PALETTES = {
  slime: { label: 'Slime', stops: ['#05060a', '#1f3a10', '#8fbf1f', '#f2f08a', '#ffffff'] },
  ember: { label: 'Ember', stops: ['#080404', '#4a0d0d', '#c2410c', '#fbbf24', '#fff7d6'] },
  tide: { label: 'Tide', stops: ['#03070d', '#0b2e4f', '#1d7fa8', '#7fe0e6', '#f2ffff'] },
  ink: { label: 'Ink on paper', stops: ['#f6f1e7', '#d9cdb4', '#8a7a5f', '#3a3226', '#0e0c09'] },
};

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function buildLut(stops) {
  const rgb = stops.map(hexToRgb);
  const lut = new Uint8ClampedArray(256 * 3);
  const segs = rgb.length - 1;
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * segs;
    const k = Math.min(Math.floor(t), segs - 1);
    const f = t - k;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(rgb[k][c] + (rgb[k + 1][c] - rgb[k][c]) * f);
  }
  return lut;
}

// Brightness 1 - exp(-v / scale): linear for faint trail, saturating for thick
// tubes. `scale` follows the mean so the picture keeps its contrast as the
// total amount of trail changes; `exposure` brightens or darkens it.
export function toneScale(trail, exposure) {
  let sum = 0;
  const d = trail.data;
  for (let i = 0; i < d.length; i++) sum += d[i];
  const mean = sum / d.length;
  return mean > 0 ? (mean * 4) / exposure : 1;
}

export function paintTrail(trail, pixels, lut, exposure = 1) {
  const d = trail.data;
  const inv = 1 / toneScale(trail, exposure);
  for (let i = 0, p = 0; i < d.length; i++, p += 4) {
    const v = 1 - Math.exp(-d[i] * inv);
    const k = Math.min(255, Math.max(0, Math.round(v * 255))) * 3;
    pixels[p] = lut[k];
    pixels[p + 1] = lut[k + 1];
    pixels[p + 2] = lut[k + 2];
    pixels[p + 3] = 255;
  }
}
