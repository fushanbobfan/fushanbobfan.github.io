import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedPoints, relax, gatherCells } from '../src/lloyd.js';
import { createField } from '../src/density.js';
import { drawSource } from '../src/sources.js';
import { labelPixels } from '../src/voronoi.js';
import { createRng } from '../src/rng.js';

function halves(width, height, left, right) {
  const f = createField(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) f.data[y * width + x] = x < width / 2 ? left : right;
  return f;
}

function leftShare(points, count, width) {
  let n = 0;
  for (let i = 0; i < count; i++) if (points[2 * i] < width / 2) n++;
  return n / count;
}

test('seeding is reproducible and stays inside the picture', () => {
  const f = drawSource('sphere', 80, 60);
  const a = seedPoints(f, 500, createRng(9));
  const b = seedPoints(f, 500, createRng(9));
  assert.deepEqual(a, b);
  for (let i = 0; i < 500; i++) {
    assert.ok(a[2 * i] >= 0 && a[2 * i] < 80);
    assert.ok(a[2 * i + 1] >= 0 && a[2 * i + 1] < 60);
  }
});

test('seeding follows density: a 3:1 split gets about three quarters of the dots', () => {
  const f = halves(100, 50, 0.9, 0.3);
  const p = seedPoints(f, 4000, createRng(4));
  assert.ok(Math.abs(leftShare(p, 4000, 100) - 0.75) < 0.03);
});

test('seeding never puts a dot on blank paper when there is ink elsewhere', () => {
  const f = halves(40, 40, 0.5, 0);
  const p = seedPoints(f, 300, createRng(2));
  assert.equal(leftShare(p, 300, 40), 1);
});

test('a blank field still gets an even scatter', () => {
  const p = seedPoints(createField(30, 30), 100, createRng(1));
  assert.equal(p.length, 200);
});

test('cell sums add up to the whole picture', () => {
  const f = drawSource('rings', 64, 48);
  const p = seedPoints(f, 120, createRng(3));
  const labels = labelPixels(p, 120, 64, 48);
  const s = gatherCells(f, p, 120, labels);
  const area = s.area.reduce((a, b) => a + b, 0);
  const mass = s.mass.reduce((a, b) => a + b, 0);
  const ink = f.data.reduce((a, b) => a + b, 0);
  assert.equal(area, 64 * 48);
  assert.ok(Math.abs(mass - ink) < 1e-6 * ink);
});

test('on even ink, relaxing settles: moves shrink and spacing evens out', () => {
  const f = createField(80, 80);
  f.data.fill(1);
  const p = seedPoints(f, 64, createRng(11));
  const scratch = {};
  const first = relax(f, p, 64, scratch);
  let last = first;
  for (let k = 0; k < 40; k++) last = relax(f, p, 64, scratch);
  assert.ok(last.meanMove < first.meanMove / 10, `${first.meanMove} -> ${last.meanMove}`);
  // Centroidal cells on even ink have nearly equal areas (100 px each here).
  const areas = [...last.stats.area];
  const mean = areas.reduce((a, b) => a + b, 0) / areas.length;
  const spread = Math.sqrt(areas.reduce((a, b) => a + (b - mean) ** 2, 0) / areas.length) / mean;
  assert.ok(spread < 0.15, `relative area spread ${spread}`);
});

test('relaxing keeps the dots where the ink is', () => {
  const f = halves(100, 50, 0.9, 0.3);
  const p = seedPoints(f, 600, createRng(8));
  const scratch = {};
  for (let k = 0; k < 20; k++) relax(f, p, 600, scratch);
  // Each dot ends up with about the same ink, so the 3:1 split holds.
  assert.ok(Math.abs(leftShare(p, 600, 100) - 0.75) < 0.05);
});

test('a dot whose cell holds no ink stays put', () => {
  const f = halves(40, 20, 1, 0);
  const p = new Float64Array([5, 10, 35, 10]);
  relax(f, p, 2, {});
  assert.deepEqual([p[2], p[3]], [35, 10]);
});
