import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSystem, regularMagnets, fate } from '../src/model.js';
import { BasinMap, rowOrder, shade, paint, hexToRgb } from '../src/basins.js';

const sys = makeSystem(regularMagnets(3));

test('row order visits every row once, coarse rows first', () => {
  for (const size of [1, 7, 8, 33, 100]) {
    const order = rowOrder(size);
    assert.equal(order.length, size);
    assert.equal(new Set(order).size, size);
    assert.equal(order[0], 0);
  }
  assert.deepEqual(rowOrder(17).slice(0, 3), [0, 8, 16]);
});

test('pixels and plane coordinates convert back and forth', () => {
  const map = new BasinMap(sys, 50, { cx: 0.5, cy: -1, half: 2 });
  const [x, y] = map.toWorld(12, 40);
  const [c, r] = map.toPixel(x, y);
  assert.ok(Math.abs(c - 12) < 1e-9 && Math.abs(r - 40) < 1e-9);
  assert.ok(map.toWorld(0, 0)[1] > map.toWorld(0, 49)[1], 'top row is the highest y');
});

test('each finished cell holds the fate of its own starting point', () => {
  const map = new BasinMap(sys, 12);
  while (!map.complete) map.work(1000);
  for (const [col, row] of [[0, 0], [5, 7], [11, 3]]) {
    const [x, y] = map.toWorld(col, row);
    const r = fate(sys, x, y);
    assert.equal(map.magnet[row * 12 + col], r.magnet);
    assert.ok(Math.abs(map.time[row * 12 + col] - r.time) < 1e-4);
  }
});

test('work stops when the budget runs out and resumes where it left off', () => {
  const map = new BasinMap(sys, 16);
  let clock = 0;
  // The clock is read once at the start and after every cell: 3, 6, 9.
  assert.equal(map.work(5, () => (clock += 3)), 0);
  assert.equal(map.col, 2, 'stopped two cells into the first row');
  assert.ok(map.progress > 0 && map.progress < 1 / 16);
  while (!map.complete) map.work(1000);
  assert.ok(map.done.every((d) => d === 1));
  assert.equal(map.progress, 1);
});

test('three equal magnets on a symmetric view share the map evenly', () => {
  const map = new BasinMap(sys, 36);
  while (!map.complete) map.work(1000);
  const { fractions, total } = map.shares();
  assert.equal(total, 36 * 36);
  for (const f of fractions.slice(0, 3)) assert.ok(Math.abs(f - 1 / 3) < 0.06, `share ${f}`);
  assert.equal(fractions[3], 0);
});

test('a row not yet computed borrows the nearest finished row', () => {
  const map = new BasinMap(sys, 20);
  map.computeRow(8);
  assert.equal(map.sourceRow(3), 8);
  assert.equal(map.sourceRow(15), 8);
  map.computeRow(0);
  assert.equal(map.sourceRow(3), 0);
});

test('shading keeps quick catches bright and darkens slow ones', () => {
  assert.deepEqual(shade([200, 100, 50], 0), [200, 100, 50]);
  const slow = shade([200, 100, 50], 1000);
  assert.deepEqual(slow, [68, 34, 17]);
  assert.ok(shade([200, 0, 0], 5)[0] > shade([200, 0, 0], 20)[0]);
});

test('painting fills every pixel once a row exists, and nothing before', () => {
  const map = new BasinMap(sys, 8);
  const data = new Uint8ClampedArray(8 * 8 * 4);
  paint(map, data, [[255, 0, 0], [0, 255, 0], [0, 0, 255]]);
  assert.ok(data.every((v) => v === 0));
  map.computeRow(0);
  paint(map, data, [[255, 0, 0], [0, 255, 0], [0, 0, 255]]);
  for (let p = 0; p < 64; p++) assert.equal(data[4 * p + 3], 255);
});

test('hex colours parse to bytes', () => {
  assert.deepEqual(hexToRgb('#c4652a'), [196, 101, 42]);
  assert.deepEqual(hexToRgb('2f6f9a'), [47, 111, 154]);
});
