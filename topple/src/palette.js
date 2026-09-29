// Colours for the four stable heights (0-3 grains) and for cells still
// holding four or more while an avalanche is being animated.

export const PALETTES = {
  dune: { label: 'Dune', colors: ['#1b1410', '#6b3f22', '#d98e3f', '#f6dcaa'], hot: '#ffffff' },
  tide: { label: 'Tide', colors: ['#06121f', '#15517a', '#3fa3c9', '#d9f3ff'], hot: '#ffe066' },
  ember: { label: 'Ember', colors: ['#0d0507', '#74162d', '#e0472f', '#ffd35c'], hot: '#ffffff' },
  paper: { label: 'Paper', colors: ['#fbf8f1', '#bfb6a8', '#6e665b', '#1f1c19'], hot: '#d6333a' },
};

export const DEFAULT_PALETTE = 'dune';

export function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`bad colour ${hex}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Pack to the little-endian RGBA word ImageData expects on a Uint32Array.
export function packRgba([r, g, b], a = 255) {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

// Five packed words: heights 0..3, then the colour for unstable cells.
export function paletteWords(name) {
  const p = PALETTES[name] || PALETTES[DEFAULT_PALETTE];
  return Uint32Array.from([...p.colors, p.hot].map((c) => packRgba(hexToRgb(c))));
}

// Relative luminance per WCAG 2, used to check the heights read as a ramp.
export function luminance(hex) {
  const lin = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
