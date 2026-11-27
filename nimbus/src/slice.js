// A cut through the atom: psi on a plane through the nucleus, coloured by
// its sign and shaded by the probability density.

export const PLANES = {
  xz: { label: 'xz plane (y = 0)', h: 'x', v: 'z', at: (a, b) => [a, 0, b] },
  xy: { label: 'xy plane (z = 0)', h: 'x', v: 'y', at: (a, b) => [a, b, 0] },
  yz: { label: 'yz plane (x = 0)', h: 'y', v: 'z', at: (a, b) => [0, a, b] },
};

export const POSITIVE = [255, 168, 92];
export const NEGATIVE = [92, 172, 255];

// psi on a size x size grid covering [-half, half]^2; row 0 is the top edge.
export function sliceValues(psi, plane, half, size) {
  const at = PLANES[plane].at;
  const values = new Float64Array(size * size);
  let peak = 0;
  for (let j = 0; j < size; j++) {
    const b = half - ((j + 0.5) / size) * 2 * half;
    for (let i = 0; i < size; i++) {
      const a = -half + ((i + 0.5) / size) * 2 * half;
      const [x, y, z] = at(a, b);
      const v = psi(x, y, z);
      values[j * size + i] = v;
      const d = v * v;
      if (d > peak) peak = d;
    }
  }
  return { values, peak, size, half, plane };
}

const toSrgb = (t) => (t <= 0.0031308 ? 12.92 * t : 1.055 * t ** (1 / 2.4) - 0.055);

// Linear: density as emitted light. Log: four decades, so faint outer lobes
// and the dark node lines between them show up.
export function shadeSlice(slice, mode, out = new Uint8ClampedArray(slice.size * slice.size * 4), referencePeak = slice.peak) {
  const { values } = slice;
  const decades = 4;
  for (let k = 0; k < values.length; k++) {
    const v = values[k];
    let t = 0;
    if (referencePeak > 0) {
      const rel = (v * v) / referencePeak;
      if (mode === 'log') t = rel > 0 ? Math.max(0, 1 + Math.log10(rel) / decades) : 0;
      else t = toSrgb(Math.min(1, rel));
    }
    const base = v >= 0 ? POSITIVE : NEGATIVE;
    out[4 * k] = base[0] * t;
    out[4 * k + 1] = base[1] * t;
    out[4 * k + 2] = base[2] * t;
    out[4 * k + 3] = 255;
  }
  return out;
}
