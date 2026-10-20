// Lenia's two rule functions: the ring-shaped kernel that each cell uses to
// sense its neighbourhood, and the growth mapping from what it senses to how
// its own value changes. Bert Chan's original Lenia defines both.

// Smooth bump on (0, 1), zero at both ends, peak 1 at r = 1/2.
export function kernelCore(r) {
  if (r <= 0 || r >= 1) return 0;
  return Math.exp(4 - 1 / (r * (1 - r)));
}

// Parses ring heights written as "1", "1,1/3" or "3/4,1,1/2".
export function parseRings(text) {
  const parts = String(text).split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0 || parts.length > 4) throw new RangeError(`expected 1 to 4 ring heights, got "${text}"`);
  return parts.map((p) => {
    const m = /^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/.exec(p);
    if (!m) throw new RangeError(`bad ring height "${p}"`);
    const v = Number(m[1]) / (m[2] ? Number(m[2]) : 1);
    if (!(v >= 0 && v <= 1) || !Number.isFinite(v)) throw new RangeError(`ring height out of [0, 1]: "${p}"`);
    return v;
  });
}

export function formatRings(rings) {
  const known = [[1 / 2, '1/2'], [1 / 3, '1/3'], [2 / 3, '2/3'], [1 / 4, '1/4'], [3 / 4, '3/4'], [1 / 6, '1/6'], [5 / 6, '5/6']];
  return rings
    .map((v) => {
      for (const [x, s] of known) if (Math.abs(v - x) < 1e-9) return s;
      return String(Number(v.toFixed(4)));
    })
    .join(',');
}

// Kernel value at distance d (in cells) for radius R and ring heights.
// The disc of radius R is split into equal-width rings, each a scaled bump.
export function kernelShell(d, R, rings) {
  const r = d / R;
  if (r >= 1) return 0;
  const B = rings.length;
  const br = r * B;
  const idx = Math.min(Math.floor(br), B - 1);
  return rings[idx] * kernelCore(br - idx);
}

// Kernel radial profile, sampled at `samples` points over [0, 1] of the radius.
export function kernelProfile(rings, samples = 200) {
  const out = new Float64Array(samples);
  for (let i = 0; i < samples; i++) out[i] = kernelShell(i / (samples - 1), 1, rings);
  return out;
}

// Growth: +1 when the sensed value u equals mu, falling to -1 away from it.
export function growth(u, mu, sigma) {
  const z = (u - mu) / sigma;
  return 2 * Math.exp(-0.5 * z * z) - 1;
}

// The band of u where growth is positive: mu +/- sigma * sqrt(2 ln 2).
export function growthBand(mu, sigma) {
  const w = sigma * Math.sqrt(2 * Math.LN2);
  return [mu - w, mu + w];
}
