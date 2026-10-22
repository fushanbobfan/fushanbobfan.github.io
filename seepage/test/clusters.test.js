import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLattice, downOpen, rightOpen, siteOpen } from '../src/lattice.js';
import { UnionFind, labelClusters, sizeHistogram, summarise } from '../src/clusters.js';

// Grid from a picture: '#' open, '.' closed.
function fromRows(rows) {
  const size = rows.length;
  const lat = createLattice({ size, seed: 1 });
  rows.forEach((row, y) => [...row].forEach((ch, x) => { lat.site[y * size + x] = ch === '#' ? 0 : 0.99; }));
  return lat;
}

const pad = (rows) => rows.map((r) => r.padEnd(8, '.')).concat(Array(8 - rows.length).fill('........'));

// Flood fill as an independent reference for the cluster count and sizes.
function floodSizes(lat, p) {
  const n = lat.size * lat.size;
  const seen = new Uint8Array(n);
  const sizes = [];
  for (let s = 0; s < n; s++) {
    if (seen[s] || !siteOpen(lat, s, p)) continue;
    let k = 0;
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop();
      k++;
      const nb = [];
      if (rightOpen(lat, i, p)) nb.push(i + 1);
      if (downOpen(lat, i, p)) nb.push(i + lat.size);
      if (i % lat.size > 0 && rightOpen(lat, i - 1, p)) nb.push(i - 1);
      if (i >= lat.size && downOpen(lat, i - lat.size, p)) nb.push(i - lat.size);
      for (const j of nb) if (!seen[j]) { seen[j] = 1; stack.push(j); }
    }
    sizes.push(k);
  }
  return sizes.sort((a, b) => b - a);
}

test('union-find joins and counts', () => {
  const uf = new UnionFind(6);
  uf.union(0, 1);
  uf.union(2, 3);
  uf.union(1, 3);
  assert.equal(uf.find(0), uf.find(2));
  assert.notEqual(uf.find(0), uf.find(4));
  assert.equal(uf.size[uf.find(3)], 4);
});

test('a drawn grid gives the expected clusters', () => {
  const lat = fromRows(pad([
    '##..#',
    '.#..#',
    '.##.#',
    '....#',
    '#...#',
    '....#',
    '....#',
    '....#',
  ]));
  const { label, clusters } = labelClusters(lat, 0.5);
  assert.deepEqual(clusters.map((c) => c.size), [8, 5, 1]);
  assert.equal(clusters[0].spansVertical, true);
  assert.equal(clusters[0].spansHorizontal, false);
  assert.equal(clusters[1].spans, false);
  assert.equal(label[0], label[9]);
  assert.equal(label[2], -1);
  assert.equal(label[4], 0);
});

test('diagonal neighbours do not connect', () => {
  const lat = fromRows(pad(['#.', '.#']));
  assert.equal(labelClusters(lat, 0.5).clusters.length, 2);
});

test('labels agree with a flood fill on random grids', () => {
  for (const mode of ['site', 'bond']) {
    for (const p of [0.3, 0.5, 0.6, 0.75]) {
      const lat = createLattice({ size: 40, mode, seed: 99 });
      const { clusters } = labelClusters(lat, p);
      assert.deepEqual(clusters.map((c) => c.size), floodSizes(lat, p), `${mode} p=${p}`);
    }
  }
});

test('every site of a cluster carries its label and sizes add up', () => {
  const lat = createLattice({ size: 30, seed: 4 });
  const result = labelClusters(lat, 0.59);
  const counts = new Array(result.clusters.length).fill(0);
  for (const k of result.label) if (k >= 0) counts[k]++;
  assert.deepEqual(counts, result.clusters.map((c) => c.size));
  const s = summarise(result);
  assert.equal(s.open, counts.reduce((a, b) => a + b, 0));
  assert.equal(sizeHistogram(result.clusters).reduce((a, [size, k]) => a + size * k, 0), s.open);
});

test('a full grid spans and an empty one does not', () => {
  const lat = createLattice({ size: 16, seed: 2 });
  const full = summarise(labelClusters(lat, 1));
  assert.equal(full.count, 1);
  assert.equal(full.spansVertical && full.spansHorizontal, true);
  assert.equal(full.meanFiniteSize, 0);
  const empty = summarise(labelClusters(lat, 0));
  assert.equal(empty.count, 0);
  assert.equal(empty.spans, false);
});

test('bond grids keep every site, isolated ones as single clusters', () => {
  const lat = createLattice({ size: 12, mode: 'bond', seed: 6 });
  const s = summarise(labelClusters(lat, 0));
  assert.equal(s.count, 144);
  assert.equal(s.largest, 1);
});
