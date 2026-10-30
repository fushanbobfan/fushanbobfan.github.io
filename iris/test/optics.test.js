import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waterIndex, CAUCHY_A, CAUCHY_B } from '../src/water.js';
import {
  deviation, scatteringAngle, rainbowAngle, descartesImpact, bowAngle,
  fresnel, orderWeights, tracePath,
} from '../src/optics.js';

const DEG = 180 / Math.PI;

test('the Cauchy fit passes through its two lines and gives water its usual index', () => {
  assert.ok(Math.abs(waterIndex(656.3) - 1.3311) < 1e-9);
  assert.ok(Math.abs(waterIndex(486.1) - 1.3371) < 1e-9);
  assert.ok(Math.abs(waterIndex(589.3) - 1.333) < 5e-4);
  assert.ok(CAUCHY_A > 1.32 && CAUCHY_A < 1.33);
  assert.ok(CAUCHY_B > 3000 && CAUCHY_B < 3300);
});

test('a ray through the centre comes straight back after one reflection', () => {
  assert.ok(Math.abs(deviation(0, 1.333, 1) - Math.PI) < 1e-12);
  assert.ok(Math.abs(rainbowAngle(0, 1.333, 1)) < 1e-12);
  assert.ok(Math.abs(scatteringAngle(3 * Math.PI / 2) - Math.PI / 2) < 1e-12);
});

test('the traced path stays on the drop and leaves at the closed-form deviation', () => {
  const n = 1.333;
  for (const k of [0, 1, 2, 3]) {
    for (const x of [0.05, 0.3, 0.6, 0.86, 0.99]) {
      const { points, out } = tracePath(x, n, k);
      for (const p of points.slice(1)) assert.ok(Math.abs(Math.hypot(p[0], p[1]) - 1) < 1e-9);
      assert.equal(points.length, k + 3);
      assert.ok(Math.abs(Math.hypot(out[0], out[1]) - 1) < 1e-12);
      const traced = Math.acos(Math.max(-1, Math.min(1, out[0])));
      assert.ok(Math.abs(traced - scatteringAngle(deviation(x, n, k))) < 1e-9, `k=${k} x=${x}`);
    }
  }
});

test('the Descartes ray is where the rainbow angle stops growing', () => {
  for (const k of [1, 2]) {
    for (const lambda of [400, 550, 700]) {
      const n = waterIndex(lambda);
      let best = 0;
      let bestAngle = k === 1 ? -Infinity : Infinity;
      for (let j = 1; j < 200000; j++) {
        const x = j / 200000;
        const a = rainbowAngle(x, n, k);
        if (k === 1 ? a > bestAngle : a < bestAngle) {
          bestAngle = a;
          best = x;
        }
      }
      assert.ok(Math.abs(best - descartesImpact(n, k)) < 1e-4);
      assert.ok(Math.abs(bestAngle - bowAngle(n, k)) < 1e-8);
    }
  }
});

test('the primary bow sits near 42° with red outside, the secondary near 51° reversed', () => {
  const red1 = bowAngle(waterIndex(700), 1) * DEG;
  const violet1 = bowAngle(waterIndex(400), 1) * DEG;
  const red2 = bowAngle(waterIndex(700), 2) * DEG;
  const violet2 = bowAngle(waterIndex(400), 2) * DEG;
  assert.ok(red1 > 42 && red1 < 42.6, `red primary ${red1}`);
  assert.ok(violet1 > 40.4 && violet1 < 41, `violet primary ${violet1}`);
  assert.ok(red2 > 50 && red2 < 51, `red secondary ${red2}`);
  assert.ok(violet2 > 53 && violet2 < 54, `violet secondary ${violet2}`);
  assert.ok(red1 > violet1 && red2 < violet2);
});

test('Fresnel reflectance: normal incidence, Brewster angle and total reflection', () => {
  const n = 1.333;
  const r0 = ((n - 1) / (n + 1)) ** 2;
  const f0 = fresnel(0, 1, n);
  assert.ok(Math.abs(f0.rs - r0) < 1e-12 && Math.abs(f0.rp - r0) < 1e-12);
  assert.ok(fresnel(Math.atan(n), 1, n).rp < 1e-20);
  assert.deepEqual(fresnel(Math.PI / 3, n, 1), { rs: 1, rp: 1 });
  for (const t of [0.2, 0.7, 1.2]) {
    const out = fresnel(t, 1, n);
    const back = fresnel(Math.asin(Math.sin(t) / n), n, 1);
    assert.ok(Math.abs(out.rs - back.rs) < 1e-12 && Math.abs(out.rp - back.rp) < 1e-12);
  }
});

test('the rainbow ray is mostly polarized along the bow', () => {
  const n = waterIndex(550);
  const w = orderWeights(descartesImpact(n, 1), n, 1);
  const degree = (w.s - w.p) / (w.s + w.p);
  assert.ok(degree > 0.9, `primary polarization ${degree}`);
  const total = (w.s + w.p) / 2;
  assert.ok(total > 0.03 && total < 0.06, `primary throughput ${total}`);
});
