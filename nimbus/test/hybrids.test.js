import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HYBRIDS, hybridTerms, hybridDirection, sShare, makeCombination, sampleCombination } from '../src/hybrids.js';

test('each hybrid set is an orthonormal basis', () => {
  for (const kind of Object.keys(HYBRIDS)) {
    const rows = HYBRIDS[kind].rows;
    for (let a = 0; a < rows.length; a++) {
      for (let b = 0; b < rows.length; b++) {
        const dot = rows[a].reduce((s, v, i) => s + v * rows[b][i], 0);
        assert.ok(Math.abs(dot - (a === b ? 1 : 0)) < 1e-12, `${kind} ${a}.${b}`);
      }
    }
    // Every hybrid in a set has the same s share: 1/2, 1/3, 1/4.
    for (const row of rows) assert.ok(Math.abs(row[0] ** 2 - sShare(kind)) < 1e-12);
  }
  assert.ok(Math.abs(sShare('sp') - 1 / 2) < 1e-12);
  assert.ok(Math.abs(sShare('sp2') - 1 / 3) < 1e-12);
  assert.ok(Math.abs(sShare('sp3') - 1 / 4) < 1e-12);
});

test('hybrids point 180, 120 and 109.47 degrees apart', () => {
  for (const [kind, want] of [['sp', 180], ['sp2', 120], ['sp3', 109.4712206]]) {
    const n = HYBRIDS[kind].rows.length;
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const u = hybridDirection(kind, a);
        const v = hybridDirection(kind, b);
        const angle = (Math.acos(u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) * 180) / Math.PI;
        assert.ok(Math.abs(angle - want) < 1e-6, `${kind} ${a},${b}: ${angle}`);
      }
    }
    assert.ok(Math.abs(HYBRIDS[kind].angle - want) < 1e-6);
  }
});

test('a hybrid is big along its direction and small behind it', () => {
  for (const kind of Object.keys(HYBRIDS)) {
    for (const n of [2, 3, 4]) {
      HYBRIDS[kind].rows.forEach((_, i) => {
        const combo = makeCombination(hybridTerms(kind, i, n));
        const [x, y, z] = hybridDirection(kind, i);
        // Compare the density integrated along the two half-lines, which is
        // what the eye sees, rather than one point that may sit on a node.
        let front = 0;
        let back = 0;
        for (let k = 1; k <= 400; k++) {
          const r = (k / 400) * 6 * n * n;
          front += r * r * combo.psi(r * x, r * y, r * z) ** 2;
          back += r * r * combo.psi(-r * x, -r * y, -r * z) ** 2;
        }
        assert.ok(front > 3 * back, `${kind} ${i} n=${n}: ${front} ${back}`);
      });
    }
  }
  assert.throws(() => hybridTerms('sp', 0, 1), RangeError);
});

test('the weighted cloud of an sp hybrid leans along +z by the exact amount', () => {
  // The mean position is checked against a direct quadrature of z |psi|^2.
  const terms = hybridTerms('sp', 0, 2);
  const s = sampleCombination(terms, 80000, 3);
  let sum = 0;
  let z = 0;
  for (let k = 0; k < s.count; k++) {
    sum += s.weights[k];
    z += s.weights[k] * s.positions[3 * k + 2];
  }
  const combo = makeCombination(terms);
  // Direct quadrature of z |psi|^2 over a box.
  const L = 40;
  const N = 80;
  const h = (2 * L) / N;
  let mass = 0;
  let mz = 0;
  for (let i = 0; i < N; i++) {
    const x = -L + (i + 0.5) * h;
    for (let j = 0; j < N; j++) {
      const y = -L + (j + 0.5) * h;
      for (let k = 0; k < N; k++) {
        const zz = -L + (k + 0.5) * h;
        const d = combo.psi(x, y, zz) ** 2;
        mass += d;
        mz += d * zz;
      }
    }
  }
  const want = mz / mass;
  assert.ok(Math.abs(mass * h ** 3 - 1) < 0.02, `norm ${mass * h ** 3}`);
  assert.ok(Math.abs(sum / s.count - 1) < 0.02, `mean weight ${sum / s.count}`);
  assert.ok(Math.abs(z / sum - want) < 0.1, `${z / sum} vs ${want}`);
  // And the lean is along the hybrid's own direction (+z), by 3 a0.
  assert.ok(Math.abs(want - 3) < 0.05, `${want}`);
});

test('dots carry the sign of the combination', () => {
  const terms = hybridTerms('sp3', 1, 3);
  const combo = makeCombination(terms);
  const s = sampleCombination(terms, 4000, 8);
  let agree = 0;
  for (let k = 0; k < s.count; k++) {
    const v = combo.psi(s.positions[3 * k], s.positions[3 * k + 1], s.positions[3 * k + 2]);
    if (Math.abs(v) < 1e-6 || Math.sign(v) === s.signs[k]) agree++;
  }
  assert.ok(agree >= s.count - 3);
  assert.equal(s.count, 4000);
});

test('uneven dot counts still give an unbiased cloud and the true acceptance', async () => {
  const { sampleOrbital } = await import('../src/sampler.js');
  // 5000 dots of sp2 member 1 split 1667 / 3333, not exactly 1/3 and 2/3.
  // With weights over the actual blend, the mean weight estimates 1.
  const terms = hybridTerms('sp2', 0, 2);
  const s = sampleCombination(terms, 5000, 1);
  let sum = 0;
  for (let k = 0; k < s.count; k++) sum += s.weights[k];
  assert.ok(Math.abs(sum / s.count - 1) < 0.03, `${sum / s.count}`);
  // Acceptance is dots kept over directions tried, pooled over both orbitals.
  const a = sampleOrbital(2, 0, 0, 1667, 1);
  const b = sampleOrbital(2, 1, 1, 3333, 1 + 7919);
  const pooled = 5000 / (1667 / a.acceptance + 3333 / b.acceptance);
  assert.ok(Math.abs(s.acceptance - pooled) < 1e-12, `${s.acceptance} vs ${pooled}`);
});
