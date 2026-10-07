import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLattice } from '../src/lattice.js';
import { labelClusters, summarise } from '../src/clusters.js';
import { BOND_THRESHOLD, SITE_THRESHOLD, runSweep, sweepLattice } from '../src/sweep.js';

test('the sweep matches cluster labelling at every p on the same grid', () => {
  for (const mode of ['site', 'bond']) {
    const lat = createLattice({ size: 32, mode, seed: 21 });
    const bins = 21;
    const { largest, threshold } = sweepLattice(lat, bins);
    for (let b = 0; b < bins; b++) {
      const p = b / (bins - 1);
      const s = summarise(labelClusters(lat, p));
      assert.equal(largest[b], s.largest / (32 * 32), `${mode} p=${p}`);
    }
    // Just below the threshold no cluster joins top to bottom; just above, one does.
    assert.equal(summarise(labelClusters(lat, threshold)).spansVertical, false);
    assert.equal(summarise(labelClusters(lat, threshold + 1e-6)).spansVertical, true);
  }
});

test('the largest cluster never shrinks as p rises', () => {
  const { largest } = sweepLattice(createLattice({ size: 64, seed: 8 }), 101);
  for (let b = 1; b < largest.length; b++) assert.ok(largest[b] >= largest[b - 1]);
  assert.equal(largest[0], 0);
  assert.equal(largest[100], 1);
});

test('site thresholds gather near 0.5927', () => {
  const r = runSweep({ size: 64, mode: 'site', trials: 60, seed: 5 });
  assert.equal(r.trials, 60);
  assert.ok(Math.abs(r.mean - SITE_THRESHOLD) < 0.02, `mean ${r.mean}`);
  assert.ok(r.sd > 0 && r.sd < 0.05);
});

test('bond thresholds gather near 1/2', () => {
  const r = runSweep({ size: 64, mode: 'bond', trials: 60, seed: 5 });
  assert.ok(Math.abs(r.mean - BOND_THRESHOLD) < 0.02, `mean ${r.mean}`);
});

test('the spanning probability climbs from 0 to 1 and is about 1/2 at the threshold', () => {
  const r = runSweep({ size: 48, trials: 80, seed: 13 });
  for (let b = 1; b < r.spanning.length; b++) assert.ok(r.spanning[b] >= r.spanning[b - 1]);
  assert.equal(r.spanning[0], 0);
  assert.equal(r.spanning[100], 1);
  const atPc = r.spanning[Math.round(SITE_THRESHOLD * 100)];
  assert.ok(atPc > 0.25 && atPc < 0.75, `R(pc) = ${atPc}`);
});

test('bigger grids give a sharper step', () => {
  const small = runSweep({ size: 16, trials: 80, seed: 2 });
  const large = runSweep({ size: 96, trials: 80, seed: 2 });
  assert.ok(large.sd < small.sd, `${large.sd} vs ${small.sd}`);
});

test('the per-trial callback sees every grid', () => {
  const seen = [];
  runSweep({ size: 16, trials: 5, seed: 1 }, (r, t) => seen.push(t));
  assert.deepEqual(seen, [0, 1, 2, 3, 4]);
});
