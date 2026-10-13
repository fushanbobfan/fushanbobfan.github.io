// Dot colours taken from the picture. Each dot gets the ink-weighted mean
// colour of its Voronoi cell, so a dot drawn on a dark red patch is dark red.

export function dotColours(labels, field, colour, points, count, out) {
  const rgb = out && out.length === 3 * count ? out : new Uint8ClampedArray(3 * count);
  const sum = new Float64Array(3 * count);
  const weight = new Float64Array(count);
  const { data } = field;
  for (let p = 0; p < labels.length; p++) {
    const k = labels[p];
    const w = data[p];
    if (k < 0 || w <= 0) continue;
    weight[k] += w;
    sum[3 * k] += w * colour.rgb[3 * p];
    sum[3 * k + 1] += w * colour.rgb[3 * p + 1];
    sum[3 * k + 2] += w * colour.rgb[3 * p + 2];
  }
  for (let i = 0; i < count; i++) {
    if (weight[i] > 0) {
      for (let c = 0; c < 3; c++) rgb[3 * i + c] = sum[3 * i + c] / weight[i];
    } else {
      // No ink in the cell: use the pixel under the dot.
      const x = Math.min(field.width - 1, Math.max(0, Math.floor(points[2 * i])));
      const y = Math.min(field.height - 1, Math.max(0, Math.floor(points[2 * i + 1])));
      const p = y * field.width + x;
      for (let c = 0; c < 3; c++) rgb[3 * i + c] = colour.rgb[3 * p + c];
    }
  }
  return rgb;
}

export function toHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

// Dots grouped by colour rounded to `bits` per channel, so a canvas can fill
// each group as one path instead of switching colour for every dot.
export function colourGroups(rgb, count, bits = 5) {
  const shift = 8 - bits;
  const groups = new Map();
  for (let i = 0; i < count; i++) {
    const key = ((rgb[3 * i] >> shift) << (2 * bits)) | ((rgb[3 * i + 1] >> shift) << bits) | (rgb[3 * i + 2] >> shift);
    let g = groups.get(key);
    if (!g) {
      const mid = (v) => ((v >> shift) << shift) + (1 << shift) / 2;
      g = { colour: toHex(mid(rgb[3 * i]), mid(rgb[3 * i + 1]), mid(rgb[3 * i + 2])), dots: [] };
      groups.set(key, g);
    }
    g.dots.push(i);
  }
  return [...groups.values()];
}
