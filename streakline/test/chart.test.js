import test from 'node:test';
import assert from 'node:assert/strict';
import { niceCeil, liftRange, dragRange, toPoints } from '../src/chart.js';

test('tidy ceilings step through 1, 2 and 5', () => {
  assert.equal(niceCeil(0.7), 1);
  assert.equal(niceCeil(1.3), 2);
  assert.equal(niceCeil(3), 5);
  assert.equal(niceCeil(5), 5);
  assert.equal(niceCeil(0.031), 0.05);
  assert.equal(niceCeil(0), 0);
});

test('lift ranges are symmetric and drag ranges start at zero', () => {
  assert.deepEqual(liftRange([0.01, -0.02]), [-0.2, 0.2]);
  assert.deepEqual(liftRange([0.7, -0.66]), [-1, 1]);
  assert.deepEqual(dragRange([1.7, 1.8]), [0, 2]);
  assert.deepEqual(dragRange([]), [0, 0.5]);
  assert.deepEqual(dragRange([-0.3, 1]), [-0.5, 2]);
});

test('points fill the box with high values at the top', () => {
  const pts = toPoints([0, 5, 10], [-1, 0, 1], { x: 10, y: 20, w: 100, h: 40 }, [0, 10], [-1, 1]);
  assert.deepEqual(pts, [[10, 60], [60, 40], [110, 20]]);
});
