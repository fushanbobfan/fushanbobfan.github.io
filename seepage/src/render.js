// Turns a labelled grid into RGBA pixels. Site grids give one pixel per site; bond
// grids give a (2L - 1)-pixel square where sites sit on even coordinates and the
// pixel between two sites shows the bond joining them.

import { downOpen, rightOpen } from './lattice.js';

export const COLOURINGS = ['clusters', 'spanning', 'size'];

export const PALETTES = {
  ink: { closed: '#f4f1ea', idle: '#d9d3c7', span: '#c2410c', hues: [205, 330], sat: 0.45, light: 0.5, ramp: ['#cfd8e3', '#1e3a5f'], burn: ['#f59e0b', '#5b1a0b'] },
  ember: { closed: '#14110f', idle: '#2b2420', span: '#fde047', hues: [0, 40], sat: 0.7, light: 0.45, ramp: ['#3b1f1a', '#f97316'], burn: ['#fef08a', '#b91c1c'] },
  sea: { closed: '#0b1d2a', idle: '#173447', span: '#f472b6', hues: [160, 230], sat: 0.55, light: 0.5, ramp: ['#164e63', '#a5f3fc'], burn: ['#a7f3d0', '#1d4ed8'] },
  paper: { closed: '#ffffff', idle: '#e5e5e5', span: '#111111', hues: [0, 360], sat: 0, light: 0.62, ramp: ['#e5e5e5', '#404040'], burn: ['#b5b5b5', '#111111'] },
};

export function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

// A stable colour for cluster k, spread round the palette's hue range by the golden
// angle so neighbouring labels rarely look alike.
export function clusterColour(palette, k) {
  const [h0, h1] = palette.hues;
  const t = (k * 0.6180339887) % 1;
  const h = (h0 + t * (h1 - h0) + 360) % 360;
  const l = palette.light + ((k * 7) % 5 - 2) * 0.05;
  return hslToRgb(h, palette.sat, Math.max(0.15, Math.min(0.85, l)));
}

function mix(a, b, t) {
  return [0, 1, 2].map((j) => Math.round(a[j] + (b[j] - a[j]) * t));
}

function colourTable(palette, clusters, colouring) {
  const span = hexToRgb(palette.span);
  const idle = hexToRgb(palette.idle);
  const lo = hexToRgb(palette.ramp[0]);
  const hi = hexToRgb(palette.ramp[1]);
  const maxLog = Math.log(Math.max(2, clusters.length ? clusters[0].size : 2));
  return clusters.map((c, k) => {
    if (c.spans) return span;
    if (colouring === 'spanning') return idle;
    if (colouring === 'size') return mix(lo, hi, Math.log(c.size) / maxLog);
    return clusterColour(palette, k);
  });
}

export function gridDimensions(lat) {
  const side = lat.mode === 'bond' ? 2 * lat.size - 1 : lat.size;
  return { width: side, height: side };
}

export function paintGrid(lat, p, { label, clusters }, { colouring = 'clusters', palette = PALETTES.ink, highlight = -1 } = {}) {
  const { width, height } = gridDimensions(lat);
  const data = new Uint8ClampedArray(width * height * 4);
  const closed = hexToRgb(palette.closed);
  const table = colourTable(palette, clusters, colouring);
  const bright = [255, 255, 255];
  const colourOf = (k) => {
    if (k < 0) return closed;
    if (k === highlight) return clusters[k].spans ? bright : hexToRgb(palette.span);
    return table[k];
  };
  const put = (px, rgb) => {
    const o = px * 4;
    data[o] = rgb[0];
    data[o + 1] = rgb[1];
    data[o + 2] = rgb[2];
    data[o + 3] = 255;
  };

  const { size } = lat;
  if (lat.mode === 'site') {
    for (let i = 0; i < label.length; i++) put(i, colourOf(label[i]));
    return { width, height, data };
  }

  // Bond grid: background first, then sites, then the open bonds between them.
  for (let px = 0; px < width * height; px++) put(px, closed);
  for (let i = 0; i < label.length; i++) {
    const x = i % size;
    const y = (i - x) / size;
    const rgb = colourOf(label[i]);
    const at = 2 * y * width + 2 * x;
    // A site with no open bonds is drawn faintly so the lattice stays visible.
    const alone = clusters[label[i]].size === 1;
    put(at, alone ? mix(closed, rgb, 0.35) : rgb);
    if (rightOpen(lat, i, p)) put(at + 1, rgb);
    if (downOpen(lat, i, p)) put(at + width, rgb);
  }
  return { width, height, data };
}

// Which site lies under a pixel of the painted grid (or -1 between sites of a bond grid).
export function siteAtPixel(lat, px, py) {
  const { width } = gridDimensions(lat);
  if (px < 0 || py < 0 || px >= width || py >= width) return -1;
  if (lat.mode === 'site') return py * lat.size + px;
  const x = Math.round(px / 2);
  const y = Math.round(py / 2);
  return Math.min(lat.size - 1, y) * lat.size + Math.min(lat.size - 1, x);
}

// Burning view: cells that have caught by `step` shade from the palette's first burn
// colour (early) to its second (late); the cells catching at `step` are the front.
export function paintBurn(lat, p, { time, steps }, step, { palette = PALETTES.ink } = {}) {
  const { width, height } = gridDimensions(lat);
  const data = new Uint8ClampedArray(width * height * 4);
  const closed = hexToRgb(palette.closed);
  const idle = hexToRgb(palette.idle);
  const front = hexToRgb(palette.span);
  const early = hexToRgb(palette.burn[0]);
  const late = hexToRgb(palette.burn[1]);
  const span = Math.max(1, steps);
  const colourAt = (i) => {
    const t = time[i];
    if (t < 0 || t > step) return idle;
    if (t === step) return front;
    return mix(early, late, t / span);
  };
  const put = (px, rgb) => {
    const o = px * 4;
    data[o] = rgb[0];
    data[o + 1] = rgb[1];
    data[o + 2] = rgb[2];
    data[o + 3] = 255;
  };
  const { size } = lat;
  if (lat.mode === 'site') {
    for (let i = 0; i < time.length; i++) put(i, lat.site[i] < p ? colourAt(i) : closed);
    return { width, height, data };
  }
  for (let px = 0; px < width * height; px++) put(px, closed);
  for (let i = 0; i < time.length; i++) {
    const x = i % size;
    const y = (i - x) / size;
    const at = 2 * y * width + 2 * x;
    put(at, colourAt(i));
    // A bond takes the colour of whichever end caught first.
    const first = (j) => (time[j] >= 0 && (time[i] < 0 || time[j] < time[i]) ? j : i);
    if (rightOpen(lat, i, p)) put(at + 1, colourAt(first(i + 1)));
    if (downOpen(lat, i, p)) put(at + width, colourAt(first(i + size)));
  }
  return { width, height, data };
}
