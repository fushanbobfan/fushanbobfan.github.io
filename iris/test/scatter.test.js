import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angularProfile, colourProfile, bandRadiance } from '../src/scatter.js';
import { WAVELENGTHS, waterIndex } from '../src/water.js';
import { bowAngle, descartesImpact, orderWeights, rainbowAngle } from '../src/optics.js';

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
