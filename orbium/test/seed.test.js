import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, soup, brush } from '../src/seed.js';
import { World } from '../src/world.js';

test('the generator is deterministic and stays in [0, 1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('the same seed gives the same soup', () => {
  const w1 = new World(64);
  const w2 = new World(64);
  soup(w1, { seed: 7, count: 5 });
  soup(w2, { seed: 7, count: 5 });
  assert.deepEqual(w1.cells, w2.cells);
  assert.ok(w1.mass() > 0);
  for (const v of w1.cells) assert.ok(v >= 0 && v <= 1);
  const w3 = new World(64);
  soup(w3, { seed: 8, count: 5 });
  assert.notDeepEqual(w1.cells, w3.cells);
});

test('the brush adds most at its centre, wraps, and can erase', () => {
  const w = new World(32);
  brush(w, 0, 0, 3, 0.5);
  assert.equal(w.cells[0], 0.5);
  assert.ok(w.cells[1] > 0 && w.cells[1] < 0.5);
  assert.ok(w.cells[31] > 0, 'wraps to the right edge');
  assert.ok(w.cells[31 * 32] > 0, 'wraps to the bottom edge');
  assert.equal(w.cells[5], 0);
  brush(w, 0, 0, 3, 1);
  assert.equal(w.cells[0], 1);
  brush(w, 0, 0, 4, -2);
  assert.equal(w.mass(), 0);
});
