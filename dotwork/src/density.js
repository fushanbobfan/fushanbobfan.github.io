// A density field is the picture the dots have to draw: one value per pixel in
// [0, 1], where 1 asks for the most ink. Stored row-major as a Float32Array.

export function createField(width, height, values) {
  const data = values ?? new Float32Array(width * height);
  if (data.length !== width * height) throw new Error('field size does not match its data');
  return { width, height, data };
}

// Rec. 709 luma of 8-bit RGBA pixels, read as darkness: black is 1, white is 0.
// Transparent pixels count as white paper.
export function fieldFromRgba(rgba, width, height) {
  const field = createField(width, height);
  for (let i = 0, p = 0; i < field.data.length; i++, p += 4) {
    const a = rgba[p + 3] / 255;
    const luma = (2126 * rgba[p] + 7152 * rgba[p + 1] + 722 * rgba[p + 2]) / 2550000;
    field.data[i] = Math.min(1, Math.max(0, 1 - (luma * a + (1 - a))));
  }
  return field;
}

// The picture's own colours, composited over white paper, one RGB triple per
// pixel. Dots can take their colour from this while density decides where
// they go.
export function colourFromRgba(rgba, width, height) {
  const n = width * height;
  const rgb = new Uint8ClampedArray(3 * n);
  for (let i = 0; i < n; i++) {
    const a = rgba[4 * i + 3] / 255;
    for (let c = 0; c < 3; c++) rgb[3 * i + c] = rgba[4 * i + c] * a + 255 * (1 - a);
  }
  return { width, height, rgb };
}

// Tone controls applied before stippling: brightness shifts, contrast scales
// around mid grey, gamma bends the curve, invert swaps ink and paper. Values
// below `floor` become exact zero so pale paper stays empty.
export function adjustField(field, { brightness = 0, contrast = 1, gamma = 1, invert = false, floor = 0 } = {}) {
  const out = createField(field.width, field.height);
  for (let i = 0; i < field.data.length; i++) {
    let v = field.data[i];
    if (invert) v = 1 - v;
    v = (v - 0.5) * contrast + 0.5 - brightness;
    v = Math.min(1, Math.max(0, v));
    v = Math.pow(v, gamma);
    out.data[i] = v < floor ? 0 : v;
  }
  return out;
}

export function fieldMean(field) {
  let s = 0;
  for (let i = 0; i < field.data.length; i++) s += field.data[i];
  return s / field.data.length;
}

// Box-filter resample: each output pixel averages the input pixels it covers,
// which brings a large uploaded photo down to the working resolution cleanly.
export function resizeField(field, width, height) {
  const out = createField(width, height);
  const sx = field.width / width;
  const sy = field.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let s = 0;
      let n = 0;
      for (let yy = y0; yy < y1 && yy < field.height; yy++) {
        for (let xx = x0; xx < x1 && xx < field.width; xx++) {
          s += field.data[yy * field.width + xx];
          n++;
        }
      }
      out.data[y * width + x] = n ? s / n : 0;
    }
  }
  return out;
}

// Size that fits inside `maxSide` on the long edge while keeping the aspect ratio.
export function fitSize(width, height, maxSide) {
  const k = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}
