import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeOrbital, radialTable } from '../src/hydrogen.js';
import { sampleOrbital, peakDensity } from '../src/sampler.js';
import { sliceValues, shadeSlice, POSITIVE, NEGATIVE, MIXED } from '../src/slice.js';
import { viewMatrix, project, renderCloud } from '../src/cloud.js';
import { histogram, niceStep } from '../src/chart.js';

test('a slice shows the orbital the right way up', () => {
  const pz = makeOrbital(2, 1, 0);
  const s = sliceValues(pz.psi, 'xz', 10, 64);
  // Top half (z > 0) positive, bottom half negative, mirror images.
  for (let j = 0; j < 32; j++) {
    for (let i = 0; i < 64; i++) {
      const top = s.values[j * 64 + i];
      const bottom = s.values[(63 - j) * 64 + i];
      assert.ok(top > 0 && bottom < 0);
      assert.ok(Math.abs(top + bottom) < 1e-12);
    }
  }
  const px = shadeSlice(s, 'linear');
  const centreTop = (16 * 64 + 32) * 4;
  assert.ok(px[centreTop] > px[centreTop + 2], 'positive lobe drawn warm');
});

test('a nodal plane comes out as zero', () => {
  const py = makeOrbital(2, 1, -1);
  const s = sliceValues(py.psi, 'xz', 10, 32);
  assert.ok(s.peak <= 1e-9 * peakDensity(2, 1, -1));
  const fxyz = makeOrbital(4, 3, -2);
  for (const plane of ['xz', 'xy', 'yz']) {
    assert.ok(sliceValues(fxyz.psi, plane, 30, 32).peak <= 1e-9 * peakDensity(4, 3, -2));
  }
});

test('log shading spans four decades and keeps the sign colours', () => {
  const s = { values: Float64Array.from([1, -1, 0.1, 1e-2, 1e-5]), peak: 1, size: 1 };
  const px = shadeSlice(s, 'log', new Uint8ClampedArray(20));
  assert.deepEqual([...px.slice(0, 3)], POSITIVE);
  assert.deepEqual([...px.slice(4, 7)], NEGATIVE);
  // |psi| = 0.1 is density 1e-2: two decades down, half brightness.
  assert.ok(Math.abs(px[8] - POSITIVE[0] / 2) <= 1);
  assert.equal(px[16], 0);
});

test('peak density is the largest |psi|^2', () => {
  // 1s: psi(0) = 2 Y00 = 1/sqrt(pi).
  assert.ok(Math.abs(peakDensity(1, 0, 0) - 1 / Math.PI) < 1e-12);
  const orb = makeOrbital(3, 2, 0);
  const peak = peakDensity(3, 2, 0);
  let best = 0;
  for (let k = 0; k <= 4000; k++) {
    const r = (k / 4000) * 20;
    best = Math.max(best, orb.psi(0, 0, r) ** 2);
  }
  assert.ok(Math.abs(best - peak) / peak < 1e-3);
});

test('the view matrix is a rotation and starts looking along +y with z up', () => {
  for (const [yaw, pitch] of [[0, 0], [0.7, -0.3], [2, 1.2]]) {
    const M = viewMatrix(yaw, pitch);
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        const dot = M[a][0] * M[b][0] + M[a][1] * M[b][1] + M[a][2] * M[b][2];
        assert.ok(Math.abs(dot - (a === b ? 1 : 0)) < 1e-12);
      }
    }
    // Right-handed: right x up = towards the viewer.
    const [r, u, t] = M;
    const cross = [r[1] * u[2] - r[2] * u[1], r[2] * u[0] - r[0] * u[2], r[0] * u[1] - r[1] * u[0]];
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(cross[i] - t[i]) < 1e-12);
  }
  const M = viewMatrix(0, 0);
  assert.deepEqual(project(M, 0, 0, 1).map((v) => Math.round(v)), [0, 1, 0]);
  assert.deepEqual(project(M, 1, 0, 0).map((v) => Math.round(v)), [1, 0, 0]);
});

test('the cloud lights the lobes and leaves the nodal plane dark', () => {
  const sample = sampleOrbital(2, 1, 0, 20000, 2);
  const size = 64;
  const px = renderCloud(sample, viewMatrix(0, 0), 12, size);
  const brightness = (j) => {
    let s = 0;
    for (let i = 0; i < size; i++) s += px[4 * (j * size + i)] + px[4 * (j * size + i) + 2];
    return s;
  };
  // p_z seen side on: rows through the lobes outshine the row at z = 0.
  assert.ok(brightness(18) > 3 * brightness(32));
  // Upper lobe positive (warm), lower negative (cool).
  const row = (j, c) => { let s = 0; for (let i = 0; i < size; i++) s += px[4 * (j * size + i) + c]; return s; };
  assert.ok(row(18, 0) > row(18, 2));
  assert.ok(row(46, 2) > row(46, 0));
});

test('the histogram is a density that integrates to the share in view', () => {
  const t = radialTable(2, 0);
  const sample = sampleOrbital(2, 0, 0, 20000, 4, t);
  const rView = 20;
  const h = histogram(sample.radii, sample.count, rView, 50);
  const area = h.reduce((a, b) => a + b, 0) * (rView / 50);
  let inside = 0;
  for (let k = 0; k < sample.count; k++) if (sample.radii[k] < rView) inside++;
  assert.ok(Math.abs(area - inside / sample.count) < 1e-9);
  assert.equal(niceStep(24, 6), 5);
  assert.equal(niceStep(7, 6), 2);
  assert.equal(niceStep(70, 6), 20);
});

test('a weighted cloud with signs keeps both colours', () => {
  const sample = {
    positions: Float32Array.from([0, 0, 3, 0, 0, -3]),
    signs: Int8Array.from([1, -1]),
    count: 2,
  };
  const size = 32;
  const px = renderCloud(sample, viewMatrix(0, 0), 6, size, undefined, Float32Array.from([1, 1]), 0.5);
  const at = (z) => 4 * (Math.round((6 - z) * (size / 12) - 0.5) * size + Math.round(6 * (size / 12) - 0.5));
  assert.ok(px[at(3)] > px[at(3) + 2], 'upper dot warm');
  assert.ok(px[at(-3) + 2] > px[at(-3)], 'lower dot cool');
  // Unsigned dots take the mix colour, scaled by their weight; weight 0 is dark.
  const mono = renderCloud({ positions: sample.positions, count: 2 }, viewMatrix(0, 0), 6, size, undefined, Float32Array.from([2, 0]), 0.5);
  const lit = mono.slice(at(3), at(3) + 3);
  const ratio = (a, b) => a / b;
  assert.ok(Math.abs(ratio(lit[0], lit[2]) - MIXED[0] / MIXED[2]) < 0.02, `${lit}`);
  assert.ok(Math.abs(ratio(lit[1], lit[2]) - MIXED[1] / MIXED[2]) < 0.02, `${lit}`);
  assert.deepEqual([...mono.slice(at(-3), at(-3) + 3)], [0, 0, 0]);
});
