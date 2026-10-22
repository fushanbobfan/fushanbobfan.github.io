// Turning the grid into pixels. Pure functions over typed arrays, so they run
// the same in Node tests and on a canvas.

// OKLCH (lightness 0..1, chroma, hue in degrees) to 8-bit sRGB, clamped.
export function oklchToRgb(l, c, h) {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return lin.map((v) => {
    const x = Math.min(1, Math.max(0, v));
    const g = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(g * 255);
  });
}

export const SCHEMES = {
  light: { background: [247, 245, 240], ink: [31, 35, 40], line: [222, 218, 210], lightness: 0.66 },
  dark: { background: [17, 19, 22], ink: [232, 230, 225], line: [38, 41, 46], lightness: 0.76 },
};

// One RGB triple per colour. Colour 0 is the background; with two colours
// the other is plain ink, otherwise the rest walk evenly round the hue
// circle at a fixed lightness so no colour shouts over the others.
export function makePalette(colors, scheme = 'light') {
  const s = SCHEMES[scheme] ?? SCHEMES.light;
  if (colors <= 2) return [s.background, s.ink];
  const out = [s.background];
  for (let i = 1; i < colors; i++) {
    out.push(oklchToRgb(s.lightness, 0.14, 25 + (360 * (i - 1)) / (colors - 1)));
  }
  return out;
}

// Pack [r, g, b] into the little-endian 32-bit layout of ImageData.
export function packRgb([r, g, b]) {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export const MAX_SCALE = 32;
export const HEX_H = Math.sqrt(3) / 2;

// World coordinates are what the view looks at. A square cell (x, y) covers
// [x, x + 1] x [y, y + 1]. A hexagonal cell (q, r) is a pointy-top hexagon
// one unit wide centred on (q + r / 2, r * HEX_H).
export function worldCentre(lattice, x, y) {
  return lattice === 'hex' ? { wx: x + y / 2, wy: y * HEX_H } : { wx: x + 0.5, wy: y + 0.5 };
}

// The hexagon containing a world point, by rounding cube coordinates.
export function hexRound(wx, wy) {
  const rf = wy / HEX_H;
  const qf = wx - rf / 2;
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { x: q || 0, y: r || 0 };
}

export function worldCell(lattice, wx, wy) {
  return lattice === 'hex' ? hexRound(wx, wy) : { x: Math.floor(wx), y: Math.floor(wy) };
}

// The world rectangle covering every cell of a cell box.
export function worldBox(lattice, box) {
  if (lattice !== 'hex') return { minX: box.minX, maxX: box.maxX + 1, minY: box.minY, maxY: box.maxY + 1 };
  const xs = [box.minX + box.minY / 2, box.minX + box.maxY / 2, box.maxX + box.minY / 2, box.maxX + box.maxY / 2];
  return {
    minX: Math.min(...xs) - 0.5,
    maxX: Math.max(...xs) + 0.5,
    minY: box.minY * HEX_H - 0.58,
    maxY: box.maxY * HEX_H + 0.58,
  };
}

// A view puts world point (cx, cy) at the canvas centre at `scale` pixels
// per unit. Fitting frames a cell box with some room to spare.
export function fitView(box, width, height, pad = 0.1, lattice = 'square') {
  const w = worldBox(lattice, box);
  const scale = Math.min(MAX_SCALE, Math.min(width / (w.maxX - w.minX), height / (w.maxY - w.minY)) * (1 - pad));
  return { cx: (w.minX + w.maxX) / 2, cy: (w.minY + w.maxY) / 2, scale };
}

export function cellAt(view, width, height, px, py, lattice = 'square') {
  return worldCell(lattice, view.cx + (px - width / 2) / view.scale, view.cy + (py - height / 2) / view.scale);
}

export function cellCentre(view, width, height, x, y, lattice = 'square') {
  const { wx, wy } = worldCentre(lattice, x, y);
  return { px: width / 2 + (wx - view.cx) * view.scale, py: height / 2 + (wy - view.cy) * view.scale };
}

// Fill a width x height Uint32Array with the grid as seen through the view.
// Each pixel samples the cell under its centre; cells off the grid are
// colour 0. With `line` set and cells at least 8 pixels wide, the first pixel
// row and column of each cell are drawn in the line colour.
export function paintPixels(out, width, height, grid, view, palette32, line = null, lattice = 'square') {
  if (lattice === 'hex') {
    paintHex(out, width, height, grid, view, palette32);
    return;
  }
  const { cells, size, half } = grid;
  const cols = new Int32Array(width);
  const colEdge = new Uint8Array(width);
  const lines = line !== null && view.scale >= 8;
  let prev = NaN;
  for (let px = 0; px < width; px++) {
    const x = Math.floor(view.cx + (px + 0.5 - width / 2) / view.scale);
    cols[px] = x >= -half && x < size - half ? x + half : -1;
    colEdge[px] = lines && x !== prev ? 1 : 0;
    prev = x;
  }
  const bg = palette32[0];
  prev = NaN;
  for (let py = 0; py < height; py++) {
    const y = Math.floor(view.cy + (py + 0.5 - height / 2) / view.scale);
    const rowEdge = lines && y !== prev;
    prev = y;
    const base = py * width;
    if (rowEdge) {
      out.fill(line, base, base + width);
      continue;
    }
    if (y < -half || y >= size - half) {
      out.fill(bg, base, base + width);
    } else {
      const row = (y + half) * size;
      for (let px = 0; px < width; px++) {
        const col = cols[px];
        out[base + px] = colEdge[px] ? line : col < 0 ? bg : palette32[cells[row + col]];
      }
    }
  }
}

function paintHex(out, width, height, grid, view, palette32) {
  const { cells, size, half } = grid;
  const bg = palette32[0];
  for (let py = 0; py < height; py++) {
    const wy = view.cy + (py + 0.5 - height / 2) / view.scale;
    const base = py * width;
    for (let px = 0; px < width; px++) {
      const { x, y } = hexRound(view.cx + (px + 0.5 - width / 2) / view.scale, wy);
      out[base + px] =
        x >= -half && x < size - half && y >= -half && y < size - half ? palette32[cells[(y + half) * size + x + half]] : bg;
    }
  }
}
