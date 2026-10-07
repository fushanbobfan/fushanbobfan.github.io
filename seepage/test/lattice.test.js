import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { createLattice, downOpen, openFraction, rightOpen, siteOpen } from '../src/lattice.js';

test('the generator repeats from a seed and stays in [0, 1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const u = a();
    assert.equal(u, b());
    assert.ok(u >= 0 && u < 1);
  }
});

test('the same seed builds the same grid', () => {
  const a = createLattice({ size: 32, seed: 7 });
  const b = createLattice({ size: 32, seed: 7 });
  assert.deepEqual(a.site, b.site);
  assert.notDeepEqual(a.site, createLattice({ size: 32, seed: 8 }).site);
});

test('sizes outside the allowed range are refused', () => {
  assert.throws(() => createLattice({ size: 4 }), RangeError);
  assert.throws(() => createLattice({ size: 1000 }), RangeError);
  assert.throws(() => createLattice({ size: 16.5 }), RangeError);
  assert.throws(() => createLattice({ size: 16, mode: 'hex' }), RangeError);
});

test('open fraction is close to p on a large grid', () => {
  for (const mode of ['site', 'bond']) {
    const lat = createLattice({ size: 256, mode, seed: 3 });
    for (const p of [0.2, 0.5, 0.8]) {
      assert.ok(Math.abs(openFraction(lat, p) - p) < 0.01, `${mode} p=${p}`);
    }
    assert.equal(openFraction(lat, 0), 0);
    assert.equal(openFraction(lat, 1), 1);
  }
});

test('raising p only opens more of the grid', () => {
  for (const mode of ['site', 'bond']) {
    const lat = createLattice({ size: 24, mode, seed: 11 });
    for (let i = 0; i < 24 * 24; i++) {
      for (const [lo, hi] of [[0.3, 0.6], [0.6, 0.9]]) {
        if (rightOpen(lat, i, lo)) assert.ok(rightOpen(lat, i, hi));
        if (downOpen(lat, i, lo)) assert.ok(downOpen(lat, i, hi));
        if (siteOpen(lat, i, lo)) assert.ok(siteOpen(lat, i, hi));
      }
    }
  }
});

test('no link leaves the grid, even at p = 1', () => {
  for (const mode of ['site', 'bond']) {
    const lat = createLattice({ size: 10, mode, seed: 5 });
    for (let y = 0; y < 10; y++) assert.equal(rightOpen(lat, y * 10 + 9, 1), false);
    for (let x = 0; x < 10; x++) assert.equal(downOpen(lat, 90 + x, 1), false);
  }
});
