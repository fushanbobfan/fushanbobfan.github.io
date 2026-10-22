// Cell colours. Colours are packed as 32-bit RGBA in canvas byte order
// (little-endian: red in the low byte), ready to write into ImageData.

export const MODES = {
  growth: 'Growth rings',
  thickness: 'Ice thickness',
  vapour: 'Vapour field',
};

const ICE_GROWTH = [[0, [28, 58, 110]], [0.55, [96, 168, 214]], [1, [236, 247, 255]]];
const ICE_THICK = [[0, [40, 76, 124]], [0.5, [146, 196, 234]], [1, [255, 255, 255]]];
const AIR = [[0, [4, 6, 12]], [1, [26, 40, 66]]];
const FIELD = [[0, [0, 0, 0]], [0.6, [40, 80, 150]], [1, [150, 200, 255]]];

// Linear interpolation along colour stops [[t, [r, g, b]], ...], t clamped.
export function ramp(stops, t) {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    if (x <= t1) {
      const [t0, c0] = stops[i - 1];
      const f = t1 === t0 ? 1 : (x - t0) / (t1 - t0);
      return c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
    }
  }
  return stops[stops.length - 1][1].slice();
}

export function pack([r, g, b], a = 255) {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function unpack(v) {
  return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24];
}

// Fill `out` (one entry per cell) with the colour of every cell.
export function cellColors(model, mode, out = new Uint32Array(model.grid.count)) {
  const { s, ice, frozenAt, grid } = model;
  const n = grid.count;
  let maxIce = 1;
  let maxAir = 0;
  let lastFrozen = 1;
  for (let c = 0; c < n; c++) {
    if (ice[c]) {
      if (s[c] > maxIce) maxIce = s[c];
      if (frozenAt[c] > lastFrozen) lastFrozen = frozenAt[c];
    } else if (s[c] > maxAir) {
      maxAir = s[c];
    }
  }
  for (let c = 0; c < n; c++) {
    let rgb;
    if (mode === 'vapour') {
      rgb = ice[c] ? [255, 255, 255] : ramp(FIELD, maxAir > 0 ? s[c] / maxAir : 0);
    } else if (!ice[c]) {
      rgb = ramp(AIR, s[c]);
    } else if (mode === 'thickness') {
      rgb = ramp(ICE_THICK, maxIce > 1 ? (s[c] - 1) / (maxIce - 1) : 0);
    } else {
      rgb = ramp(ICE_GROWTH, frozenAt[c] / lastFrozen);
    }
    out[c] = pack(rgb);
  }
  return out;
}
