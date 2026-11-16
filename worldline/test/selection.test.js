import test from 'node:test';
import assert from 'node:assert/strict';
import { selectIndex, afterRemoval, focusAfterRemoval } from '../src/selection.js';

test('selection keeps the two most recent events', () => {
  assert.deepEqual(selectIndex([], 2), [2]);
  assert.deepEqual(selectIndex([0, 1], 2), [1, 2]);
  assert.deepEqual(selectIndex([0, 1], 0), [1, 0]);
});

test('removing an event shifts later selections down', () => {
  const r = afterRemoval({ selected: [0, 2], drag: null }, 1);
  assert.deepEqual(r.selected, [0, 1]);
  assert.equal(r.drag, null);
});

test('a drag on the removed event ends', () => {
  const r = afterRemoval({ selected: [0, 1], drag: { index: 1, id: 7 } }, 1);
  assert.equal(r.drag, null);
  assert.deepEqual(r.selected, [0]);
});

test('a drag on a later event follows it instead of landing on its neighbour', () => {
  const r = afterRemoval({ selected: [2], drag: { index: 2, id: 7 } }, 0);
  assert.deepEqual(r.drag, { index: 1, id: 7 });
  assert.deepEqual(r.selected, [1]);
});

test('focus moves to the row that takes the removed one\'s place', () => {
  assert.equal(focusAfterRemoval(3, 1), 1);
  assert.equal(focusAfterRemoval(2, 2), 1);
  assert.equal(focusAfterRemoval(0, 0), -1);
});
