import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angularProfile, colourProfile, bandRadiance } from '../src/scatter.js';
import { WAVELENGTHS, waterIndex } from '../src/water.js';
import { bowAngle, descartesImpact, orderWeights, rainbowAngle } from '../src/optics.js';
import { airyScale, AIRY_PEAKS } from '../src/airy.js';

const profile = angularProfile({ samples: 8000 });
const W550 = WAVELENGTHS.indexOf(550);
const DEG = 180 / Math.PI;

function peakAngle(w, from, to) {
  const { bins, binDeg, s, p } = profile;
  let best = 0;
  let at = 0;
  for (let b = Math.round(from / binDeg); b < Math.round(to / binDeg); b++) {
    const v = s[w * bins + b] + p[w * bins + b];
    if (v > best) {
      best = v;
      at = (b + 0.5) * binDeg;
    }
  }
  return at;
}

test('each bow is brightest just inside its Descartes angle, blurred by the sun', () => {
  const n = waterIndex(550);
  const primary = bowAngle(n, 1) * DEG;
  const secondary = bowAngle(n, 2) * DEG;
  assert.ok(Math.abs(peakAngle(W550, 30, 46) - primary) < 0.35);
  assert.ok(Math.abs(peakAngle(W550, 48, 60) - secondary) < 0.35);
});

test('the sky between the bows is dark: Alexander\'s band', () => {
  const inside = bandRadiance(profile, 30, 38, W550);
  const band = bandRadiance(profile, 44, 49, W550);
  const outside = bandRadiance(profile, 56, 64, W550);
  assert.equal(band, 0);
  assert.ok(inside > 0 && outside > 0);
  assert.ok(inside > outside, 'the inside of the primary is brighter than outside the secondary');
});

test('the secondary bow is fainter than the primary', () => {
  const { bins, s, p } = profile;
  const max = (from, to) => {
    let m = 0;
    for (let b = from * 20; b < to * 20; b++) m = Math.max(m, s[W550 * bins + b] + p[W550 * bins + b]);
    return m;
  };
  const ratio = max(48, 60) / max(30, 46);
  // Near a caustic the peak scales with w x / (sin α sqrt|α''|), where w is the
  // Fresnel throughput of the rainbow ray and α'' the curvature of α(x).
  const n = waterIndex(550);
  const caustic = (k) => {
    const x = descartesImpact(n, k);
    const w = orderWeights(x, n, k);
    const h = 1e-4;
    const a = (t) => rainbowAngle(t, n, k);
    const curvature = Math.abs(a(x + h) - 2 * a(x) + a(x - h)) / (h * h);
    return ((w.s + w.p) * x) / (Math.sin(a(x)) * Math.sqrt(curvature));
  };
  const expected = caustic(2) / caustic(1);
  assert.ok(Math.abs(ratio / expected - 1) < 0.1, `ratio ${ratio}, caustic estimate ${expected}`);
  assert.ok(ratio < 0.3);
});

test('the primary is red on the outside and blue on the inside', () => {
  const rgb = colourProfile(profile);
  const at = (deg) => {
    const b = Math.round(deg / rgb.binDeg);
    return [0, 1, 2].map((c) => rgb.rgbS[3 * b + c] + rgb.rgbP[3 * b + c]);
  };
  const outer = at(42.2);
  const inner = at(40.7);
  assert.ok(outer[0] > outer[2], `outer ${outer}`);
  assert.ok(inner[2] / inner[0] > outer[2] / outer[0], `inner ${inner}`);
});

test('the profile is deterministic and finite', () => {
  const again = angularProfile({ samples: 8000 });
  assert.deepEqual(again.s, profile.s);
  assert.ok(profile.s.every(Number.isFinite) && profile.p.every(Number.isFinite));
});

test('with a drop size the bow follows Airy: it moves inward and lights its dark side', () => {
  const n = waterIndex(550);
  const ar = bowAngle(n, 1);
  const h = 1e-4;
  const x = descartesImpact(n, 1);
  const curvature = Math.abs(rainbowAngle(x + h, n, 1) - 2 * ar + rainbowAngle(x - h, n, 1)) / (h * h);
  const s = airyScale(curvature, 0.5e-3, 550);
  const wave = angularProfile({ orders: [1], samples: 8000, radius: 0.5e-3, sun: false });
  const rays = angularProfile({ orders: [1], samples: 8000, sun: false });
  const at = (P, deg) => {
    const b = Math.floor(deg / P.binDeg);
    return P.s[W550 * P.bins + b] + P.p[W550 * P.bins + b];
  };
  let best = 0;
  let peak = 0;
  for (let d = 38; d < 44; d += 0.05) {
    if (at(wave, d) > best) {
      best = at(wave, d);
      peak = d;
    }
  }
  const expected = (ar + AIRY_PEAKS[0] / s) * DEG;
  assert.ok(Math.abs(peak - expected) < 0.06, `peak ${peak}, Airy ${expected}`);
  assert.equal(at(rays, ar * DEG + 0.3), 0);
  assert.ok(at(wave, ar * DEG + 0.3) > 0);
});

test('averaged over its fringes the wave profile keeps the brightness of the rays', () => {
  const avg = (P, a, b) => {
    let t = 0;
    let c = 0;
    for (let i = Math.round(a / P.binDeg); i < Math.round(b / P.binDeg); i++) {
      t += P.s[W550 * P.bins + i] + P.p[W550 * P.bins + i];
      c++;
    }
    return t / c;
  };
  for (const [k, tol] of [[1, 0.03], [2, 0.08]]) {
    const ar = bowAngle(waterIndex(550), k) * DEG;
    const wave = angularProfile({ orders: [k], samples: 20000, radius: 0.5e-3 });
    const rays = angularProfile({ orders: [k], samples: 20000 });
    const side = k === 1 ? -1 : 1;
    for (const [a, b] of [[0.8, 2], [2, 4], [4, 6]]) {
      const lo = Math.min(ar + side * a, ar + side * b);
      const hi = Math.max(ar + side * a, ar + side * b);
      const ratio = avg(wave, lo, hi) / avg(rays, lo, hi);
      assert.ok(Math.abs(ratio - 1) < tol, `order ${k}, ${a}-${b}°: ${ratio}`);
    }
  }
});

test('small drops wash the bow toward white', () => {
  const saturation = (radius) => {
    const rgb = colourProfile(angularProfile({ orders: [1], samples: 8000, radius }));
    let best = 0;
    let sat = 0;
    for (let b = Math.round(36 / rgb.binDeg); b < Math.round(44 / rgb.binDeg); b++) {
      const c = [0, 1, 2].map((j) => rgb.rgbS[3 * b + j] + rgb.rgbP[3 * b + j]);
      const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      if (lum > best) {
        best = lum;
        sat = (Math.max(...c) - Math.min(...c)) / Math.max(...c);
      }
    }
    return sat;
  };
  const big = saturation(1e-3);
  const small = saturation(0.05e-3);
  assert.ok(small < big - 0.2, `1 mm ${big}, 0.05 mm ${small}`);
});
