import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLattice } from '../src/lattice.js';
import { labelClusters } from '../src/clusters.js';
import { SITE_THRESHOLD } from '../src/sweep.js';
import { TAU, fitSlope, sizeDistribution } from '../src/distribution.js';

const fake = (sizes) => sizes.map((size) => ({ size, spans: false }));

test('sizes fall into power-of-two bins, averaged over the sizes each covers', () => {
  const pts = sizeDistribution(fake([1, 1, 2, 3, 3, 5, 9]), 100);
  assert.deepEqual(pts.map((pt) => pt.lo), [1, 2, 4, 8]);
  assert.deepEqual(pts.map((pt) => pt.count), [2, 3, 1, 1]);
  assert.equal(pts[1].n, 3 / (2 * 100));
  assert.ok(pts[1].s > 2 && pts[1].s < 3);
});

test('spanning clusters are left out', () => {
  const pts = sizeDistribution([{ size: 4000, spans: true }, ...fake([1, 2])], 4096);
  assert.equal(pts.reduce((a, pt) => a + pt.count, 0), 2);
});

test('an exact power law gives back its exponent', () => {
  const pts = [1, 2, 4, 8, 16, 32].map((lo) => ({ lo, s: lo, n: lo ** -2.5 }));
  assert.ok(Math.abs(fitSlope(pts) + 2.5) < 1e-12);
  assert.ok(Number.isNaN(fitSlope(pts.slice(0, 1))));
});

test('at the threshold the slope is close to -187/91, and steeper above it', () => {
  const slope = (p) => {
    const all = [];
    for (let seed = 1; seed <= 4; seed++) all.push(...labelClusters(createLattice({ size: 256, seed }), p).clusters);
    return fitSlope(sizeDistribution(all, 4 * 256 * 256), 8, 1024);
  };
  const atPc = slope(SITE_THRESHOLD);
  assert.ok(Math.abs(atPc + TAU) < 0.25, `slope ${atPc}`);
  assert.ok(slope(0.65) < atPc - 0.1);
});
