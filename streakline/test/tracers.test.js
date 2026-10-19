import test from 'node:test';
import assert from 'node:assert/strict';
import { createLattice } from '../src/lattice.js';
import { createTracers, rakeRows, release, advect, clearTracers } from '../src/tracers.js';

function stream(nx, ny, u, v) {
  const lat = createLattice(nx, ny);
  lat.ux.fill(u);
  lat.uy.fill(v);
  return lat;
}

test('rake rows are evenly spaced inside the tunnel', () => {
  const rows = rakeRows(44, 4);
  assert.deepEqual(rows, [7, 17, 27, 37]);
});

test('a uniform stream carries particles exactly and keeps their rows', () => {
  const lat = stream(50, 20, 0.1, -0.02);
  const tr = createTracers(10);
  release(tr, [5, 10], 2);
  advect(tr, lat, 10);
  assert.equal(tr.count, 2);
  assert.ok(Math.abs(tr.x[0] - 3) < 1e-6 && Math.abs(tr.y[0] - 4.8) < 1e-6);
  assert.equal(tr.row[1], 1);
});

test('particles leaving the tunnel or entering a wall are dropped', () => {
  const lat = stream(20, 10, 0.5, 0);
  lat.solid[5 * 20 + 6] = 1;
  const tr = createTracers(10);
  release(tr, [5, 2], 5);
  advect(tr, lat, 2);
  assert.equal(tr.count, 1);
  assert.equal(tr.y[0], 2);
  advect(tr, lat, 40);
  assert.equal(tr.count, 0);
});

test('a full store drops its oldest particles first', () => {
  const tr = createTracers(5);
  release(tr, [1, 2], 0);
  release(tr, [1, 2], 1);
  release(tr, [1, 2], 2);
  assert.equal(tr.count, 5);
  assert.deepEqual(Array.from(tr.x.slice(0, 5)), [0, 1, 1, 2, 2]);
  clearTracers(tr);
  assert.equal(tr.count, 0);
});
