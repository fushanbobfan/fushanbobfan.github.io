import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECS } from '../src/params.js';
import { SHAPES } from '../src/shapes.js';

test('the link format knows exactly the shapes the grid can make', () => {
  assert.deepEqual(SPECS.shape.values, Object.keys(SHAPES));
});
