import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Grid, MAX_SIZE } from '../src/grid.js';

test('cells outside the array read as colour 0', () => {
  const g = new Grid(8);
  assert.equal(g.get(100, -100), 0);
  assert.ok(g.inside(-4, -4) && g.inside(3, 3));
  assert.ok(!g.inside(4, 0) && !g.inside(0, -5));
});

test('growing keeps every cell where it was', () => {
  const g = new Grid(8);
  g.set(-4, -4, 1);
  g.set(3, 3, 2);
  g.set(0, 0, 3);
  g.set(20, -17, 4);
  assert.equal(g.size, 64);
  assert.equal(g.get(-4, -4), 1);
  assert.equal(g.get(3, 3), 2);
  assert.equal(g.get(0, 0), 3);
  assert.equal(g.get(20, -17), 4);
  assert.deepEqual(g.census(5), [64 * 64 - 4, 1, 1, 1, 1]);
});

test('growth stops at the size limit', () => {
  const g = new Grid(MAX_SIZE);
  assert.equal(g.set(MAX_SIZE, 0, 1), false);
  assert.equal(g.size, MAX_SIZE);
});
