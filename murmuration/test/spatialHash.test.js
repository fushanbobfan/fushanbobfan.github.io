import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpatialHash } from '../src/spatialHash.js';
import { createRng } from '../src/rng.js';

function bruteForce(items, x, y, radius) {
  return items.filter((p) => Math.hypot(p.x - x, p.y - y) <= radius);
}

test('rejects a non-positive cell size', () => {
  assert.throws(() => new SpatialHash(0), RangeError);
  assert.throws(() => new SpatialHash(-3), RangeError);
});

test('query returns exactly the points within the radius', () => {
  const hash = new SpatialHash(10);
  const items = [
    { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 12 }, { x: 30, y: 30 }, { x: -4, y: -3 },
  ];
  hash.build(items);
  const found = hash.query(0, 0, 6);
  assert.deepEqual(new Set(found), new Set([items[0], items[1], items[4]]));
});

test('points sitting exactly on the radius are included', () => {
  const hash = new SpatialHash(4);
  const p = { x: 3, y: 4 };
  hash.build([p]);
  assert.deepEqual(hash.query(0, 0, 5), [p]);
  assert.deepEqual(hash.query(0, 0, 4.999), []);
});

test('negative coordinates hash correctly', () => {
  const hash = new SpatialHash(8);
  const items = [{ x: -1, y: -1 }, { x: -9, y: -9 }, { x: 1, y: 1 }];
  hash.build(items);
  assert.deepEqual(new Set(hash.query(-2, -2, 3)), new Set([items[0], items[2]]));
});

test('matches brute force on a random cloud across cell sizes', () => {
  const rng = createRng(99);
  const items = Array.from({ length: 400 }, () => ({ x: rng() * 500 - 100, y: rng() * 500 - 100 }));
  for (const cellSize of [5, 25, 80, 1000]) {
    const hash = new SpatialHash(cellSize);
    hash.build(items);
    for (let i = 0; i < 30; i++) {
      const x = rng() * 600 - 150;
      const y = rng() * 600 - 150;
      const radius = rng() * 60;
      const expected = new Set(bruteForce(items, x, y, radius));
      const got = new Set(hash.query(x, y, radius));
      assert.deepEqual(got, expected, `cellSize=${cellSize} query ${i}`);
    }
  }
});

test('build discards the previous contents', () => {
  const hash = new SpatialHash(10);
  hash.build([{ x: 1, y: 1 }]);
  hash.build([{ x: 50, y: 50 }]);
  assert.deepEqual(hash.query(1, 1, 5), []);
  assert.equal(hash.query(50, 50, 5).length, 1);
});
