import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLattice } from '../src/lattice.js';
import { labelClusters } from '../src/clusters.js';
import { burn, frontSizes } from '../src/burn.js';
import { sweepLattice } from '../src/sweep.js';

function fromRows(rows) {
  const size = rows.length;
  const lat = createLattice({ size, seed: 1 });
  rows.forEach((row, y) => [...row].forEach((ch, x) => { lat.site[y * size + x] = ch === '#' ? 0 : 0.99; }));
  return lat;
}

test('fire follows the open path and counts its length', () => {
  // A snake from the top-left corner down to the bottom row.
  const lat = fromRows([
    '#.......',
    '####....',
    '...#....',
    '.###....',
    '.#......',
    '.######.',
    '......#.',
    '......#.',
  ]);
  const { time, crossed, steps } = burn(lat, 0.5);
  assert.equal(time[0], 0);
  assert.equal(time[8 + 3], 4);
  assert.equal(time[7 * 8 + 6], crossed);
  assert.equal(crossed, 17);
  assert.equal(steps, crossed);
  assert.equal(time[2], -1);
});

test('with every cell open, fire crosses in size - 1 steps', () => {
  const lat = createLattice({ size: 20, seed: 3 });
  const { crossed, steps, time } = burn(lat, 1);
  assert.equal(crossed, 19);
  assert.equal(steps, 19);
  assert.deepEqual(frontSizes(time, steps), new Array(20).fill(20));
});

test('only clusters touching the top row burn', () => {
  for (const mode of ['site', 'bond']) {
    const lat = createLattice({ size: 40, mode, seed: 17 });
    const p = 0.6;
    const { label, clusters } = labelClusters(lat, p);
    const top = new Set();
    for (let x = 0; x < 40; x++) if (label[x] >= 0) top.add(label[x]);
    const { time } = burn(lat, p);
    for (let i = 0; i < label.length; i++) {
      assert.equal(time[i] >= 0, label[i] >= 0 && top.has(label[i]), `${mode} site ${i}`);
    }
    assert.ok(clusters.length > top.size);
  }
});

test('fire crosses exactly when the grid spans top to bottom', () => {
  for (const mode of ['site', 'bond']) {
    const lat = createLattice({ size: 48, mode, seed: 29 });
    const { threshold } = sweepLattice(lat);
    assert.equal(burn(lat, threshold).crossed, -1);
    assert.ok(burn(lat, threshold + 1e-6).crossed > 0);
  }
});

test('neighbouring burnt cells differ by at most one step', () => {
  const lat = createLattice({ size: 64, seed: 2 });
  const { time } = burn(lat, 0.65);
  for (let i = 0; i < time.length; i++) {
    if (time[i] < 0) continue;
    if (i % 64 < 63 && time[i + 1] >= 0 && lat.site[i + 1] < 0.65) assert.ok(Math.abs(time[i] - time[i + 1]) <= 1);
    if (i + 64 < time.length && time[i + 64] >= 0) assert.ok(Math.abs(time[i] - time[i + 64]) <= 1);
  }
});

test('the path near the threshold is much longer than the grid is tall', () => {
  const lat = createLattice({ size: 128, seed: 5 });
  const { threshold } = sweepLattice(lat);
  const near = burn(lat, threshold + 1e-6).crossed;
  const far = burn(lat, 0.9).crossed;
  assert.ok(near > 1.3 * far, `${near} vs ${far}`);
});
