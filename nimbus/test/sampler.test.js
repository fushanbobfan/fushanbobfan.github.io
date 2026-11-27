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

test('node counts and the node sentence', async () => {
  const { nodeCounts, describeNodes } = await import('../src/names.js');
  assert.deepEqual(nodeCounts(2, 1, 0), { spheres: 0, planes: 1, cones: 0 });
  assert.deepEqual(nodeCounts(3, 2, 0), { spheres: 0, planes: 0, cones: 2 });
  assert.deepEqual(nodeCounts(4, 3, -2), { spheres: 0, planes: 3, cones: 0 });
  assert.deepEqual(nodeCounts(4, 3, 0), { spheres: 0, planes: 1, cones: 2 });
  assert.deepEqual(nodeCounts(3, 0, 0), { spheres: 2, planes: 0, cones: 0 });
  for (let n = 1; n <= MAX_N; n++) {
    for (let l = 0; l < n; l++) {
      for (let m = -l; m <= l; m++) {
        const c = nodeCounts(n, l, m);
        assert.equal(c.spheres + c.planes + c.cones, n - 1);
      }
    }
  }
  assert.equal(describeNodes(4, 3, -2), 'Nodes: no spheres, 3 planes through the nucleus. That makes 3, n − 1 for every orbital of shell 4.');
  assert.equal(describeNodes(2, 0, 0), 'Nodes: 1 sphere, nothing through the nucleus. That makes 1, n − 1 for every orbital of shell 2.');
});

test('the radial envelope sits above r^2 R^2 everywhere and the cut-off tail is negligible', async () => {
  const { radialEnvelope } = await import('../src/sampler.js');
  const { radialTable, radialDensity } = await import('../src/hydrogen.js');
  for (let n = 1; n <= MAX_N; n++) {
    for (let l = 0; l < n; l++) {
      const t = radialTable(n, l);
      const { r, ceiling } = radialEnvelope(n, l, t);
      for (let i = 0; i < ceiling.length; i++) {
        for (let q = 0; q <= 16; q++) {
          const x = r[i] + (q / 16) * (r[i + 1] - r[i]);
          assert.ok(radialDensity(n, l, x) <= ceiling[i], `n=${n} l=${l} cell ${i}`);
        }
      }
      // Probability beyond the table's last radius.
      const a = t.rMax;
      const b = 4 * t.rMax;
      const N = 4000;
      const h = (b - a) / N;
      let tail = radialDensity(n, l, a) + radialDensity(n, l, b);
      for (let i = 1; i < N; i++) tail += radialDensity(n, l, a + i * h) * (i % 2 ? 4 : 2);
      tail *= h / 3;
      assert.ok(tail < 1e-15, `n=${n} l=${l} tail ${tail}`);
    }
  }
});

test('1s radii pass a Kolmogorov-Smirnov test against the exact distribution', () => {
  const N = 40000;
  const s = sampleOrbital(1, 0, 0, N, 21);
  const sorted = Array.from(s.radii).sort((a, b) => a - b);
  const cdf = (R) => 1 - Math.exp(-2 * R) * (1 + 2 * R + 2 * R * R);
  let D = 0;
  for (let i = 0; i < N; i++) {
    const F = cdf(sorted[i]);
    D = Math.max(D, Math.abs(F - i / N), Math.abs(F - (i + 1) / N));
  }
  // 1.63 / sqrt(N) is the 1% critical value.
  assert.ok(D < 1.63 / Math.sqrt(N), `D = ${D}`);
  // Near the nucleus: P(r < 0.2) = 0.00791.
  const near = sorted.filter((r) => r < 0.2).length / N;
  assert.ok(Math.abs(near - cdf(0.2)) < 4 * Math.sqrt(cdf(0.2) / N));
});

test('sampled azimuths follow the orbital, not only the polar angle', () => {
  const N = 40000;
  const moments = (n, l, m) => {
    const s = sampleOrbital(n, l, m, N, 9);
    const acc = { xx: 0, yy: 0, cos: 0, sin: 0, cos2: 0, sin2: 0, cos4: 0 };
    for (let k = 0; k < N; k++) {
      const x = s.positions[3 * k];
      const y = s.positions[3 * k + 1];
      const r = s.radii[k];
      const phi = Math.atan2(y, x);
      acc.xx += (x / r) ** 2;
      acc.yy += (y / r) ** 2;
      acc.cos += Math.cos(phi);
      acc.sin += Math.sin(phi);
      acc.cos2 += Math.cos(2 * phi);
      acc.sin2 += Math.sin(2 * phi);
      acc.cos4 += Math.cos(4 * phi);
    }
    for (const key in acc) acc[key] /= N;
    return acc;
  };
  // p_x: <x^2/r^2> = 3/5, <y^2/r^2> = 1/5.
  const px = moments(2, 1, 1);
  assert.ok(Math.abs(px.xx - 0.6) < 0.01 && Math.abs(px.yy - 0.2) < 0.01, JSON.stringify(px));
  const py = moments(2, 1, -1);
  assert.ok(Math.abs(py.yy - 0.6) < 0.01 && Math.abs(py.xx - 0.2) < 0.01, JSON.stringify(py));
  // d_z2 and s: no preferred azimuth.
  for (const [n, l, m] of [[3, 2, 0], [2, 0, 0]]) {
    const a = moments(n, l, m);
    for (const key of ['cos', 'sin', 'cos2', 'sin2']) assert.ok(Math.abs(a[key]) < 0.02, `${n}${l}${m} ${key} ${a[key]}`);
  }
  // Weight cos^2(2 phi) for d_x2-y2 and sin^2(2 phi) for d_xy: <cos 4 phi> = +1/2
  // with lobes on the axes, -1/2 with lobes on the diagonals.
  const dx2y2 = moments(3, 2, 2);
  assert.ok(Math.abs(dx2y2.cos4 - 0.5) < 0.02, `${dx2y2.cos4}`);
  const dxy = moments(3, 2, -2);
  assert.ok(Math.abs(dxy.cos4 + 0.5) < 0.02, `${dxy.cos4}`);
});
