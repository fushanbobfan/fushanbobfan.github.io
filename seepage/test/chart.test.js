import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barsPath, histogram, linePath } from '../src/chart.js';

test('line paths map the unit square onto the box, y pointing up', () => {
  assert.equal(linePath([0, 1], [0, 1], { width: 100, height: 50 }), 'M0.0,50.0L100.0,0.0');
  assert.equal(linePath([0.5], [0.5], { width: 100, height: 50, pad: 10 }), 'M50.0,25.0');
});

test('histogram bins values and drops the ones outside the range', () => {
  assert.deepEqual(histogram([0, 0.1, 0.55, 0.99, 1, -0.2, NaN], 4), [2, 0, 1, 1]);
  assert.deepEqual(histogram([0.5, 0.52, 0.61], 2, 0.5, 0.7), [2, 1]);
});

test('bar paths draw one bar per non-empty bin, the tallest at 90% height', () => {
  const d = barsPath([0, 2, 1], { width: 30, height: 100 });
  assert.equal(d.match(/M/g).length, 2);
  assert.ok(d.startsWith('M10.0,100.0h10.0v-90.0'));
});
