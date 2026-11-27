import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_N, meanRadius, realHarmonic, harmonicNorm, makeOrbital } from '../src/hydrogen.js';
import { sampleOrbital, angularPeak, mulberry32 } from '../src/sampler.js';
import { orbitalName, shapeLabel } from '../src/names.js';

test('the rejection ceiling sits above the true angular peak', () => {
  for (let l = 0; l < MAX_N; l++) {
    for (let m = -l; m <= l; m++) {
      const norm = harmonicNorm(l, m);
      let fine = 0;
      for (let i = 0; i <= 1440; i++) {
        const c = -1 + i / 720;
        for (let j = 0; j < 720; j++) {
          const v = realHarmonic(l, m, c, (Math.PI * j) / 360, norm);
          if (v * v > fine) fine = v * v;
        }
      }
      assert.ok(angularPeak(l, m) * 1.02 >= fine, `l=${l} m=${m}`);
    }
  }
});

test('sampled radii have the right mean and spread', () => {
  for (const [n, l, m] of [[1, 0, 0], [2, 1, 1], [3, 2, 0], [4, 0, 0], [6, 5, -3]]) {
    const N = 40000;
    const s = sampleOrbital(n, l, m, N, 7);
    let sum = 0;
    let sum2 = 0;
    for (let k = 0; k < N; k++) {
      sum += s.radii[k];
      sum2 += s.radii[k] ** 2;
    }
    const mean = sum / N;
    // <r^2> = n^2 (5 n^2 + 1 - 3 l (l + 1)) / 2
    const r2 = (n * n * (5 * n * n + 1 - 3 * l * (l + 1))) / 2;
    const sd = Math.sqrt(r2 - meanRadius(n, l) ** 2);
    assert.ok(Math.abs(mean - meanRadius(n, l)) < 5 * sd / Math.sqrt(N), `n=${n} l=${l}: ${mean}`);
    assert.ok(Math.abs(sum2 / N - r2) / r2 < 0.03, `n=${n} l=${l} <r^2>`);
  }
});

test('sampled directions follow the angular density', () => {
  const N = 40000;
  // p_z: <cos^2 theta> = 3/5. d_z2: <cos^2 theta> = 11/21.
  for (const [n, l, m, want] of [[2, 1, 0, 3 / 5], [3, 2, 0, 11 / 21], [1, 0, 0, 1 / 3]]) {
    const s = sampleOrbital(n, l, m, N, 3);
    let acc = 0;
    for (let k = 0; k < N; k++) {
      const z = s.positions[3 * k + 2];
      acc += (z / s.radii[k]) ** 2;
    }
    assert.ok(Math.abs(acc / N - want) < 0.01, `l=${l} m=${m}: ${acc / N}`);
  }
});

test('each sample carries the sign of psi where it landed', () => {
  for (const [n, l, m] of [[3, 0, 0], [3, 1, -1], [4, 2, 2], [5, 3, 1]]) {
    const orb = makeOrbital(n, l, m);
    const s = sampleOrbital(n, l, m, 3000, 11);
    let agree = 0;
    for (let k = 0; k < s.count; k++) {
      const v = orb.psi(s.positions[3 * k], s.positions[3 * k + 1], s.positions[3 * k + 2]);
      if (Math.abs(v) < 1e-6 || Math.sign(v) === s.signs[k]) agree++;
    }
    // Float32 positions can land on the wrong side of a node by rounding.
    assert.ok(agree >= s.count - 3, `n=${n} l=${l} m=${m}: ${agree}/${s.count}`);
  }
});

test('the same seed gives the same cloud', () => {
  const a = sampleOrbital(3, 1, 0, 500, 42);
  const b = sampleOrbital(3, 1, 0, 500, 42);
  assert.deepEqual(a.positions, b.positions);
  const rand = mulberry32(5);
  for (let i = 0; i < 1000; i++) {
    const u = rand();
    assert.ok(u >= 0 && u < 1);
  }
});

test('orbital names', () => {
  assert.equal(orbitalName(1, 0, 0), '1s');
  assert.equal(orbitalName(2, 1, 1), '2p x');
  assert.equal(orbitalName(3, 2, 2), '3d x²−y²');
  assert.equal(orbitalName(4, 3, -2), '4f xyz');
  assert.equal(orbitalName(5, 4, -3), '5g m=−3');
  for (let l = 1; l < MAX_N; l++) for (let m = -l; m <= l; m++) assert.ok(shapeLabel(l, m));
});
