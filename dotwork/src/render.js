// Pixel layers for the views that are images rather than shapes: the picture
// itself in the chosen palette, and the Voronoi cells with their borders.

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// Density drawn as ink over paper, at `strength` of full tone.
export function pictureRgba(field, ink, paper, strength = 1, out) {
  const n = field.width * field.height;
  const px = out && out.length === 4 * n ? out : new Uint8ClampedArray(4 * n);
  const i0 = hexToRgb(ink);
  const p0 = hexToRgb(paper);
  for (let i = 0; i < n; i++) {
    const c = mix(p0, i0, field.data[i] * strength);
    px[4 * i] = c[0];
    px[4 * i + 1] = c[1];
    px[4 * i + 2] = c[2];
    px[4 * i + 3] = 255;
  }
  return px;
}

// Cells over a faint copy of the picture, with a border wherever a pixel's
// right or lower neighbour belongs to a different dot.
export function cellsRgba(labels, field, ink, paper, out) {
  const { width, height } = field;
  const px = pictureRgba(field, ink, paper, 0.25, out);
  const edge = mix(hexToRgb(paper), hexToRgb(ink), 0.7);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const k = labels[i];
      const border = (x + 1 < width && labels[i + 1] !== k) || (y + 1 < height && labels[i + width] !== k);
      if (!border) continue;
      px[4 * i] = edge[0];
      px[4 * i + 1] = edge[1];
      px[4 * i + 2] = edge[2];
    }
  }
  return px;
}
