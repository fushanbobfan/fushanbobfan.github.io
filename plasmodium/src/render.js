// Turns the trail into pixels: a tone curve squeezes any amount of trail into
// [0, 1), and a 256-entry palette turns that into colour.

export const PALETTES = {
  slime: { label: 'Slime', stops: ['#05060a', '#1f3a10', '#8fbf1f', '#f2f08a', '#ffffff'], wall: '#4a4f58', colonies: ['#c6f04a', '#ff5fa2', '#5fc8ff'] },
  ember: { label: 'Ember', stops: ['#080404', '#4a0d0d', '#c2410c', '#fbbf24', '#fff7d6'], wall: '#3f4652', colonies: ['#ffb238', '#7ad7ff', '#e7e7e7'] },
  tide: { label: 'Tide', stops: ['#03070d', '#0b2e4f', '#1d7fa8', '#7fe0e6', '#f2ffff'], wall: '#4d4640', colonies: ['#7fe0e6', '#ffd166', '#ef6f9a'] },
  ink: { label: 'Ink on paper', stops: ['#f6f1e7', '#d9cdb4', '#8a7a5f', '#3a3226', '#0e0c09'], wall: '#9fb0c2', colonies: ['#1f3b73', '#b0302a', '#2f6b2a'] },
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

// Walls, if the trail has any, are painted flat in `wall` ([r, g, b]).
export function paintTrail(trail, pixels, lut, exposure = 1, wall = [80, 80, 80]) {
  const d = trail.data;
  const walls = trail.wallCount > 0 ? trail.walls : null;
  const inv = 1 / toneScale(trail, exposure);
  for (let i = 0, p = 0; i < d.length; i++, p += 4) {
    if (walls && walls[i]) {
      pixels[p] = wall[0];
      pixels[p + 1] = wall[1];
      pixels[p + 2] = wall[2];
      pixels[p + 3] = 255;
      continue;
    }
    const v = 1 - Math.exp(-d[i] * inv);
    const k = Math.min(255, Math.max(0, Math.round(v * 255))) * 3;
    pixels[p] = lut[k];
    pixels[p + 1] = lut[k + 1];
    pixels[p + 2] = lut[k + 2];
    pixels[p + 3] = 255;
  }
}

// Several colonies: starting from the background, each colony's colour is
// laid over the pixel with an opacity from the same tone curve, using one
// scale for all colonies so their brightness stays comparable.
export function paintColonies(layers, pixels, palette, exposure = 1, wall = [80, 80, 80]) {
  const first = layers[0];
  const n = first.data.length;
  let sum = 0;
  for (const l of layers) for (let i = 0; i < n; i++) sum += l.data[i];
  const mean = sum / n;
  const inv = mean > 0 ? exposure / (mean * 4) : 1;
  const bg = hexToRgb(palette.stops[0]);
  const cols = palette.colonies.map(hexToRgb);
  const walls = first.wallCount > 0 ? first.walls : null;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    let r = bg[0];
    let g = bg[1];
    let b = bg[2];
    if (walls && walls[i]) {
      [r, g, b] = wall;
    } else {
      for (let k = 0; k < layers.length; k++) {
        const v = layers[k].data[i];
        if (v <= 0) continue;
        const a = 1 - Math.exp(-v * inv);
        const c = cols[k % cols.length];
        r += (c[0] - r) * a;
        g += (c[1] - g) * a;
        b += (c[2] - b) * a;
      }
    }
    pixels[p] = r;
    pixels[p + 1] = g;
    pixels[p + 2] = b;
    pixels[p + 3] = 255;
  }
}
