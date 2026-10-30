// How bright the rain looks at each angle from the antisolar point.
//
// Rays are spread evenly over the drop's cross-section, so the impact
// parameter is sampled evenly in x². Each ray carries its Fresnel weight to
// the angle it leaves at; dividing by the solid angle of each ring gives the
// radiance seen in that direction. The sun is half a degree wide, so the
// result is blurred by its disc, which also tames the spike at the bow.

import { WAVELENGTHS, waterIndex } from './water.js';
import { rainbowAngle, orderWeights } from './optics.js';
import { spectrumToLinear } from './color.js';

export const SUN_RADIUS_DEG = 0.2666;

export function angularProfile({ orders = [1, 2], samples = 40000, binDeg = 0.05, maxDeg = 90 } = {}) {
  const bins = Math.round(maxDeg / binDeg);
  const nl = WAVELENGTHS.length;
  const s = new Float64Array(nl * bins);
  const p = new Float64Array(nl * bins);
  const toBin = 180 / Math.PI / binDeg;
  for (let w = 0; w < nl; w++) {
    const n = waterIndex(WAVELENGTHS[w]);
    for (let j = 0; j < samples; j++) {
      const x = Math.sqrt((j + 0.5) / samples);
      for (const k of orders) {
        const b = Math.floor(rainbowAngle(x, n, k) * toBin);
        if (b < 0 || b >= bins) continue;
        const wt = orderWeights(x, n, k);
        s[w * bins + b] += wt.s;
        p[w * bins + b] += wt.p;
      }
    }
  }
  // Power per ray, then per steradian of sky.
  for (let b = 0; b < bins; b++) {
    const a0 = (b * binDeg * Math.PI) / 180;
    const a1 = ((b + 1) * binDeg * Math.PI) / 180;
    const omega = 2 * Math.PI * (Math.cos(a0) - Math.cos(a1));
    for (let w = 0; w < nl; w++) {
      s[w * bins + b] /= samples * omega;
      p[w * bins + b] /= samples * omega;
    }
  }
  return { binDeg, bins, s: blurBySun(s, nl, bins, binDeg), p: blurBySun(p, nl, bins, binDeg) };
}

// A disc of radius R seen edge-on along one direction has weight
// proportional to sqrt(1 - (u / R)²) at offset u.
function blurBySun(table, nl, bins, binDeg) {
  const half = Math.ceil(SUN_RADIUS_DEG / binDeg);
  const kernel = [];
  for (let u = -half; u <= half; u++) {
    const t = (u * binDeg) / SUN_RADIUS_DEG;
    kernel.push(t * t < 1 ? Math.sqrt(1 - t * t) : 0);
  }
  const total = kernel.reduce((a, b) => a + b, 0);
  const out = new Float64Array(table.length);
  for (let w = 0; w < nl; w++) {
    for (let b = 0; b < bins; b++) {
      let acc = 0;
      for (let u = -half; u <= half; u++) {
        const q = Math.min(bins - 1, Math.abs(b + u));
        acc += kernel[u + half] * table[w * bins + q];
      }
      out[w * bins + b] = acc / total;
    }
  }
  return out;
}

// Linear RGB per angle bin for each polarization, so a filter can be
// applied per pixel later.
export function colourProfile(profile) {
  const { bins, s, p } = profile;
  const nl = WAVELENGTHS.length;
  const rgbS = new Float64Array(3 * bins);
  const rgbP = new Float64Array(3 * bins);
  const column = new Float64Array(nl);
  for (const [table, out] of [[s, rgbS], [p, rgbP]]) {
    for (let b = 0; b < bins; b++) {
      for (let w = 0; w < nl; w++) column[w] = table[w * bins + b];
      const c = spectrumToLinear(column);
      out.set(c, 3 * b);
    }
  }
  return { binDeg: profile.binDeg, bins, rgbS, rgbP };
}

export function bandRadiance(profile, fromDeg, toDeg, w) {
  const { bins, binDeg, s, p } = profile;
  let sum = 0;
  let count = 0;
  for (let b = Math.ceil(fromDeg / binDeg); b < Math.min(bins, toDeg / binDeg); b++) {
    sum += s[w * bins + b] + p[w * bins + b];
    count++;
  }
  return count ? sum / count : 0;
}
